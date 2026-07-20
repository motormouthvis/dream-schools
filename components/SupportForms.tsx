"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Turnstile } from "@/components/app/Turnstile";
import { TERMS_URL, PRIVACY_URL } from "@/lib/legalLinks";

const inp =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

type Kind = "contact" | "feedback" | "data-error";

const TOPICS: { value: string; label: string; mapsTo: Kind }[] = [
  { value: "contact", label: "General question / support", mapsTo: "contact" },
  { value: "feedback", label: "Product feedback", mapsTo: "feedback" },
  { value: "feature", label: "Feature idea", mapsTo: "feedback" },
  { value: "bug", label: "Something is broken", mapsTo: "feedback" },
  { value: "data-error", label: "School data looks wrong", mapsTo: "data-error" },
  { value: "other", label: "Other", mapsTo: "feedback" },
];

function SupportForm({ mode }: { mode: "contact" | "feedback" }) {
  const params = useSearchParams();
  const initialTopic = params.get("topic") || params.get("kind") || mode;
  const [topic, setTopic] = useState(initialTopic);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [schoolName, setSchoolName] = useState(params.get("schoolName") || params.get("school") || "");
  const [ncesId, setNcesId] = useState(params.get("ncesId") || "");
  const [address, setAddress] = useState(params.get("address") || "");
  const [captcha, setCaptcha] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const t = params.get("topic") || params.get("kind");
    if (t) setTopic(t);
    const sn = params.get("schoolName") || params.get("school");
    if (sn) setSchoolName(sn);
    const id = params.get("ncesId");
    if (id) setNcesId(id);
    const addr = params.get("address");
    if (addr) setAddress(addr);
    if ((t || mode) === "data-error") {
      setMessage((prev) =>
        prev
          ? prev
          : "What looks wrong?\n\nWhat should it be instead?\n\n(Optional) Where did you see the correct information?\n"
      );
    }
  }, [params, mode]);

  const kind: Kind = useMemo(() => {
    const hit = TOPICS.find((t) => t.value === topic);
    return hit?.mapsTo || (mode === "contact" ? "contact" : "feedback");
  }, [topic, mode]);

  const showSchoolFields = kind === "data-error" || topic === "data-error";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          topic,
          name,
          email,
          phone,
          message,
          schoolName: schoolName || undefined,
          ncesId: ncesId || undefined,
          address: address || undefined,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          turnstileToken: captcha,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not send your message.");
        return;
      }
      setSent(true);
      setMessage("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-sm text-emerald-900">
        <p className="font-bold">Thanks — we got your message.</p>
        <p className="mt-1 text-emerald-800/90">
          We’ll reply to <strong>{email}</strong> within one business day when a response is needed.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-3 text-xs font-bold text-brand-700 hover:text-brand-800"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "feedback" && (
        <div>
          <label className="block text-xs font-bold text-slate-600">What is this about?</label>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className={inp}>
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold text-slate-600">Your name (optional)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inp} maxLength={120} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600">Your email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inp}
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600">Phone (optional)</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 555-5555"
          className={inp}
        />
      </div>

      {showSchoolFields && (
        <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3">
          <p className="text-xs font-semibold text-amber-900">School data report</p>
          <div>
            <label className="block text-xs font-bold text-slate-600">School name</label>
            <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className={inp} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-600">NCES ID (if known)</label>
              <input value={ncesId} onChange={(e) => setNcesId(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600">Address / area context</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inp} />
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-600">
          {mode === "feedback" ? "Your feedback" : "Message"}
        </label>
        <textarea
          required
          rows={mode === "feedback" ? 8 : 5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            mode === "feedback"
              ? "Tell us what you liked, what was confusing, or what you’d change…"
              : "How can we help?"
          }
          className={`${inp} resize-y`}
        />
      </div>

      <Turnstile onToken={setCaptcha} />

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? "Sending…" : mode === "feedback" ? "Send feedback" : "Send message"}
      </button>
    </form>
  );
}

/** Form body shared by the public www pages and the signed-in app shell. */
export function SupportContent({
  title,
  subtitle,
  mode,
  aside,
  compact = false,
}: {
  title: string;
  subtitle: string;
  mode: "contact" | "feedback";
  aside?: React.ReactNode;
  /** Tighter heading when shown inside the app sidebar layout. */
  compact?: boolean;
}) {
  return (
    <>
      <h1 className={`${compact ? "text-xl" : "mt-8 text-3xl"} font-extrabold tracking-tight text-ink-900`}>
        {title}
      </h1>
      <p className={`${compact ? "mt-1 text-[12px]" : "mt-2 text-sm"} max-w-2xl leading-relaxed text-slate-600`}>
        {subtitle}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <aside className="space-y-3">
          <a
            href="mailto:support@dreamneighborhood.com"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-300"
          >
            <span className="text-lg" aria-hidden>
              ✉
            </span>
            <span>
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">Email</span>
              <span className="block text-sm font-semibold text-ink-900">support@dreamneighborhood.com</span>
            </span>
          </a>
          <a
            href="tel:+17722020185"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-300"
          >
            <span className="text-lg" aria-hidden>
              ☎
            </span>
            <span>
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">Phone</span>
              <span className="block text-sm font-semibold text-ink-900">(772) 202-0185</span>
            </span>
          </a>
          {aside}
        </aside>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Suspense fallback={<p className="text-sm text-slate-500">Loading form…</p>}>
            <SupportForm mode={mode} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

export function SupportShell({
  title,
  subtitle,
  mode,
  aside,
}: {
  title: string;
  subtitle: string;
  mode: "contact" | "feedback";
  aside?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7faf7_0%,#ffffff_40%)]">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" aria-label="Dream Neighborhood Schools home">
            <Logo />
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
            <Link href="/contact" className={mode === "contact" ? "text-brand-700" : "hover:text-brand-700"}>
              Contact
            </Link>
            <Link href="/feedback" className={mode === "feedback" ? "text-brand-700" : "hover:text-brand-700"}>
              Feedback
            </Link>
            <Link href="/parents" className="hover:text-brand-700">
              School Explorer
            </Link>
          </nav>
        </div>

        <SupportContent title={title} subtitle={subtitle} mode={mode} aside={aside} />

        <p className="mt-10 text-center text-[11px] text-slate-400">
          <a href={TERMS_URL} className="hover:text-brand-700" target="_blank" rel="noopener noreferrer">
            Terms
          </a>
          {" · "}
          <a href={PRIVACY_URL} className="hover:text-brand-700" target="_blank" rel="noopener noreferrer">
            Privacy
          </a>
        </p>
      </div>
    </main>
  );
}
