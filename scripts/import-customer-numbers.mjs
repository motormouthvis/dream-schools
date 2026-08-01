#!/usr/bin/env node
/**
 * Import the customer numbers DN minted, from the CSV its
 * `export_customer_numbers --dns prod` produces.
 *
 * This runs ONCE, under supervision, and never again — the number travels on
 * every pushed row afterwards, so nothing here is a recurring join. That is the
 * whole point of the number: the domain match happens here, watched, instead of
 * on every row forever.
 *
 * A wrong match silently attributes one realtor's homebuyers to another and
 * nothing downstream would flag it, so this refuses rather than guesses:
 * anything DN marked ambiguous, any malformed number, any number already held
 * by a different customer, and any customer id we do not recognise.
 *
 * Dry run by default. Nothing is written without --commit.
 *
 *   DATABASE_URL=… node scripts/import-customer-numbers.mjs numbers.csv
 *   DATABASE_URL=… node scripts/import-customer-numbers.mjs numbers.csv --commit
 */
import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const file = args.find((a) => !a.startsWith("--"));

if (!file) {
  console.error("Usage: DATABASE_URL=… node scripts/import-customer-numbers.mjs <csv> [--commit]");
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(2);
}

// Kept in step with lib/customerNumber.ts; this script runs outside Next.
function formatCustomerNumber(raw) {
  const n = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^DN(\d+)$/.exec(n);
  return m ? `DN-${m[1]}` : "";
}

/** Minimal RFC 4180 reader — enough for a two-column export with quoting. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function pickColumn(header, candidates) {
  const norm = header.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"));
  for (const c of candidates) {
    const i = norm.indexOf(c);
    if (i !== -1) return i;
  }
  return -1;
}

async function run() {
  const rows = parseCsv(readFileSync(file, "utf8"));
  if (!rows.length) {
    console.error("Empty CSV.");
    process.exit(1);
  }
  const header = rows[0];
  const iId = pickColumn(header, ["partner_id", "dns_partner_id", "customer_id", "dns_id", "id"]);
  const iNum = pickColumn(header, ["customer_number", "dn_customer_number", "number"]);
  const iStatus = pickColumn(header, ["status", "match", "match_status", "note"]);
  if (iId === -1 || iNum === -1) {
    console.error(`Could not find the id and number columns. Header was: ${header.join(", ")}`);
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: /heroku|amazonaws/i.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
  });

  const existing = new Map();
  const numberOwner = new Map();
  for (const r of (await pool.query(`SELECT id, email, customer_number FROM app_users`)).rows) {
    existing.set(r.id, r);
    if (r.customer_number) numberOwner.set(formatCustomerNumber(r.customer_number), r.id);
  }

  const apply = [];
  const refused = [];
  const unchanged = [];
  const seenInFile = new Map();

  for (const row of rows.slice(1)) {
    const id = (row[iId] || "").trim();
    const rawNumber = (row[iNum] || "").trim();
    const status = iStatus === -1 ? "" : (row[iStatus] || "").trim().toLowerCase();
    const refuse = (why) => refused.push({ id, rawNumber, why });

    if (status.includes("ambiguous")) { refuse("DN marked it ambiguous"); continue; }
    if (!id) { refuse("no customer id"); continue; }
    if (!rawNumber) { refuse("no customer number"); continue; }

    const number = formatCustomerNumber(rawNumber);
    if (!number) { refuse(`malformed number ${JSON.stringify(rawNumber)}`); continue; }

    const dupeInFile = seenInFile.get(number);
    if (dupeInFile && dupeInFile !== id) { refuse(`number also given to ${dupeInFile} in this file`); continue; }
    seenInFile.set(number, id);

    const user = existing.get(id);
    if (!user) { refuse("no such customer here"); continue; }
    if (formatCustomerNumber(user.customer_number) === number) { unchanged.push({ id, number }); continue; }
    if (user.customer_number) { refuse(`already has ${user.customer_number}`); continue; }

    const heldBy = numberOwner.get(number);
    if (heldBy && heldBy !== id) { refuse(`number already held by ${heldBy}`); continue; }

    apply.push({ id, number, email: user.email });
  }

  console.log(`\n${apply.length} to assign, ${unchanged.length} already correct, ${refused.length} refused.\n`);
  for (const a of apply) console.log(`  ASSIGN   ${a.number.padEnd(12)} ${a.email}`);
  if (refused.length) {
    console.log("");
    for (const r of refused) console.log(`  REFUSED  ${(r.rawNumber || "—").padEnd(12)} ${r.id || "(no id)"} — ${r.why}`);
  }

  if (!commit) {
    console.log(`\nDry run. Nothing written. Re-run with --commit to apply.`);
    await pool.end();
    return;
  }
  if (!apply.length) {
    console.log(`\nNothing to write.`);
    await pool.end();
    return;
  }

  // One transaction: a half-applied mapping is worse than none, because the
  // half that landed is indistinguishable from the half that did not.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const a of apply) {
      await client.query(`UPDATE app_users SET customer_number = $1 WHERE id = $2`, [a.number, a.id]);
    }
    await client.query("COMMIT");
    console.log(`\nAssigned ${apply.length} customer numbers.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\nRolled back:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
