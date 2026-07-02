"use client";

import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";

export default function ContactPage() {
  return <AppShell active="contact">{() => <ContactBody />}</AppShell>;
}

function ContactBody() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, message }),
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

  return (
    <>
      <h1 className="text-xl font-extrabold text-ink-900">Contact us</h1>
      <p className="text-[12px] text-slate-500">We usually reply within one business day.</p>

      <div className="mt-4 grid max-w-3xl gap-4 md:grid-cols-2">
        {/* Direct contact */}
        <div className="space-y-3">
          <a
            href="mailto:support@dreamneighborhood.com"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:bg-brand-50/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">✉️</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email</span>
              <span className="block truncate text-sm font-semibold text-ink-900">support@dreamneighborhood.com</span>
            </span>
          </a>
          <a
            href="tel:+17722020185"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:bg-brand-50/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">📞</span>
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Phone</span>
              <span className="block text-sm font-semibold text-ink-900">(772) 202-0185</span>
            </span>
          </a>
        </div>

        {/* Contact form */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-900">
            <span className="h-3 w-1.5 rounded bg-brand-500" />
            Send us a message
          </h2>
          {sent ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              Thanks — your message is on its way. We’ll reply to <strong>{email}</strong>.
              <button
                onClick={() => setSent(false)}
                className="mt-2 block text-[12px] font-semibold text-brand-700 hover:text-brand-800"
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600">Your email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600">Phone (optional)</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600">Message</label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help?"
                  className={`${inp} resize-y`}
                />
              </div>
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

const inp =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
