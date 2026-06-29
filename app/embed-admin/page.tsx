"use client";

import { useState } from "react";

// Minimal password-protected admin for embeddable-widget partner configs.
// The password is checked server-side against EMBED_ADMIN_PASSWORD; it is held
// only in component state here and sent as the x-embed-admin-password header.

interface Partner {
  partnerId: string;
  widgetNumber: number;
  allowedHosts: string[];
  defaultAddress: string;
  accentColor: string;
  position: "left" | "right";
  bottomOffset: number;
  tooltipMessage: string;
  requireAddress: boolean;
  searchPageContent: boolean;
  suppressOnInline: boolean;
  inlineMinHeight: number;
  inlineShowHeader: boolean;
  enabled: boolean;
}

const BLANK: Partner = {
  partnerId: "",
  widgetNumber: 1,
  allowedHosts: [],
  defaultAddress: "",
  accentColor: "#1fa55f",
  position: "right",
  bottomOffset: 0,
  tooltipMessage: "",
  requireAddress: false,
  searchPageContent: false,
  suppressOnInline: false,
  inlineMinHeight: 750,
  inlineShowHeader: false,
  enabled: true,
};

export default function EmbedAdmin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [draft, setDraft] = useState<Partner>({ ...BLANK });
  const [hostsText, setHostsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function headers(): HeadersInit {
    return { "Content-Type": "application/json", "x-embed-admin-password": password };
  }

  async function load() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/embed/admin", { headers: headers() });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load.");
        setAuthed(false);
        return;
      }
      setPartners(json.partners ?? []);
      setAuthed(true);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  function edit(p: Partner) {
    setDraft({ ...p });
    setHostsText(p.allowedHosts.join(", "));
  }

  function resetDraft() {
    setDraft({ ...BLANK });
    setHostsText("");
  }

  async function save() {
    setError(null);
    setBusy(true);
    const allowedHosts = hostsText
      .split(/[,\s]+/)
      .map((h) => h.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/embed/admin", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ ...draft, allowedHosts }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to save.");
        return;
      }
      resetDraft();
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Partner) {
    if (!confirm(`Delete ${p.partnerId} (widget ${p.widgetNumber})?`)) return;
    setBusy(true);
    try {
      await fetch(
        `/api/embed/admin?partner=${encodeURIComponent(p.partnerId)}&widget_number=${p.widgetNumber}`,
        { method: "DELETE", headers: headers() }
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <h1 className="mb-4 text-xl font-bold text-slate-900">Embed widget admin</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="space-y-3"
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Embed widget partners</h1>
        <button onClick={load} className="text-sm font-semibold text-brand-700 hover:underline">
          Refresh
        </button>
      </div>
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {/* Editor */}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-700">
          {partners.some((p) => p.partnerId === draft.partnerId && p.widgetNumber === draft.widgetNumber)
            ? "Edit partner"
            : "Add partner"}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Partner ID">
            <input
              value={draft.partnerId}
              onChange={(e) => setDraft({ ...draft, partnerId: e.target.value })}
              className={inputCls}
              placeholder="acme-realty"
            />
          </Field>
          <Field label="Widget number">
            <input
              type="number"
              value={draft.widgetNumber}
              onChange={(e) => setDraft({ ...draft, widgetNumber: parseInt(e.target.value) || 1 })}
              className={inputCls}
            />
          </Field>
          <Field label="Allowed hosts (comma-separated)">
            <input
              value={hostsText}
              onChange={(e) => setHostsText(e.target.value)}
              className={inputCls}
              placeholder="acme-realty.com, www.acme-realty.com"
            />
          </Field>
          <Field label="Default address (scraping fallback)">
            <input
              value={draft.defaultAddress}
              onChange={(e) => setDraft({ ...draft, defaultAddress: e.target.value })}
              className={inputCls}
              placeholder="123 Main St, Austin, TX 78701"
            />
          </Field>
          <Field label="Accent color">
            <input
              value={draft.accentColor}
              onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })}
              className={inputCls}
              placeholder="#1fa55f"
            />
          </Field>
          <Field label="Position">
            <select
              value={draft.position}
              onChange={(e) => setDraft({ ...draft, position: e.target.value as "left" | "right" })}
              className={inputCls}
            >
              <option value="right">right</option>
              <option value="left">left</option>
            </select>
          </Field>
          <Field label="Bottom offset (px)">
            <input
              type="number"
              value={draft.bottomOffset}
              onChange={(e) => setDraft({ ...draft, bottomOffset: parseInt(e.target.value) || 0 })}
              className={inputCls}
            />
          </Field>
          <Field label="Inline min-height (px)">
            <input
              type="number"
              value={draft.inlineMinHeight}
              onChange={(e) => setDraft({ ...draft, inlineMinHeight: parseInt(e.target.value) || 750 })}
              className={inputCls}
            />
          </Field>
          <Field label="Tooltip message ({{address}} token)">
            <input
              value={draft.tooltipMessage}
              onChange={(e) => setDraft({ ...draft, tooltipMessage: e.target.value })}
              className={inputCls}
              placeholder="See schools near {{address}}"
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
          <Toggle label="Enabled" checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
          <Toggle label="Require address" checked={draft.requireAddress} onChange={(v) => setDraft({ ...draft, requireAddress: v })} />
          <Toggle label="Search page content" checked={draft.searchPageContent} onChange={(v) => setDraft({ ...draft, searchPageContent: v })} />
          <Toggle label="Suppress on inline" checked={draft.suppressOnInline} onChange={(v) => setDraft({ ...draft, suppressOnInline: v })} />
          <Toggle label="Inline header" checked={draft.inlineShowHeader} onChange={(v) => setDraft({ ...draft, inlineShowHeader: v })} />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={busy || !draft.partnerId.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            Save
          </button>
          <button onClick={resetDraft} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">
            New / clear
          </button>
        </div>
      </section>

      {/* List */}
      <section className="space-y-3">
        {partners.length === 0 && <p className="text-sm text-slate-400">No partners configured yet.</p>}
        {partners.map((p) => (
          <div
            key={`${p.partnerId}-${p.widgetNumber}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">
                {p.partnerId} <span className="font-normal text-slate-400">· widget {p.widgetNumber}</span>{" "}
                {!p.enabled && <span className="text-rose-500">(disabled)</span>}
              </p>
              <p className="truncate text-xs text-slate-500">
                {p.allowedHosts.join(", ") || "no hosts"} · accent {p.accentColor} · {p.position}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => edit(p)} className="text-sm font-semibold text-brand-700 hover:underline">
                Edit
              </button>
              <button onClick={() => remove(p)} className="text-sm font-semibold text-rose-600 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
