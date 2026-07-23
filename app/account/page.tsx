"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { UPGRADE_PROMPT_LIMITS } from "@/lib/upgradeLimits";
import {
  DEFAULT_NEIGHBORHOOD_EXPLORER_GRACE_MS,
  NEIGHBORHOOD_EXPLORER_GRACE_MS_MIN,
  NEIGHBORHOOD_EXPLORER_GRACE_MS_MAX,
} from "@/lib/embedSettingsShared";

function fmtDate(v?: string): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/login";
}

export default function AccountPage() {
  return (
    <AppShell active="account">
      {(me) => (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-ink-900">Account Settings</h1>
              <p className="text-[12px] text-slate-500">Your sign-in details.</p>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>

          <div className="mt-4 grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Date created</div>
              <div className="mt-1 text-sm text-ink-900">{fmtDate(me.createdAt)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email</div>
              <div className="mt-1 break-all text-sm text-ink-900">{me.email}</div>
            </div>
            {!me.isPartner && !me.isOwner && (
              <RealtorNameProfile initialRealtorName={me.companyName || ""} />
            )}
            <WhiteLabelProfile
              initialBusinessName={me.businessName || ""}
              inheritedWhiteLabel={me.inheritedWhiteLabel || ""}
              isPartner={me.isPartner}
              isCustomer={!me.isPartner && !me.isOwner}
            />
            {me.isPartner && <PartnerSignupLink partnerId={me.id} />}
            {me.isPartner && (
              <PartnerDesignation initialCompanyName={me.companyName || ""} isPartner={me.isPartner} />
            )}
            {(me.isOwner || me.isPartner) && (
              <UpgradePromptSettings isOwner={me.isOwner} isPartner={me.isPartner} />
            )}
            {(me.isOwner || me.isPartner) && <CustomerDefaultColorSettings />}
            {(me.isOwner || me.isPartner) && <CustomerLoginEmailSettings />}
            {me.isOwner && <NeighborhoodExplorerGraceSettings />}
            <ChangeEmail currentEmail={me.email} />
            <ChangePassword email={me.email} />
            <AccountHistory />
            {!me.isOwner && <DeleteAccount />}
          </div>
        </>
      )}
    </AppShell>
  );
}

function PartnerDesignation({
  initialCompanyName,
  isPartner,
}: {
  initialCompanyName: string;
  isPartner: boolean;
}) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      const res = await fetch("/api/auth/partner-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save partner details.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Partner Name">
      <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-[12px] text-brand-800">
        {isPartner
          ? "This account is a Partner. Customers who sign up through your Partner Login link will be associated with your account."
          : "Admin account: you can set a company name here if needed, but partner branding applies to accounts marked Partner."}
      </div>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-600">Partner company name</label>
          <input
            className={inp}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Your Company Name"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Used for your Partner Login signup list and as a fallback banner name when White Label is
            blank for you or your realtors. The popup/embed banner uses White Label first.
          </p>
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Partner details saved ✓</p>}
        <button type="submit" disabled={busy} className={btn}>
          {busy ? "Saving…" : "Save partner name"}
        </button>
      </form>
    </Card>
  );
}

