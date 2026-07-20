"use client";

import { useEffect, useMemo, useState } from "react";
import { SchoolhouseMark } from "@/components/Logo";
import { Turnstile } from "@/components/app/Turnstile";

type Mode = "signup" | "login" | "reset";
type Partner = { id: string; name: string };

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [partner, setPartner] = useState("");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState<null | "verify" | "reset" | "setPassword">(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("partner") || "";
    if (p) {
      setPartner(p);
      setMode("signup");
    }
  }, []);

  // Load the public list of partners for the signup dropdown.
  useEffect(() => {
    fetch("/api/auth/partners")
      .then((r) => r.json())
      .then((j) => setPartners(Array.isArray(j.partners) ? j.partners : []))
      .catch(() => {});
  }, []);

  // When partners load, reflect a partner selected via a ?partner= link in the box.
  useEffect(() => {
    if (partner && !partnerSearch) {
      const match = partners.find((p) => p.id === partner);
      if (match) setPartnerSearch(match.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partners]);

  const filteredPartners = useMemo(() => {
    const q = partnerSearch.trim().toLowerCase();
    const base = q ? partners.filter((p) => p.name.toLowerCase().includes(q)) : partners;
    return base.slice(0, 50);
  }, [partners, partnerSearch]);

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
          body: JSON.stringify({ email, turnstileToken: captcha }),
        });
        // Always show success (we don't reveal whether the email exists).
        setSent(notice ? "setPassword" : "reset");
        return;
      }
      const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, partner, turnstileToken: captcha }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Managed/imported realtor with no password yet → guide to set one.
        if (json.needsPassword) {
          setMode("reset");
          setNotice(
            "Your account is ready. Set a password to finish signing in — we'll email you a secure link."
          );
          setError(null);
          setCaptcha("");
          setCaptchaKey((k) => k + 1); // fresh Turnstile token for the reset request
          return;
        }
        setError(json.error || "Something went wrong.");
        return;
      }
      if (json.loggedIn) {
        window.location.href = json.isOwner ? "/owner" : "/dashboard";
      } else if (mode === "signup") {
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
            ) : sent === "setPassword" ? (
              <>We sent a link to <strong>{email}</strong> to set your password. Click it to finish signing in — your School Explorer is already live on your site.</>
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
      <h1 className="text-center text-xl font-extrabold text-ink-900">
        {notice && mode === "reset" ? "Set your password" : title}
      </h1>
      <p className="mt-1 text-center text-[13px] text-slate-500">
        Free forever · <strong className="font-extrabold text-brand-700">No Credit Card — Ever</strong>
      </p>
      {notice && mode === "reset" && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-center text-[12px] font-semibold text-brand-800">
          {notice}
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

        {mode === "signup" && (
          <div className="mt-3">
            <label className="block text-xs font-bold text-slate-600">
              Real estate company or partner{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                value={partnerSearch}
                onChange={(e) => {
                  setPartnerSearch(e.target.value);
                  setPartnerOpen(true);
                  setPartner(""); // clear the selection until they pick from the list
                }}
                onFocus={() => setPartnerOpen(true)}
                onBlur={() => setTimeout(() => setPartnerOpen(false), 150)}
                placeholder="Search for your company…"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-8 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
              {partnerSearch && (
                <button
                  type="button"
                  aria-label="Clear"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setPartner("");
                    setPartnerSearch("");
                    setPartnerOpen(false);
                  }}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <span aria-hidden className="text-base leading-none">×</span>
                </button>
              )}
              {partnerOpen && (
                <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredPartners.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-slate-400">
                      No matching partners — leave blank if none.
                    </li>
                  ) : (
                    filteredPartners.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPartner(p.id);
                            setPartnerSearch(p.name);
                            setPartnerOpen(false);
                          }}
                          className={`flex w-full items-center px-3 py-2 text-left text-sm transition hover:bg-brand-50 ${
                            partner === p.id ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-700"
                          }`}
                        >
                          {p.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Referred by a real estate company or website provider? Select them here.
            </p>
          </div>
        )}

        <Turnstile key={captchaKey} onToken={setCaptcha} />

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
            : notice
            ? "Email me a set-password link →"
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
