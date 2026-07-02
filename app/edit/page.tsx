"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { AddressAutocomplete } from "@/components/app/AddressAutocomplete";

type Form = {
  authorizedDomain: string;
  defaultAddress: string;
  accentColor: string;
  position: "left" | "right";
  bottomOffset: number;
  tooltipMessage: string;
  requireAddress: boolean;
  suppressIfNeighborhoodExplorer: boolean;
  inlineMinHeight: number;
  inlineShowHeader: boolean;
  showExternalLinks: boolean;
  enabled: boolean;
};

const BLANK: Form = {
  authorizedDomain: "",
  defaultAddress: "",
  accentColor: "#12854c",
  position: "right",
  bottomOffset: 0,
  tooltipMessage: "",
  requireAddress: false,
  suppressIfNeighborhoodExplorer: false,
  inlineMinHeight: 0,
  inlineShowHeader: false,
  showExternalLinks: false,
  enabled: true,
};

export default function EditPage() {
  const [form, setForm] = useState<Form>(BLANK);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/app/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.config) {
          const c = j.config;
          setForm({
            authorizedDomain: c.allowedHosts?.[0] ?? "",
            defaultAddress: c.defaultAddress ?? "",
            accentColor: c.accentColor ?? "#12854c",
            position: c.position === "left" ? "left" : "right",
            bottomOffset: c.bottomOffset ?? 0,
            tooltipMessage: c.tooltipMessage ?? "",
            requireAddress: !!c.requireAddress,
            suppressIfNeighborhoodExplorer: !!c.suppressIfNeighborhoodExplorer,
            inlineMinHeight: c.inlineMinHeight ?? 0,
            inlineShowHeader: !!c.inlineShowHeader,
            showExternalLinks: !!c.showExternalLinks,
            enabled: !!c.enabled,
          });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Could not save.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell active="edit">
      {() => (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-ink-900">Configure School Explorer</h1>
              <p className="text-[12px] text-slate-500">Grouped by where it appears.</p>
            </div>
            <div className="flex items-center gap-3">
              {saved && <span className="text-xs font-semibold text-brand-700">Saved ✓</span>}
              <button
                onClick={save}
                disabled={busy || !loaded}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
          {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink-900">
              <span className="h-3 w-1.5 rounded bg-brand-500" />
              New here? Popup vs. embed
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="text-[12px] leading-relaxed text-slate-600">
                <strong className="text-brand-700">Popup</strong> — a small button that floats in the
                corner of every page and <strong>auto-detects the listing’s address</strong>. Zero
                redesign; one line of code.
              </p>
              <p className="text-[12px] leading-relaxed text-slate-600">
                <strong>Embed</strong> — the explorer rendered <strong>inline</strong> where you place a{" "}
                <code className="rounded bg-slate-100 px-1">&lt;div&gt;</code> (an empty HTML container
                that marks the spot). Exact placement and size.
              </p>
            </div>
            <p className="mt-2 text-[12px] text-slate-500">
              Both stay <strong>off</strong> until you set your authorized domain below.{" "}
              <a href="/help" className="font-semibold text-brand-700 hover:text-brand-800">
                Full install help &amp; pros/cons →
              </a>
            </p>
          </div>

          <InstallCode />

          {!loaded ? (
            <p className="mt-6 text-slate-400">Loading…</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Section title="Website & install">
                <Field label="Authorized domain" hint="Base domain — works on all pages & subdomains. Popup is OFF until set.">
                  <input className={inp} value={form.authorizedDomain} onChange={(e) => set("authorizedDomain", e.target.value)} placeholder="youragency.com" />
                </Field>
                <Field label="Default address (fallback)" hint="Shown when no address is detected on the page.">
                  <AddressAutocomplete
                    className={inp}
                    value={form.defaultAddress}
                    onChange={(v) => set("defaultAddress", v)}
                    placeholder="1500 N 23rd St, Fort Pierce, FL"
                  />
                </Field>
                <Field label="Accent color">
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-8 w-10 rounded border border-slate-300" />
                    <input className={inp} value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} />
                  </div>
                </Field>
              </Section>

              <Section title="Popup (floating bubble)">
                <Field label="Location" hint="Where the floating button sits on the page.">
                  <select className={inp} value={form.position} onChange={(e) => set("position", e.target.value as "left" | "right")}>
                    <option value="right">Bottom right</option>
                    <option value="left">Bottom left</option>
                  </select>
                </Field>
                <Field label="Bottom offset (px)" hint="Lift the bubble above a chat widget, etc.">
                  <input type="number" min={0} className={inp} value={form.bottomOffset} onChange={(e) => set("bottomOffset", Number(e.target.value) || 0)} />
                </Field>
                <Field label="Tooltip message" hint="Use {{address}} for the detected address. Blank = default.">
                  <input className={inp} value={form.tooltipMessage} onChange={(e) => set("tooltipMessage", e.target.value)} placeholder="See schools near {{address}}" />
                </Field>
                <Check checked={form.requireAddress} onChange={(v) => set("requireAddress", v)} label="Only show when an address is detected" />
                <Check checked={form.suppressIfNeighborhoodExplorer} onChange={(v) => set("suppressIfNeighborhoodExplorer", v)} label="Hide when the Neighborhood Explorer is present" />
              </Section>

              <Section title="Inline embed">
                <Field label="Min height (px)" hint="0 = auto-fit to content.">
                  <input type="number" min={0} className={inp} value={form.inlineMinHeight} onChange={(e) => set("inlineMinHeight", Number(e.target.value) || 0)} />
                </Field>
                <Check checked={form.inlineShowHeader} onChange={(v) => set("inlineShowHeader", v)} label="Show the header bar on the inline embed" />
                <p className="mt-1 text-[11px] text-slate-400">Width is set per-embed in the snippet: <code>data-max-width="840"</code>.</p>
              </Section>

              <Section title="Extras">
                <Check checked={form.showExternalLinks} onChange={(v) => set("showExternalLinks", v)} label="Show Niche & GreatSchools links on school detail" />
                <Check checked={form.enabled} onChange={(v) => set("enabled", v)} label="Explorer enabled" />
              </Section>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

const POPUP_SNIPPET = `<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;
const INLINE_SNIPPET = `<div id="dream-schools-explorer"></div>
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;

function InstallCode() {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink-900">
        <span className="h-3 w-1.5 rounded bg-brand-500" />
        Install code
      </h2>
      <p className="mb-3 text-[12px] text-slate-500">
        Paste before <code>&lt;/body&gt;</code> on your site. Works on WordPress, Squarespace, Wix,
        IDX platforms, and custom sites.
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Floating popup
          </div>
          <CodeBlock code={POPUP_SNIPPET} />
          <p className="mt-1 text-[11px] text-slate-400">
            A school-explorer button appears in the corner of every page.
          </p>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Inline embed
          </div>
          <CodeBlock code={INLINE_SNIPPET} />
          <p className="mt-1 text-[11px] text-slate-400">
            Renders the explorer directly inside the page where you place the div.
          </p>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-900 px-3 py-2.5 pr-14 text-[12px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const inp =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-900">
        <span className="h-3 w-1.5 rounded bg-brand-500" />
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-[13px] text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer accent-brand-600" />
      {label}
    </label>
  );
}