function PartnerSignupLink({ partnerId }: { partnerId: string }) {
  const [copied, setCopied] = useState(false);
  const link =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/login?partner=${encodeURIComponent(partnerId)}`;

  async function copy() {
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card title="Partner Signup Link">
      <p className="text-[12px] leading-relaxed text-slate-500">
        Copy this link and email it to your Realtor clients. Anyone who signs up with it is
        automatically connected to your Partner account.
      </p>
      <div className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-[12px] leading-relaxed text-brand-800">
        Suggested message: “Click here to add free school data to your website — no credit card,
        full-feature school data free forever, zero website redesign.”
      </div>
      <div className="mt-3 flex gap-2">
        <input readOnly value={link} className={`${inp} font-mono text-[12px]`} />
        <button type="button" onClick={copy} className="shrink-0 rounded-lg border border-brand-600 px-3 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </Card>
  );
}

function RealtorNameProfile({ initialRealtorName }: { initialRealtorName: string }) {
  const [realtorName, setRealtorName] = useState(initialRealtorName);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      const res = await fetch("/api/auth/realtor-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realtorName }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save realtor name.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Realtor Name">
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-600">Your name</label>
          <input
            className={inp}
            value={realtorName}
            onChange={(e) => setRealtorName(e.target.value)}
            placeholder="Jane Doe or Coastal Realty"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Shown in your account and upgrade-request emails. This is not the popup/embed banner name
            — use White Label for that.
          </p>
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Realtor name saved ✓</p>}
        <button type="submit" disabled={busy} className={btn}>
          {busy ? "Saving…" : "Save realtor name"}
        </button>
      </form>
    </Card>
  );
}

function WhiteLabelProfile({
  initialBusinessName,
  inheritedWhiteLabel,
  isPartner,
  isCustomer,
}: {
  initialBusinessName: string;
  inheritedWhiteLabel: string;
  isPartner: boolean;
  isCustomer: boolean;
}) {
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      const res = await fetch("/api/auth/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save white-label name.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const effective =
    (businessName || "").trim() || (isCustomer ? inheritedWhiteLabel : "") || "";

  return (
    <Card title="White Label Name">
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-600">Your white-label name</label>
          <input
            className={inp}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="your company name"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            {isPartner
              ? "Shown on the popup and embed banner: Dream Neighborhood School Explorer provided by …. Also the default for your realtors when they leave White Label blank."
              : isCustomer
                ? inheritedWhiteLabel
                  ? `Leave blank to use your partner’s name (“${inheritedWhiteLabel}”). Enter your own to override it on the popup/embed banner.`
                  : "Shown on the popup and embed banner: Dream Neighborhood School Explorer provided by …. Leave blank for no “provided by” line."
                : "Shown on the popup and embed banner: Dream Neighborhood School Explorer provided by …."}
          </p>
          {effective ? (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              Banner preview:{" "}
              <span className="font-semibold text-ink-900">
                Dream Neighborhood School Explorer provided by {effective}
              </span>
              {!businessName.trim() && isCustomer && inheritedWhiteLabel ? (
                <span className="text-slate-400"> (from your partner)</span>
              ) : null}
            </p>
          ) : null}
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">White-label name saved ✓</p>}
        <button type="submit" disabled={busy} className={btn}>
          {busy ? "Saving…" : "Save white-label name"}
        </button>
      </form>
    </Card>
  );
}

function CustomerLoginEmailSettings() {
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [defaultText, setDefaultText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/customer-defaults")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          if (typeof j.loginEmailText === "string") setText(j.loginEmailText);
          if (typeof j.defaultLoginEmailText === "string") setDefaultText(j.defaultLoginEmailText);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      const res = await fetch("/api/auth/customer-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginEmailText: text }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save the email text.");
        return;
      }
      if (typeof j.loginEmailText === "string") setText(j.loginEmailText);
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Customer login link email">
      <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
        The message in the branded email sent when you use <strong>Send login link</strong> on the
        Customer List. The email includes a secure button for the realtor to set a password and manage
        their School Explorer. Use <code className="rounded bg-slate-100 px-1">{"{company}"}</code> for
        your business name. Leave blank to use the default.
      </p>
      {!loaded ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <textarea
            rows={5}
            className={`${inp} resize-y`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={defaultText}
          />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className={btn}>
              {busy ? "Saving…" : "Save email text"}
            </button>
            {text.trim() !== "" && (
              <button
                type="button"
                onClick={() => setText("")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Reset to default
              </button>
            )}
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Email text saved ✓</p>}
        </form>
      )}
    </Card>
  );
}

const DEFAULT_WIDGET_COLOR = "#1fa55f";

function CustomerDefaultColorSettings() {
  const [loaded, setLoaded] = useState(false);
  const [color, setColor] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/customer-defaults")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j.accentColor === "string") setColor(j.accentColor);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const effective = /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_WIDGET_COLOR;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      const res = await fetch("/api/auth/customer-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accentColor: color.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save the default color.");
        return;
      }
      if (typeof j.accentColor === "string") setColor(j.accentColor);
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Default widget color for new customers">
      <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
        The accent color applied to the School Explorer for every new customer you add or import.
        Existing customers aren&apos;t changed, and each can still override their own color in
        Configure Explorer. Leave blank to use the standard green.
      </p>
      {!loaded ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Pick default color"
              value={effective}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
            />
            <input
              className={inp}
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder={DEFAULT_WIDGET_COLOR}
              spellCheck={false}
            />
            {color.trim() !== "" && (
              <button
                type="button"
                onClick={() => setColor("")}
                className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
            )}
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Default color saved ✓</p>}
          <button type="submit" disabled={busy} className={btn}>
            {busy ? "Saving…" : "Save default color"}
          </button>
        </form>
      )}
    </Card>
  );
}

function NeighborhoodExplorerGraceSettings() {
  const [loaded, setLoaded] = useState(false);
  const [graceMs, setGraceMs] = useState(String(DEFAULT_NEIGHBORHOOD_EXPLORER_GRACE_MS));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/embed-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.neighborhoodExplorerGraceMs != null) {
          setGraceMs(String(j.neighborhoodExplorerGraceMs));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      const res = await fetch("/api/auth/embed-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ neighborhoodExplorerGraceMs: graceMs }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save settings.");
        return;
      }
      if (j.neighborhoodExplorerGraceMs != null) {
        setGraceMs(String(j.neighborhoodExplorerGraceMs));
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="School popup ↔ Neighborhood Explorer">
      <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
        When both widgets are on a page, the School popup waits this long for Neighborhood
        Explorer to signal that it is actually showing. If the signal arrives (then or later),
        the School popup hides. If it never arrives, the School popup shows after the wait.
        Applies globally to all sites. Admin only.
      </p>
      {!loaded ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <NumberField
            label="Grace period (milliseconds)"
            value={graceMs}
            onChange={setGraceMs}
            min={NEIGHBORHOOD_EXPLORER_GRACE_MS_MIN}
            max={NEIGHBORHOOD_EXPLORER_GRACE_MS_MAX}
          />
          <p className="text-[11px] text-slate-400">
            Default {DEFAULT_NEIGHBORHOOD_EXPLORER_GRACE_MS}ms. Don&apos;t set much below 3000ms —
            Neighborhood Explorer needs a config fetch and geocode before it can signal.
          </p>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {done && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Grace period saved ✓
            </p>
          )}
          <button type="submit" disabled={busy} className={btn}>
            {busy ? "Saving…" : "Save grace period"}
          </button>
        </form>
      )}
    </Card>
  );
}

function UpgradePromptSettings({ isOwner, isPartner }: { isOwner: boolean; isPartner: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [views, setViews] = useState("2");
  const [days, setDays] = useState("7");
  const [idle, setIdle] = useState("8");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/upgrade-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        const src = isOwner ? j.global : {
          viewsToTrigger: j.partnerOverride?.viewsToTrigger ?? j.global?.viewsToTrigger,
          minDaysBetween: j.partnerOverride?.minDaysBetween ?? j.global?.minDaysBetween,
          idleSeconds: j.partnerOverride?.idleSeconds ?? j.global?.idleSeconds,
        };
        setViews(String(src?.viewsToTrigger ?? 2));
        setDays(String(src?.minDaysBetween ?? 7));
        setIdle(String(src?.idleSeconds ?? 8));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [isOwner]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      const res = await fetch("/api/auth/upgrade-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: isPartner && !isOwner ? "partner" : "global",
          viewsToTrigger: views,
          minDaysBetween: days,
          idleSeconds: idle,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save prompt settings.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={isOwner ? "Upgrade Prompt Defaults" : "Upgrade Prompt Settings"}>
      <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
        Controls when the Neighborhood Explorer Upgrade prompt appears. It only appears during an idle break, never while a visitor is actively clicking or scrolling. If they request the Upgrade, it is suppressed for 90 days. Set minimum days to 0 for testing/repeated requests.
      </p>
      {!loaded ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField
              label="Views to trigger"
              value={views}
              onChange={setViews}
              min={UPGRADE_PROMPT_LIMITS.viewsToTrigger.min}
              max={UPGRADE_PROMPT_LIMITS.viewsToTrigger.max}
            />
            <NumberField
              label="Minimum days between prompts"
              value={days}
              onChange={setDays}
              min={UPGRADE_PROMPT_LIMITS.minDaysBetween.min}
              max={UPGRADE_PROMPT_LIMITS.minDaysBetween.max}
            />
            <NumberField
              label="Idle seconds before showing"
              value={idle}
              onChange={setIdle}
              min={UPGRADE_PROMPT_LIMITS.idleSeconds.min}
              max={UPGRADE_PROMPT_LIMITS.idleSeconds.max}
            />
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Prompt settings saved ✓</p>}
          <button type="submit" disabled={busy} className={btn}>
            {busy ? "Saving…" : "Save prompt settings"}
          </button>
        </form>
      )}
    </Card>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
}) {
  // Enforce the maximum as the user types: typing a larger number snaps to max.
  // The minimum is applied on blur so intermediate keystrokes stay editable.
  function handleChange(raw: string) {
    if (raw === "") {
      onChange("");
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(n > max ? String(max) : raw);
  }
  function handleBlur() {
    const n = Number(value);
    if (value === "" || !Number.isFinite(n)) {
      onChange(String(min));
      return;
    }
    onChange(String(Math.max(min, Math.min(max, Math.floor(n)))));
  }
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-600">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className={inp}
      />
      <span className="mt-1 block text-[11px] text-slate-400">
        Min {min}, max {max}
      </span>
    </label>
  );
}

function ChangeEmail({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not change your email.");
        return;
      }
      setDone(true);
      // Reload so the sidebar / header reflect the new email.
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Change email"
      action={
        <button
          type="button"
          onClick={() => setShowPw((s) => !s)}
          className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
        >
          {showPw ? "Hide" : "Show"}
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <input type="email" name="username" autoComplete="username" value={currentEmail} readOnly hidden />
        <div>
          <label className="block text-xs font-bold text-slate-600">New email</label>
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@agency.com"
            className={inp}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600">Current password</label>
          <input
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Required to change your email"
            className={inp}
          />
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Email updated ✓</p>}
        <button type="submit" disabled={busy} className={btn}>
          {busy ? "Saving…" : "Update email"}
        </button>
      </form>
    </Card>
  );
}

function ChangePassword({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function forgotPassword() {
    setError(null);
    setResetSent(false);
    setResetBusy(true);
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Could not send a reset link.");
        return;
      }
      setResetSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResetBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (newPassword !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not change your password.");
        return;
      }
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Change password"
      action={
        <button
          type="button"
          onClick={() => setShowPw((s) => !s)}
          className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
        >
          {showPw ? "Hide" : "Show"}
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <input
          type={showPw ? "text" : "password"}
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          className={inp}
        />
        <input
          type={showPw ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (8+ characters)"
          className={inp}
        />
        <input
          type={showPw ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className={inp}
        />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Password updated ✓</p>}
        {resetSent && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            If an account exists for {email}, a reset link is on its way. Check your inbox.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={btn}>
            {busy ? "Saving…" : "Update password"}
          </button>
          <button
            type="button"
            onClick={forgotPassword}
            disabled={resetBusy}
            className="text-sm font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-60"
          >
            {resetBusy ? "Sending…" : "Forgot password?"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function AccountHistory() {
  const [events, setEvents] = useState<{ event: string; detail: string | null; createdAt: string }[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/history");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not load history.");
        return;
      }
      setEvents(json.events || []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && events === null) load();
  }

  return (
    <Card
      title="Account History"
      action={
        <button
          type="button"
          onClick={toggle}
          className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
        >
          {open ? "Hide" : "Show"}
        </button>
      }
    >
      {!open ? (
        <p className="text-[12px] text-slate-500">Account creation, email/password changes, and configuration updates.</p>
      ) : busy ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : !events || events.length === 0 ? (
        <p className="text-sm text-slate-400">No history yet.</p>
      ) : (
        <ul className="space-y-2">
          {[...events]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((e, i) => (
              <li key={i} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <div>
                  <div className="text-sm font-semibold text-ink-900">{EVENT_LABELS[e.event] || e.event}</div>
                  {e.detail && <div className="text-[11px] text-slate-500">{e.detail}</div>}
                </div>
                <div className="shrink-0 text-[11px] text-slate-400">{fmtDateTime(e.createdAt)}</div>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

const EVENT_LABELS: Record<string, string> = {
  account_created: "Account created",
  email_verified: "Email verified",
  email_changed: "Email changed",
  password_changed: "Password changed",
  password_reset: "Password reset",
  domain_changed: "Authorized domain changed",
  default_address_changed: "Default address changed",
  explorer_enabled_changed: "Explorer enabled/disabled",
  account_deleted: "Account disabled",
  account_restored: "Account restored",
  partner_assignment_changed: "Partner assignment changed",
  partner_status_changed: "Partner status changed",
};

function fmtDateTime(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function DeleteAccount() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/app/delete-account", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not delete your account.");
        return;
      }
      window.location.href = "/login";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 lg:col-span-2">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-3 w-1.5 rounded bg-rose-500" />
        <h2 className="text-sm font-bold text-rose-900">Delete My Account</h2>
      </div>
      <p className="text-[12px] leading-relaxed text-rose-800/80">
        This disables your account and signs you out. You will no longer be able to sign in, and any
        popup/embed on your website will stop working. Your data is retained — contact us if you ever
        want it re-enabled.
      </p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-bold text-rose-900">
            Type <span className="font-mono">DELETE</span> to confirm
          </label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            className="mt-1 w-full max-w-xs rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200"
          />
        </div>
        {error && <p className="rounded-lg bg-rose-100 px-3 py-2 text-xs text-rose-800">{error}</p>}
        <button
          type="submit"
          disabled={busy || confirm.trim().toUpperCase() !== "DELETE"}
          className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Delete my account"}
        </button>
      </form>
    </div>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <span className="h-3 w-1.5 rounded bg-brand-500" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
const btn =
  "rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60";
