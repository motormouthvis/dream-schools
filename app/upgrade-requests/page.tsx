"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";

interface UpgradeRequest {
  id: number;
  customerEmail: string;
  businessName: string;
  partnerEmail: string | null;
  partnerCompanyName: string | null;
  providerName: string;
  requesterKey: string;
  address: string;
  source: string;
  requestedAt: string;
  summarySentAt: string | null;
}

interface SentDigestEmail {
  id: number;
  recipient: string;
  subject: string;
  variant: string;
  audience: string;
  sentAt: string;
  html: string;
}

const VARIANTS = [
  ["soft_nudge", "Soft nudge"],
  ["strong_sales", "Strong upgrade sales pitch"],
  ["partner_summary", "Partner-facing summary"],
  ["admin_summary", "Admin follow-up summary"],
] as const;

function fmt(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function UpgradeRequestsPage() {
  return (
    <AppShell active="upgradeRequests">
      {(me) => <UpgradeRequests isOwner={me.isOwner} />}
    </AppShell>
  );
}

function NotAuthorized() {
  return (
    <>
      <h1 className="text-xl font-extrabold text-ink-900">Not authorized</h1>
      <p className="mt-2 text-sm text-slate-600">This area is for admins only.</p>
    </>
  );
}

function UpgradeRequests({ isOwner }: { isOwner: boolean }) {
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [sentEmails, setSentEmails] = useState<SentDigestEmail[]>([]);
  const [includeSent, setIncludeSent] = useState(false);
  const [variant, setVariant] = useState<(typeof VARIANTS)[number][0]>("soft_nudge");
  const [digestIntervalWeeks, setDigestIntervalWeeks] = useState("1");
  const [lastDigestSentAt, setLastDigestSentAt] = useState<string | null>(null);
  const [copyTo, setCopyTo] = useState("");
  const [preview, setPreview] = useState<SentDigestEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/owner/upgrade-requests?include_sent=${includeSent ? "1" : "0"}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not load requests.");
        return;
      }
      setRequests(j.requests || []);
      if (j.schedule) {
        setDigestIntervalWeeks(String(j.schedule.digestIntervalWeeks || 1));
        setLastDigestSentAt(j.schedule.lastDigestSentAt || null);
      }
      const sentRes = await fetch("/api/owner/upgrade-digests");
      const sentJson = await sentRes.json().catch(() => ({}));
      if (sentRes.ok) setSentEmails(sentJson.emails || []);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeSent]);

  async function sendNow() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/owner/upgrade-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not send digest.");
        return;
      }
      setMessage(`Sent ${j.requestCount || 0} request${j.requestCount === 1 ? "" : "s"} to ${j.sentTo?.length || 0} recipient${j.sentTo?.length === 1 ? "" : "s"}.`);
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/owner/upgrade-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestIntervalWeeks }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save schedule.");
        return;
      }
      setLastDigestSentAt(j.schedule?.lastDigestSentAt || null);
      setMessage("Schedule saved.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCopy(id: number) {
    if (!copyTo.trim()) {
      setError("Enter an email address for the copy.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/owner/upgrade-digests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, to: copyTo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not send copy.");
        return;
      }
      setMessage("Copy sent.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const unsentCount = useMemo(() => requests.filter((r) => !r.summarySentAt).length, [requests]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900">Weekly Upgrade Requests</h1>
          <p className="text-[12px] text-slate-500">
            Visitors who asked their Realtor for full Neighborhood Explorer access.
          </p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Refresh
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto_auto] lg:items-end">
          <label className="block">
            <span className="block text-xs font-bold text-slate-600">Template variant for Realtor/customer email</span>
            <select value={variant} onChange={(e) => setVariant(e.target.value as any)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {VARIANTS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {isOwner && (
            <label className="block">
              <span className="block text-xs font-bold text-slate-600">Auto-send every X weeks</span>
              <input
                type="number"
                min={1}
                max={52}
                value={digestIntervalWeeks}
                onChange={(e) => setDigestIntervalWeeks(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={includeSent} onChange={(e) => setIncludeSent(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Include sent
          </label>
          {isOwner && (
            <>
              <button
                onClick={saveSchedule}
                disabled={busy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Save schedule
              </button>
              <button
                onClick={sendNow}
                disabled={busy || unsentCount === 0}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Sending…" : `Send digest now (${unsentCount})`}
              </button>
            </>
          )}
        </div>
        <p className="mt-2 text-[12px] text-slate-500">
          {isOwner ? "Sends to the Realtor/customer email, assigned Partner email (if any), and Admin/Product Owner email(s). Sent requests are marked so they are not included again." : "Shows requests related to your account."}
          {lastDigestSentAt && <> Last automatic/manual digest: <strong>{fmt(lastDigestSentAt)}</strong>.</>}
        </p>
      </div>

      {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Requested</th>
              <th className="px-3 py-2 font-semibold">Realtor/customer</th>
              <th className="px-3 py-2 font-semibold">Partner</th>
              <th className="px-3 py-2 font-semibold">Address</th>
              <th className="px-3 py-2 font-semibold">Source</th>
              <th className="px-3 py-2 font-semibold">Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No pending requests.</td></tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-slate-600">{fmt(r.requestedAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-ink-900">{r.customerEmail || "—"}</div>
                    {r.businessName && <div className="text-[11px] text-slate-500">{r.businessName}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{r.partnerCompanyName || r.partnerEmail || "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.address || "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.source || "widget"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{fmt(r.summarySentAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isOwner && (
      <>
      <div className="mt-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-ink-900">Sent Email Archive</h2>
          <p className="text-[12px] text-slate-500">View sent digests and send yourself a copy.</p>
        </div>
        <input
          value={copyTo}
          onChange={(e) => setCopyTo(e.target.value)}
          placeholder="copy-to email"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Sent</th>
              <th className="px-3 py-2 font-semibold">Recipient</th>
              <th className="px-3 py-2 font-semibold">Audience</th>
              <th className="px-3 py-2 font-semibold">Subject</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sentEmails.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No sent digest emails yet.</td></tr>
            ) : (
              sentEmails.map((email) => (
                <tr key={email.id}>
                  <td className="px-3 py-2.5 text-slate-600">{fmt(email.sentAt)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{email.recipient}</td>
                  <td className="px-3 py-2.5 text-slate-600">{email.audience}</td>
                  <td className="px-3 py-2.5 font-semibold text-ink-900">{email.subject}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <button onClick={() => setPreview(email)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">View</button>
                    <button onClick={() => sendCopy(email.id)} className="ml-2 rounded-md border border-brand-200 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">Send copy</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-ink-900">{preview.subject}</h3>
                <p className="text-xs text-slate-500">{preview.recipient} · {fmt(preview.sentAt)}</p>
              </div>
              <button onClick={() => setPreview(null)} className="rounded-full px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button>
            </div>
            <iframe className="mt-3 min-h-0 flex-1 rounded-xl border border-slate-200" srcDoc={preview.html} />
          </div>
        </div>
      )}
    </>
  );
}
