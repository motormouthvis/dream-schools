#!/usr/bin/env node
/**
 * Has Dream Neighborhood's address detector moved without us?
 *
 * DN is upstream: every change lands there, bumps DETECTOR_VERSION, and is
 * published at /explorer/address-detector.json. A DN test fails if either file
 * changes without the version changing, so that number is meaningful.
 *
 * Fixing a failure is mechanical: re-fetch both files into
 * public/address-detector/, replace detector.lock.json, commit.
 *
 * A failed request is not a failure. DN being unreachable must not block our
 * deploys — that is the same "an outage is not an answer" rule we apply
 * everywhere else in this integration.
 *
 * Usage: node scripts/check-address-detector-drift.mjs
 */
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "..", "public", "address-detector");
const URL_ = process.env.DN_DETECTOR_MANIFEST || "https://staging.dreamneighborhood.com/explorer/address-detector.json";

const local = JSON.parse(readFileSync(join(DIR, "detector.lock.json"), "utf8"));

let published;
try {
  const res = await fetch(URL_, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  published = await res.json();
} catch (err) {
  console.log(`Could not reach DN's manifest (${err.message}). Skipping — an outage must not block a deploy.`);
  process.exit(0);
}

const problems = [];
if (published.version !== local.version) {
  problems.push(`version: we have ${local.version}, DN publishes ${published.version}`);
}
if (published.digest !== local.digest) {
  problems.push(`digest: we have ${local.digest}, DN publishes ${published.digest}`);
}

// Also confirm the bytes on disk are the ones the lock claims, so a local edit
// is caught as well as an upstream change.
for (const [path, want] of Object.entries(local.files)) {
  const name = path.split("/").pop();
  const got = createHash("sha256").update(readFileSync(join(DIR, name))).digest("hex");
  if (got !== want) problems.push(`${name} on disk does not match our own lock file — it has been edited`);
}

if (!problems.length) {
  console.log(`Address detector in step with DN: version ${local.version}, digest ${local.digest}.`);
  process.exit(0);
}
console.error("Address detector has drifted from Dream Neighborhood:");
for (const p of problems) console.error("  " + p);
console.error(`\nRe-fetch both files from ${new URL(URL_).origin}/explorer/address-detector/ and replace detector.lock.json.`);
process.exit(1);
