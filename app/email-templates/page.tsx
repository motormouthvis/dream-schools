"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";

interface Template {
  variant: string;
  label: string;
  subject: string;
  intro: string;
  ctaText: string;
  ctaUrl: string;
  updatedAt: string | null;
}

export default function EmailTemplatesPage() {
  return (
    <AppShell active="emailTemplates">
      {(me) => (me.isOwner ? <EmailTemplates /> : <NotAuthorized />)}
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

function EmailTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    const res = await fetch("/api/owner/upgrade-templates");
    const j = await res.json().catch(() => ({}));
    if (res.ok) setTemplates(j.templates || []);
    else setError(j.error || "Could not load templates.");
  }

  useEffect(() => {
    load();
  }, []);

  function set<K extends keyof Template>(k: K, v: Template[K]) {
    setTemplates((ts) => ts.map((t, i) => (i === active ? { ...t, [k]: v } : t)));
    setSaved(false);
  }

  async function save() {
    const t = templates[active];
    if (!t) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/owner/upgrade-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not save.");
        return;
      }
      setSaved(true);
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function addTemplate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/upgrade-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: `Custom template ${templates.filter((t) => t.variant.startsWith("custom_")).length + 1}`,
          subject: "Neighborhood Explorer upgrade opportunity",
          intro: "A visitor requested full Neighborhood Explorer access from your website.",
          ctaText: "Learn more",
          ctaUrl: "https://www.dreamneighborhood.com",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not add template.");
        return;
      }
      await load();
      setActive(Math.max(0, templates.length));
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const t = templates[active];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900">Email Templates</h1>
          <p className="text-[12px] text-slate-500">Customize upgrade digest emails.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={addTemplate} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            Add template
          </button>
          <button onClick={save} disabled={busy || !t} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {saved && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved ✓</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          {templates.map((template, i) => (
            <button
              key={template.variant}
              onClick={() => setActive(i)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                i === active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {template.label || template.variant}
            </button>
          ))}
        </div>

        {t ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3">
              <Field label="Template name">
                <input className={inp} value={t.label} onChange={(e) => set("label", e.target.value)} />
              </Field>
              <Field label="Subject">
                <input className={inp} value={t.subject} onChange={(e) => set("subject", e.target.value)} />
              </Field>
              <Field label="Intro paragraph">
                <textarea rows={6} className={`${inp} resize-y`} value={t.intro} onChange={(e) => set("intro", e.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="CTA text">
                  <input className={inp} value={t.ctaText} onChange={(e) => set("ctaText", e.target.value)} />
                </Field>
                <Field label="CTA URL">
                  <input className={inp} value={t.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} />
                </Field>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
                Placeholders supported: <code>{"{{request_count}}"}</code>, <code>{"{{partner_name}}"}</code>, <code>{"{{learn_more_url}}"}</code>, <code>{"{{signup_url}}"}</code>, <code>{"{{partner_signup_url}}"}</code>.
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-400">Loading…</p>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

const inp =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
