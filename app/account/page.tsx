"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";

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
            <BusinessProfile initialBusinessName={me.businessName || ""} />
            {me.isPartner && <PartnerSignupLink partnerId={me.id} />}
            {me.isPartner && (
              <PartnerDesignation initialCompanyName={me.companyName || ""} isPartner={me.isPartner} />
            )}
            {(me.isOwner || me.isPartner) && (
              <UpgradePromptSettings isOwner={me.isOwner} isPartner={me.isPartner} />
            )}
            <ChangeEmail currentEmail={me.email} />
            <ChangePassword email={me.email} />
            <AccountHistory />
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
          <label className="block text-xs font-bold text-slate-600">Company name shown in popup/embed</label>
          <input
            className={inp}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Your Company Name"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Header text: Dream Neighborhood School Explorer provided by your company name.
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

function BusinessProfile({ initialBusinessName }: { initialBusinessName: string }) {
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
        setError(j.error || "Could not save business name.");
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
          <label className="block text-xs font-bold text-slate-600">
            Name used for personalization
          </label>
          <input
            className={inp}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Coastal Realty or Jane Doe"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Used in upgrade prompts and messages when available.
          </p>
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Business name saved ✓</p>}
        <button type="submit" disabled={busy} className={btn}>
          {busy ? "Saving…" : "Save business name"}
        </button>
      </form>
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
            <NumberField label="Views to trigger" value={views} onChange={setViews} min={1} />
            <NumberField label="Minimum days between prompts" value={days} onChange={setDays} min={0} />
            <NumberField label="Idle seconds before showing" value={idle} onChange={setIdle} min={3} />
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

function NumberField({ label, value, onChange, min }: { label: string; value: string; onChange: (v: string) => void; min: number }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-600">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inp}
      />
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
