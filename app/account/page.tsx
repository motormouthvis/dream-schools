"use client";

import { useState } from "react";
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

          <div className="mt-4 max-w-md space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email</div>
              <div className="mt-1 break-all text-sm text-ink-900">{me.email}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Date created</div>
              <div className="mt-1 text-sm text-ink-900">{fmtDate(me.createdAt)}</div>
            </div>
          </div>

          {(me.isPartner || me.isOwner) && (
            <PartnerDesignation initialCompanyName={me.companyName || ""} isPartner={me.isPartner} />
          )}
          <ChangeEmail currentEmail={me.email} />
          <ChangePassword email={me.email} />
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
    <Card title="Partner Designation">
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
          {busy ? "Saving…" : "Save partner details"}
        </button>
      </form>
    </Card>
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
        <button type="submit" disabled={busy} className={btn}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </Card>
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
    <div className="mt-4 max-w-md rounded-xl border border-slate-200 bg-white p-4">
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
