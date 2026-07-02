"use client";

import { useEffect, useState } from "react";
import { SchoolhouseMark } from "@/components/Logo";

export default function ResetPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
    setEmail(params.get("email") || "");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not reset your password.");
        return;
      }
      window.location.href = json.isOwner ? "/owner" : "/dashboard";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-center gap-2">
          <SchoolhouseMark className="h-7 w-7 rounded" />
          <span className="font-extrabold text-brand-700">Dream Neighborhood Schools</span>
        </div>
        <h1 className="text-center text-xl font-extrabold text-ink-900">Choose a new password</h1>

        {!token ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-700">
            This reset link is missing its token. Please use the link from your email, or request a new one.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4">
            {/* Username field for password managers to associate the new
                credential with the right account. */}
            <label className="block text-xs font-bold text-slate-600">Email</label>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={Boolean(email)}
              placeholder="you@agency.com"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            <div className="mt-3 flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-600">New password</label>
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            <input
              type={showPw ? "text" : "password"}
              name="new-password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            <label className="mt-3 block text-xs font-bold text-slate-600">Confirm password</label>
            <input
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="mt-5 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "…" : "Set new password →"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
