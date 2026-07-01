"use client";

import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";

export default function AccountPage() {
  return (
    <AppShell active="account">
      {(me) => (
        <>
          <h1 className="text-xl font-extrabold text-ink-900">Account</h1>
          <p className="text-[12px] text-slate-500">Your sign-in details.</p>

          <div className="mt-4 max-w-md rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-bold text-slate-600">Email</div>
            <div className="mt-1 text-sm text-ink-900">{me.email}</div>
          </div>

          <ChangePassword />
        </>
      )}
    </AppShell>
  );
}

function ChangePassword() {
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
    <div className="mt-4 max-w-md rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <span className="h-3 w-1.5 rounded bg-brand-500" />
          Change password
        </h2>
        <button
          type="button"
          onClick={() => setShowPw((s) => !s)}
          className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
        >
          {showPw ? "Hide" : "Show"}
        </button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          type={showPw ? "text" : "password"}
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          className={inp}
        />
        <input
          type={showPw ? "text" : "password"}
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (8+ characters)"
          className={inp}
        />
        <input
          type={showPw ? "text" : "password"}
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className={inp}
        />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Password updated ✓</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
