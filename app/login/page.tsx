"use client";

import { useState } from "react";
import { SchoolhouseMark } from "@/components/Logo";

export default function LoginPage() {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Something went wrong.");
        return;
      }
      if (mode === "signup") {
        setSent(true);
      } else {
        window.location.href = json.isOwner ? "/owner" : "/dashboard";
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Wrap>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">✉️</div>
          <h1 className="text-xl font-extrabold text-ink-900">Check your email</h1>
          <p className="mt-2 text-sm text-slate-600">
            We sent a verification link to <strong>{email}</strong>. Click it to activate your free
            account.
          </p>
          <button
            onClick={() => { setSent(false); setMode("login"); }}
            className="mt-5 text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            Back to log in
          </button>
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <h1 className="text-center text-xl font-extrabold text-ink-900">
        {mode === "signup" ? "Create your free account" : "Welcome back"}
      </h1>
      <p className="mt-1 text-center text-[13px] text-slate-500">
        Free forever · <strong className="font-extrabold text-brand-700">No Credit Card — Ever</strong>
      </p>

      <div className="mt-5 inline-flex w-full rounded-full bg-slate-100 p-0.5 text-sm font-semibold">
        <button
          type="button"
          onClick={() => { setMode("signup"); setError(null); }}
          className={`flex-1 rounded-full py-1.5 transition ${mode === "signup" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}
        >
          Sign up
        </button>
        <button
          type="button"
          onClick={() => { setMode("login"); setError(null); }}
          className={`flex-1 rounded-full py-1.5 transition ${mode === "login" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}
        >
          Log in
        </button>
      </div>

      <form onSubmit={submit} className="mt-4">
        <label className="block text-xs font-bold text-slate-600">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@agency.com"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        <label className="mt-3 block text-xs font-bold text-slate-600">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "…" : mode === "signup" ? "Create account →" : "Log in →"}
        </button>
      </form>
      <p className="mt-3 text-center text-[11px] text-slate-400">
        {mode === "signup" ? "We'll email you a verification link. No credit card." : "Verified accounts only."}
      </p>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-center gap-2">
          <SchoolhouseMark className="h-7 w-7 rounded" />
          <span className="font-extrabold text-brand-700">Dream Neighborhood Schools</span>
        </div>
        {children}
      </div>
    </main>
  );
}
