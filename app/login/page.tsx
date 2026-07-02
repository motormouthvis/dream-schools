"use client";

import { useEffect, useState } from "react";
import { SchoolhouseMark } from "@/components/Logo";

type Mode = "signup" | "login" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [partner, setPartner] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | "verify" | "reset">(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("partner") || "";
    if (p) {
      setPartner(p);
      setMode("signup");
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "reset") {
        await fetch("/api/auth/request-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        // Always show success (we don't reveal whether the email exists).
        setSent("reset");
        return;
      }
      const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, partner }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Something went wrong.");
        return;
      }
      if (mode === "signup") {
        setSent("verify");
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
            {sent === "verify" ? (
              <>We sent a verification link to <strong>{email}</strong>. Click it to activate your free account.</>
            ) : (
              <>If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.</>
            )}
          </p>
          <button
            onClick={() => { setSent(null); switchMode("login"); }}
            className="mt-5 text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            Back to log in
          </button>
        </div>
      </Wrap>
    );
  }

  const title =
    mode === "signup" ? "Create your free account" : mode === "login" ? "Welcome back" : "Reset your password";

  return (
    <Wrap>
      <h1 className="text-center text-xl font-extrabold text-ink-900">{title}</h1>
      <p className="mt-1 text-center text-[13px] text-slate-500">
        Free forever · <strong className="font-extrabold text-brand-700">No Credit Card — Ever</strong>
      </p>
      {partner && mode === "signup" && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-center text-[12px] font-semibold text-brand-700">
          Partner signup link applied.
        </p>
      )}

      {mode !== "reset" && (
        <div className="mt-5 inline-flex w-full rounded-full bg-slate-100 p-0.5 text-sm font-semibold">
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`flex-1 rounded-full py-1.5 transition ${mode === "signup" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 rounded-full py-1.5 transition ${mode === "login" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}
          >
            Log in
          </button>
        </div>
      )}

      <form onSubmit={submit} className="mt-4">
        <label className="block text-xs font-bold text-slate-600">Email</label>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@agency.com"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />

        {mode !== "reset" && (
          <>
            <div className="mt-3 flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-600">Password</label>
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
              name="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            {mode === "login" && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className="text-[12px] font-semibold text-slate-500 hover:text-brand-700"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </>
        )}

        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy
            ? "…"
            : mode === "signup"
            ? "Create account →"
            : mode === "login"
            ? "Log in →"
            : "Send reset link →"}
        </button>
      </form>

      {mode === "reset" ? (
        <p className="mt-3 text-center text-[12px] text-slate-400">
          Remembered it?{" "}
          <button onClick={() => switchMode("login")} className="font-semibold text-brand-700 hover:text-brand-800">
            Back to log in
          </button>
        </p>
      ) : (
        <p className="mt-3 text-center text-[11px] text-slate-400">
          {mode === "signup" ? "We'll email you a verification link. No credit card." : "Verified accounts only."}
        </p>
      )}
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
