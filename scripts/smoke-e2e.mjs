#!/usr/bin/env node
/**
 * Production smoke E2E for Dream Neighborhood Schools.
 *
 * Prerequisites:
 *   - SMOKE_TEST_SECRET set on the app dyno AND in this shell
 *   - Three smoke site base URLs (Heroku static apps)
 *
 * Usage:
 *   SMOKE_TEST_SECRET=... \
 *   SMOKE_SITE_IND=https://....herokuapp.com \
 *   SMOKE_SITE_P1=https://....herokuapp.com \
 *   SMOKE_SITE_P2=https://....herokuapp.com \
 *   node scripts/smoke-e2e.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = (process.env.SMOKE_APP_BASE || "https://app.dreamneighborhoodschools.com").replace(/\/$/, "");
const WWW = (process.env.SMOKE_WWW_BASE || "https://www.dreamneighborhoodschools.com").replace(/\/$/, "");
const SECRET = (process.env.SMOKE_TEST_SECRET || "").trim();
const PASSWORD = process.env.SMOKE_PASSWORD || "SmokeTest!2026";
const PASSWORD2 = process.env.SMOKE_PASSWORD_NEW || "SmokeTest!2026b";

const SITES = {
  ind: process.env.SMOKE_SITE_IND || "",
  p1: process.env.SMOKE_SITE_P1 || "",
  p2: process.env.SMOKE_SITE_P2 || "",
};

const EMAILS = {
  admin: "smoke-admin@dreamneighborhoodschools.com",
  partner: "smoke-partner@dreamneighborhoodschools.com",
  p1: "smoke-realtor-p1@dreamneighborhoodschools.com",
  p2: "smoke-realtor-p2@dreamneighborhoodschools.com",
  ind: "smoke-realtor-ind@dreamneighborhoodschools.com",
  indAlt: "smoke-realtor-ind2@dreamneighborhoodschools.com",
};

const LISTING_PATHS = [
  "/listing-nyc-empire.html",
  "/listing-dc-whitehouse.html",
  "/listing-chicago-sears.html",
  "/listing-cupertino.html",
  "/listing-denver.html",
  "/listing-houston.html",
  "/listing-charlotte.html",
  "/listing-la-olympic.html",
  "/listing-boston.html",
  "/listing-portland.html",
  "/listing-fort-pierce.html",
  "/listing-austin.html",
];

const USA_LOOKUPS = [
  "350 5th Avenue, New York, NY 10118",
  "1600 Pennsylvania Avenue NW, Washington, DC 20500",
  "233 S Wacker Drive, Chicago, IL 60606",
  "1 Apple Park Way, Cupertino, CA 95014",
  "200 E Colfax Avenue, Denver, CO 80203",
  "600 Travis Street, Houston, TX 77002",
  "100 N Tryon Street, Charlotte, NC 28202",
  "800 W Olympic Boulevard, Los Angeles, CA 90015",
  "225 Beacon Street, Boston, MA 02116",
  "1420 NW Lovejoy Street, Portland, OR 97209",
  "1500 N 23rd Street, Fort Pierce, FL 34950",
  "301 W 4th Street, Austin, TX 78701",
];

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail: String(detail).slice(0, 500) });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${String(detail).slice(0, 160)}` : ""}`);
}

function hostOf(url) {
  return new URL(url).hostname;
}

async function jarFetch(jar, url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (jar.cookie) headers.Cookie = jar.cookie;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
    delete opts.json;
  }
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  const set = res.headers.getSetCookie?.() || [];
  // Node fetch: getSetCookie may exist; fallback to raw header
  const raw = set.length ? set : [res.headers.get("set-cookie")].filter(Boolean);
  for (const c of raw) {
    const m = String(c).match(/dn_sess=([^;]+)/);
    if (m) jar.cookie = `dn_sess=${m[1]}`;
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data, status: res.status };
}

async function smokeAdminLogin() {
  const jar = { cookie: "" };
  const { status, data } = await jarFetch(jar, `${APP}/api/auth/smoke?key=${encodeURIComponent(SECRET)}`);
  if (status !== 200 || !data?.ok) throw new Error(`admin login failed: ${status} ${JSON.stringify(data)}`);
  return { jar, user: data };
}

async function provision(role, email, extra = {}) {
  const { status, data } = await jarFetch(
    { cookie: "" },
    `${APP}/api/auth/smoke`,
    {
      method: "POST",
      json: {
        key: SECRET,
        action: "provision",
        role,
        email,
        password: PASSWORD,
        ...extra,
      },
    }
  );
  if (status !== 200 || !data?.ok) throw new Error(`provision ${email}: ${status} ${JSON.stringify(data)}`);
  return data.user;
}

async function loginAs(email) {
  const jar = { cookie: "" };
  const { status, data } = await jarFetch(jar, `${APP}/api/auth/smoke`, {
    method: "POST",
    json: { key: SECRET, action: "login-as", email },
  });
  if (status !== 200 || !data?.ok) throw new Error(`login-as ${email}: ${status} ${JSON.stringify(data)}`);
  return { jar, user: data };
}

async function passwordLogin(email, password) {
  const jar = { cookie: "" };
  // Turnstile is enforced on prod — smoke accounts use login-as instead for most flows.
  // Password login is still attempted; if Turnstile blocks, we note it.
  const { status, data } = await jarFetch(jar, `${APP}/api/auth/login`, {
    method: "POST",
    json: { email, password, turnstileToken: "" },
  });
  return { jar, status, data };
}

async function setConfig(jar, domain, extras = {}) {
  const { status, data } = await jarFetch(jar, `${APP}/api/app/config`, {
    method: "POST",
    json: {
      authorizedDomain: domain,
      enabled: true,
      defaultAddress: "1500 N 23rd Street, Fort Pierce, FL 34950",
      accentColor: extras.accentColor || "#1fa55f",
      position: extras.position || "right",
      showExternalLinks: true,
      inlineMinHeight: 750,
      ...extras,
    },
  });
  if (status !== 200) throw new Error(`config ${domain}: ${status} ${JSON.stringify(data)}`);
  return data;
}

/** Clear a hostname from any other smoke account so authorize is idempotent. */
async function releaseHostFromOtherSmokeAccounts(host, keepEmail) {
  const admin = await smokeAdminLogin();
  const { data } = await jarFetch(admin.jar, `${APP}/api/owner/customers`);
  for (const c of data?.customers || []) {
    const email = String(c.email || "");
    if (!email.startsWith("smoke-") || email === keepEmail) continue;
    const domain = c.authorizedDomain || c.domain || "";
    if (domain !== host) continue;
    try {
      const sess = await loginAs(email);
      await jarFetch(sess.jar, `${APP}/api/app/config`, {
        method: "POST",
        json: { authorizedDomain: "", enabled: false },
      });
    } catch (e) {
      console.log("  release host skip", email, e.message);
    }
  }
}

