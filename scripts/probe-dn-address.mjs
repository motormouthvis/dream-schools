#!/usr/bin/env node
/**
 * Adversarial probe of Dream Neighborhood's address endpoints.
 *
 * Looking for one failure mode in particular: the confident wrong answer.
 * A `not_found` is safe — we show "no matches" and the user tries again. An
 * address returned with success:true for somewhere else is not, because
 * nothing downstream can tell, and the School Explorer ends up describing the
 * wrong town's schools with total assurance.
 *
 * Usage: DN_ADDRESS_KEY=... node scripts/probe-dn-address.mjs
 */
const KEY = process.env.DN_ADDRESS_KEY || "";
const BASE = process.env.DN_BASE || "https://staging.dreamneighborhood.com";
if (!KEY) {
  console.error("DN_ADDRESS_KEY is required.");
  process.exit(2);
}

async function lookup(address) {
  const url = `${BASE}/explorer/address/lookup/?address=${encodeURIComponent(address)}`;
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { Authorization: `Api-Key ${KEY}` } });
    const json = await res.json().catch(() => null);
    return { ms: Date.now() - started, status: res.status, json };
  } catch (err) {
    return { ms: Date.now() - started, status: 0, json: null, err: String(err) };
  }
}

/** Miles between two points, for judging "confidently wrong" by how wrong. */
function miles(a, b) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const findings = [];

/**
 * @param {string} address
 * @param {{ city?: string, state?: string, near?: {lat:number,lng:number}, expect?: "not_found" }} want
 */
async function probe(group, address, want = {}) {
  const { status, json, ms } = await lookup(address);
  const ok = json && json.success === true;
  let verdict = "";
  let bad = false;

  if (want.expect === "not_found") {
    if (ok) {
      bad = true;
      verdict = `answered ${json.city}, ${json.state} — expected no match`;
    } else {
      verdict = "not_found (correct)";
    }
  } else if (!ok) {
    verdict = `not_found${status !== 200 ? ` (HTTP ${status})` : ""}`;
  } else {
    const parts = [`${json.city}, ${json.state}`];
    if (want.state && json.state !== want.state) {
      bad = true;
      parts.push(`WRONG STATE, wanted ${want.state}`);
    } else if (want.city && json.city.toLowerCase() !== want.city.toLowerCase()) {
      parts.push(`city differs, wanted ${want.city}`);
    }
    if (want.near && Number.isFinite(json.lat)) {
      const d = miles(want.near, { lat: json.lat, lng: json.lng });
      parts.push(`${d.toFixed(0)} mi from expected`);
      if (d > 40) bad = true;
    }
    parts.push(json.source);
    verdict = parts.join(" · ");
  }

  if (bad) findings.push({ group, address, verdict });
  console.log(`  ${bad ? "!!" : "  "} ${address.padEnd(48).slice(0, 48)} ${verdict}  ${ms}ms`);
}

const FP = { lat: 27.4467, lng: -80.3256 }; // Fort Pierce, FL

console.log("\n=== A. The three fixes, re-verified ===");
await probe("A", "200 E Colfax Ave, Denver, CO", { state: "CO", city: "Denver" });
await probe("A", "1500 N 23rd St, Fort Pierce, FL", { state: "FL", city: "Fort Pierce", near: FP });
await probe("A", "100 N Tryon St, Charlotte, NC", { state: "NC", city: "Charlotte" });
await probe("A", "Starbucks, Fort Pierce, FL", { expect: "not_found" });

console.log("\n=== B. Our real listing fixtures ===");
const LISTINGS = [
  ["350 5th Avenue, New York, NY 10118", "NY"],
  ["1600 Pennsylvania Avenue NW, Washington, DC 20500", "DC"],
  ["233 S Wacker Drive, Chicago, IL 60606", "IL"],
  ["1 Apple Park Way, Cupertino, CA 95014", "CA"],
  ["200 E Colfax Avenue, Denver, CO 80203", "CO"],
  ["600 Travis Street, Houston, TX 77002", "TX"],
  ["100 N Tryon Street, Charlotte, NC 28202", "NC"],
  ["800 W Olympic Boulevard, Los Angeles, CA 90015", "CA"],
  ["225 Beacon Street, Boston, MA 02116", "MA"],
  ["1420 NW Lovejoy Street, Portland, OR 97209", "OR"],
  ["1500 N 23rd Street, Fort Pierce, FL 34950", "FL"],
  ["301 W 4th Street, Austin, TX 78701", "TX"],
];
for (const [a, st] of LISTINGS) await probe("B", a, { state: st });

console.log("\n=== C. Same street name, no ZIP — the class that was broken ===");
await probe("C", "100 Main St, Springfield, IL", { state: "IL" });
await probe("C", "100 Main St, Springfield, MA", { state: "MA" });
await probe("C", "100 Main St, Springfield, MO", { state: "MO" });
await probe("C", "1 Market St, San Francisco, CA", { state: "CA" });
await probe("C", "1 Market St, Philadelphia, PA", { state: "PA" });

console.log("\n=== D. Direction, suffix and unit — near misses that stay plausible ===");
await probe("D", "3309 N Indian River Dr, Fort Pierce, FL", { state: "FL", near: FP });
await probe("D", "3309 S Indian River Dr, Fort Pierce, FL", { state: "FL", near: FP });
await probe("D", "3309 Indian River Blvd, Fort Pierce, FL", { state: "FL", near: FP });
await probe("D", "1500 N 23rd St Apt 5, Fort Pierce, FL 34950", { state: "FL", near: FP });
await probe("D", "1500 North 23rd Street, Fort Pierce, Florida", { state: "FL", near: FP });

console.log("\n=== E. House numbers that do not exist on the block ===");
await probe("E", "99999 N Indian River Dr, Fort Pierce, FL 34946", { near: FP });
await probe("E", "1 N Indian River Dr, Fort Pierce, FL 34946", { near: FP });
await probe("E", "0 N Indian River Dr, Fort Pierce, FL 34946", { near: FP });

console.log("\n=== F. Contradictions and nonsense ===");
await probe("F", "1500 N 23rd St, Fort Pierce, FL 90210", {});
await probe("F", "1500 N 23rd St, Beverly Hills, CA 34950", {});
await probe("F", "1500 N 23rd St, Notatown, FL", { state: "FL" });
await probe("F", "asdfghjkl qwertyuiop", { expect: "not_found" });
await probe("F", "10 Downing Street, London", {});
await probe("F", "PO Box 1234, Fort Pierce, FL 34950", {});

console.log("\n=== G. Place-shaped queries our scraper produces ===");
await probe("G", "Fort Pierce, FL", { state: "FL", near: FP });
await probe("G", "Silver Lake, Los Angeles, CA", { state: "CA" });
await probe("G", "34950", { state: "FL", near: FP });

console.log(`\n${findings.length === 0 ? "No confidently wrong answers found." : `${findings.length} suspicious answer(s):`}`);
for (const f of findings) console.log(`  [${f.group}] ${f.address}\n        ${f.verdict}`);