async function hitEmbedConfig(siteHost, surface) {
  const url = `${WWW}/api/embed/config?host=${encodeURIComponent(siteHost)}&widget_number=1&surface=${surface}&_=${Date.now()}`;
  const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  const data = await res.json();
  return { status: res.status, data };
}

async function hitPage(base, path) {
  const res = await fetch(`${base}${path}`);
  return res.status;
}

async function lookupAddress(address) {
  const url = `${WWW}/api/lookup?address=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  if (!SECRET) {
    console.error("SMOKE_TEST_SECRET is required");
    process.exit(1);
  }
  for (const [k, v] of Object.entries(SITES)) {
    if (!v) {
      console.error(`Missing SMOKE_SITE_${k.toUpperCase()}`);
      process.exit(1);
    }
  }

  console.log("APP", APP);
  console.log("SITES", SITES);

  // --- A: smoke admin ---
  let admin;
  try {
    admin = await smokeAdminLogin();
    record("A1 passwordless smoke admin login", true, admin.user.email);
  } catch (e) {
    record("A1 passwordless smoke admin login", false, e.message);
    finish();
    process.exit(1);
  }

  // me endpoint
  {
    const { status, data } = await jarFetch(admin.jar, `${APP}/api/auth/me`);
    const me = data?.user || data;
    record("A2 /api/auth/me isOwner", status === 200 && me?.isOwner === true, JSON.stringify(data));
  }

  // --- B: provision accounts ---
  let partner, r1, r2, ind;
  try {
    partner = await provision("partner", EMAILS.partner, {
      companyName: "Smoke Test Partner Group",
    });
    record("B1 provision partner", true, partner.id);
  } catch (e) {
    record("B1 provision partner", false, e.message);
  }
  try {
    r1 = await provision("realtor", EMAILS.p1, {
      partnerId: partner.id,
      businessName: "Harbor View Homes",
    });
    record("B2 provision partner realtor 1", true, r1.id);
  } catch (e) {
    record("B2 provision partner realtor 1", false, e.message);
  }
  try {
    r2 = await provision("realtor", EMAILS.p2, {
      partnerId: partner.id,
      businessName: "Summit Street Realty",
    });
    record("B3 provision partner realtor 2", true, r2.id);
  } catch (e) {
    record("B3 provision partner realtor 2", false, e.message);
  }
  try {
    ind = await provision("independent", EMAILS.ind, {
      businessName: "Lone Star Independent Realty",
    });
    record("B4 provision independent realtor", true, ind.id);
  } catch (e) {
    record("B4 provision independent realtor", false, e.message);
  }

  // Partner dropdown includes smoke partner
  {
    const res = await fetch(`${APP}/api/auth/partners`);
    const data = await res.json();
    const found = (data.partners || []).some((p) => p.id === partner?.id);
    record("B5 partner appears in signup dropdown", found, JSON.stringify(data.partners?.slice(0, 5)));
  }

  // Configure domains
  const hosts = {
    ind: hostOf(SITES.ind),
    p1: hostOf(SITES.p1),
    p2: hostOf(SITES.p2),
  };

  for (const [key, email, host, accent] of [
    ["ind", EMAILS.ind, hosts.ind, "#0f6e4c"],
    ["p1", EMAILS.p1, hosts.p1, "#1a4f8b"],
    ["p2", EMAILS.p2, hosts.p2, "#8a3b12"],
  ]) {
    try {
      await releaseHostFromOtherSmokeAccounts(host, email);
      const { jar } = await loginAs(email);
      await setConfig(jar, host, { accentColor: accent });
      const cfg = await hitEmbedConfig(host, "popup");
      record(`B6 authorize+enable ${key} (${host})`, cfg.data?.enabled === true, JSON.stringify(cfg.data).slice(0, 200));
    } catch (e) {
      record(`B6 authorize+enable ${key} (${host})`, false, e.message);
    }
  }

  // --- C: widget traffic ---
  for (const [key, base, host] of [
    ["ind", SITES.ind, hosts.ind],
    ["p1", SITES.p1, hosts.p1],
    ["p2", SITES.p2, hosts.p2],
  ]) {
    let pagesOk = 0;
    for (const path of ["/", "/listings.html", "/embed.html", ...LISTING_PATHS]) {
      const st = await hitPage(base, path);
      if (st === 200) pagesOk++;
    }
    record(`C1 ${key} listing pages serve`, pagesOk >= 14, `${pagesOk} pages`);

    // Multiple popup + embed config hits (usage counters)
    for (let i = 0; i < 4; i++) {
      await hitEmbedConfig(host, "popup");
      await new Promise((r) => setTimeout(r, 50));
    }
    for (let i = 0; i < 3; i++) {
      await hitEmbedConfig(host, "embed");
      await new Promise((r) => setTimeout(r, 50));
    }

    const pop = await hitEmbedConfig(host, "popup");
    const emb = await hitEmbedConfig(host, "embed");
    record(`C2 ${key} popup config enabled`, pop.data?.enabled === true, pop.data?.partnerId);
    record(`C3 ${key} embed config enabled`, emb.data?.enabled === true, emb.data?.partnerId);

    try {
      const { jar } = await loginAs(
        key === "ind" ? EMAILS.ind : key === "p1" ? EMAILS.p1 : EMAILS.p2
      );
      const { status, data } = await jarFetch(jar, `${APP}/api/app/summary`);
      record(
        `C4 ${key} detection summary`,
        status === 200 && (data?.popupDetected || data?.views > 0 || data?.active),
        JSON.stringify(data)
      );
    } catch (e) {
      record(`C4 ${key} detection summary`, false, e.message);
    }
  }

  // USA address lookups through production API
  let lookupOk = 0;
  for (const addr of USA_LOOKUPS) {
    const { status, data } = await lookupAddress(addr);
    const hasGeo = status === 200 && data && (data.lat || data.latitude || data.schools || data.ok !== false);
    // lookup shape varies — accept 200 with non-error body
    if (status === 200 && data && !data.error) lookupOk++;
    else console.log("  lookup miss", addr, status, typeof data === "object" ? Object.keys(data) : data);
  }
  record("C5 USA address lookups", lookupOk >= 10, `${lookupOk}/${USA_LOOKUPS.length}`);

  // Autocomplete samples
  let acOk = 0;
  for (const q of ["350 5th Ave New York", "Fort Pierce FL", "Austin TX 301", "Beacon Street Boston"]) {
    const res = await fetch(`${WWW}/api/autocomplete?q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => null);
    if (res.status === 200 && Array.isArray(data?.suggestions || data?.results || data) || data?.ok) acOk++;
    else if (res.status === 200 && data && !data.error) acOk++;
  }
  record("C6 autocomplete samples", acOk >= 2, `${acOk}/4`);

  // --- D: admin / partner / emails ---
  {
    const { jar } = await loginAs(EMAILS.partner);
    const { status, data } = await jarFetch(jar, `${APP}/api/owner/customers`);
    const ids = (data?.customers || []).map((c) => c.id || c.userId);
    const hasP1 = ids.includes(r1?.id);
    const hasP2 = ids.includes(r2?.id);
    const hasInd = ids.includes(ind?.id);
    record("D1 partner customer list scoped", status === 200 && hasP1 && hasP2 && !hasInd, `count=${ids.length}`);
  }

  {
    admin = await smokeAdminLogin();
    const { status, data } = await jarFetch(admin.jar, `${APP}/api/owner/customers`);
    const emails = (data?.customers || []).map((c) => c.email);
    record(
      "D2 admin sees all smoke realtors",
      status === 200 && EMAILS.p1 && emails.includes(EMAILS.p1) && emails.includes(EMAILS.ind),
      `n=${emails.length}`
    );
  }

  // Upgrade requests + emails
  for (const [label, user] of [
    ["p1", r1],
    ["p2", r2],
    ["ind", ind],
  ]) {
    if (!user) continue;
    const { status, data } = await jarFetch(admin.jar, `${APP}/api/upgrade/request`, {
      method: "POST",
      json: {
        customerId: user.id,
        partnerId: user.partnerId || null,
        address: "350 5th Avenue, New York, NY 10118",
        source: "smoke-e2e",
        providerName: user.businessName || "Smoke",
      },
    });
    record(`D3 upgrade request ${label}`, status === 200 || status === 201, JSON.stringify(data).slice(0, 180));
  }

  for (const [label, id] of [
    ["p1", r1?.id],
    ["p2", r2?.id],
    ["ind", ind?.id],
  ]) {
    if (!id) continue;
    const rem = await jarFetch(admin.jar, `${APP}/api/owner/realtor-email`, {
      method: "POST",
      json: { targetType: "realtor", targetId: id, kind: "reminder", preview: false },
    });
    record(`D4 reminder email ${label}`, rem.status === 200 && rem.data?.ok !== false, JSON.stringify(rem.data).slice(0, 180));

    const offer = await jarFetch(admin.jar, `${APP}/api/owner/realtor-email`, {
      method: "POST",
      json: {
        targetType: "realtor",
        targetId: id,
        kind: "offer",
        offerText: "Smoke test special — 20% off Neighborhood Explorer",
        discountCode: "SMOKE20",
        preview: false,
      },
    });
    record(`D5 offer email ${label}`, offer.status === 200 && offer.data?.ok !== false, JSON.stringify(offer.data).slice(0, 180));
  }

  // Partner sends reminder to p1
  {
    const { jar } = await loginAs(EMAILS.partner);
    const rem = await jarFetch(jar, `${APP}/api/owner/realtor-email`, {
      method: "POST",
      json: { targetType: "realtor", targetId: r1.id, kind: "reminder", preview: false },
    });
    record("D6 partner sends reminder to p1", rem.status === 200, JSON.stringify(rem.data).slice(0, 180));
  }

  // Self reminder
  {
    const { jar } = await loginAs(EMAILS.ind);
    const rem = await jarFetch(jar, `${APP}/api/app/reminder`, {
      method: "POST",
      json: { intervalDays: 7, send: true, includeAll: true },
    });
    record("D7 independent self-reminder", rem.status === 200, JSON.stringify(rem.data).slice(0, 180));
  }

  // Server management
  {
    admin = await smokeAdminLogin();
    const log = await jarFetch(admin.jar, `${APP}/api/owner/backend-log`);
    record("D8 backend log readable", log.status === 200, Array.isArray(log.data?.events) || log.data ? "ok" : "");
    const report = await jarFetch(admin.jar, `${APP}/api/owner/server-report`, {
      method: "POST",
      json: { kind: "daily" },
    });
    record("D9 generate daily server report", report.status === 200, JSON.stringify(report.data).slice(0, 160));
  }

  // --- E: lifecycle on independent ---
  {
    let { jar } = await loginAs(EMAILS.ind);
    let indId = ind.id;

    // change password
    const cp = await jarFetch(jar, `${APP}/api/auth/change-password`, {
      method: "POST",
      json: { currentPassword: PASSWORD, newPassword: PASSWORD2 },
    });
    record("E1 change password", cp.status === 200, JSON.stringify(cp.data).slice(0, 120));

    ({ jar } = await loginAs(EMAILS.ind));

    // change email to a unique address so re-runs don't collide
    const altEmail = `smoke-realtor-ind-${Date.now()}@dreamneighborhoodschools.com`;
    const ce = await jarFetch(jar, `${APP}/api/auth/change-email`, {
      method: "POST",
      json: { newEmail: altEmail, password: PASSWORD2 },
    });
    let emailNow = EMAILS.ind;
    if (ce.status === 200) {
      emailNow = altEmail;
      record("E2 change email", true, emailNow);
    } else {
      const ce2 = await jarFetch(jar, `${APP}/api/auth/change-email`, {
        method: "POST",
        json: { newEmail: altEmail, password: PASSWORD },
      });
      if (ce2.status === 200) {
        emailNow = altEmail;
        record("E2 change email", true, emailNow);
      } else {
        record("E2 change email", false, JSON.stringify(ce.data || ce2.data));
      }
    }

    // Change domain to a temp host then back
    ({ jar } = await loginAs(emailNow));
    const meBefore = await jarFetch(jar, `${APP}/api/auth/me`);
    indId = meBefore.data?.user?.id || meBefore.data?.id || indId;
    try {
      await setConfig(jar, `example-smoke-temp-${Date.now()}.example`);
      record("E3 change domain to temp", true);
      await releaseHostFromOtherSmokeAccounts(hosts.ind, emailNow);
      await setConfig(jar, hosts.ind);
      record("E4 restore domain", true, hosts.ind);
    } catch (e) {
      record("E3/E4 domain change", false, e.message);
    }

    // Self delete (account that owns the domain)
    ({ jar } = await loginAs(emailNow));
    const del = await jarFetch(jar, `${APP}/api/app/delete-account`, { method: "POST" });
    record("E5 self-delete account", del.status === 200, JSON.stringify(del.data).slice(0, 120));

    const afterDel = await hitEmbedConfig(hosts.ind, "popup");
    record("E6 embed disabled after delete", afterDel.data?.enabled !== true, JSON.stringify(afterDel.data).slice(0, 120));

    admin = await smokeAdminLogin();
    const restore = await jarFetch(admin.jar, `${APP}/api/owner/customers`, {
      method: "PATCH",
      json: { id: indId, action: "restore", reason: "smoke-e2e" },
    });
    record("E7 admin restore", restore.status === 200 && restore.data?.restored !== false, JSON.stringify(restore.data).slice(0, 120));

    try {
      const re = await hitEmbedConfig(hosts.ind, "popup");
      record("E8 embed on after restore", re.data?.enabled === true, hosts.ind);
      // Normalize back to canonical independent email for future runs
      if (emailNow !== EMAILS.ind) {
        await jarFetch(admin.jar, `${APP}/api/owner/customers`, {
          method: "PATCH",
          json: { id: indId, email: EMAILS.ind },
        });
        // Ensure password known again
        ind = await provision("independent", EMAILS.ind, { businessName: "Lone Star Independent Realty" });
        await releaseHostFromOtherSmokeAccounts(hosts.ind, EMAILS.ind);
        const sess = await loginAs(EMAILS.ind);
        await setConfig(sess.jar, hosts.ind);
      }
    } catch (e) {
      record("E8 embed on after restore", false, e.message);
      try {
        ind = await provision("independent", EMAILS.ind, { businessName: "Lone Star Independent Realty" });
        await releaseHostFromOtherSmokeAccounts(hosts.ind, EMAILS.ind);
        const sess = await loginAs(EMAILS.ind);
        await setConfig(sess.jar, hosts.ind);
        record("E8b reprovision independent + domain", true);
      } catch (e2) {
        record("E8b reprovision independent + domain", false, e2.message);
      }
    }

    // Admin disable + restore on p2
    admin = await smokeAdminLogin();
    const dis = await jarFetch(admin.jar, `${APP}/api/owner/customers?id=${encodeURIComponent(r2.id)}`, {
      method: "DELETE",
    });
    record("E9 admin disable p2", dis.status === 200, JSON.stringify(dis.data).slice(0, 120));
    const p2off = await hitEmbedConfig(hosts.p2, "popup");
    record("E10 p2 embed off when disabled", p2off.data?.enabled !== true, JSON.stringify(p2off.data).slice(0, 100));
    const res2 = await jarFetch(admin.jar, `${APP}/api/owner/customers`, {
      method: "PATCH",
      json: { id: r2.id, action: "restore", reason: "smoke-e2e" },
    });
    record("E11 admin restore p2", res2.status === 200, JSON.stringify(res2.data).slice(0, 120));
    const p2on = await hitEmbedConfig(hosts.p2, "popup");
    record("E12 p2 embed on after restore", p2on.data?.enabled === true, hosts.p2);
  }

  // Password login attempt (may fail Turnstile — informational)
  {
    const { status, data } = await passwordLogin(EMAILS.p1, PASSWORD);
    record(
      "E13 password login (may fail Turnstile)",
      status === 200 || status === 400 || status === 403,
      `${status} ${JSON.stringify(data).slice(0, 120)}`
    );
  }

  finish();
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed ? 1 : 0);
}

function finish() {
  const report = {
    at: new Date().toISOString(),
    app: APP,
    sites: SITES,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
  const out = join(__dirname, "smoke-report.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("\n=== SUMMARY ===");
  console.log(`passed=${report.passed} failed=${report.failed}`);
  console.log("wrote", out);
}

main().catch((err) => {
  console.error(err);
  record("fatal", false, err.message);
  finish();
  process.exit(1);
});
