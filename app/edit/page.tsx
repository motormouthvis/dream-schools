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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-ink-900">Configure School Explorer</h1>
              <p className="text-[12px] text-slate-500">Choose popup, embed, or both. Then set your domain and brand options.</p>
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

          {!loaded ? (
            <p className="mt-6 text-slate-400">Loading…</p>
          ) : (
            <div className="mt-4 space-y-5">
              <IntroBlock />

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <TechColumn title="Popup" subtitle="A floating school button for every listing page.">
                  <PopupPreview accent={form.accentColor} side={form.position} />
                  <OptionBlock title="Popup options">
                    <Field label="Location" hint="Where the floating button sits on the page.">
                      <select className={inp} value={form.position} onChange={(e) => set("position", e.target.value as "left" | "right")}>
                        <option value="right">Bottom right</option>
                        <option value="left">Bottom left</option>
                      </select>
                    </Field>
                    <Field label="Bottom offset (px)" hint="Lift the button above a chat widget, etc.">
                      <input type="number" min={0} className={inp} value={form.bottomOffset} onChange={(e) => set("bottomOffset", Number(e.target.value) || 0)} />
                    </Field>
                    <Field label="Tooltip message" hint="Use {{address}} for the detected address. Blank = default.">
                      <input className={inp} value={form.tooltipMessage} onChange={(e) => set("tooltipMessage", e.target.value)} placeholder="See schools near {{address}}" />
                    </Field>
                    <Check checked={form.requireAddress} onChange={(v) => set("requireAddress", v)} label="Only show when an address is detected" />
                    <Check checked={form.suppressIfNeighborhoodExplorer} onChange={(v) => set("suppressIfNeighborhoodExplorer", v)} label="Hide when the Neighborhood Explorer is present" />
                  </OptionBlock>
                  <OptionBlock title="Popup code">
                    <CodeBlock code={POPUP_SNIPPET} />
                    <p className="mt-2 text-[11px] text-slate-500">Paste once before <code>&lt;/body&gt;</code>. It floats over pages automatically.</p>
                  </OptionBlock>
                </TechColumn>

                <TechColumn title="Embed" subtitle="An inline explorer placed exactly where you want it.">
                  <EmbedPreview accent={form.accentColor} />
                  <OptionBlock title="Embed options">
                    <Field label="Min height (px)" hint="0 = auto-fit to content.">
                      <input type="number" min={0} className={inp} value={form.inlineMinHeight} onChange={(e) => set("inlineMinHeight", Number(e.target.value) || 0)} />
                    </Field>
                    <Check checked={form.inlineShowHeader} onChange={(v) => set("inlineShowHeader", v)} label="Show the header bar on the inline embed" />
                    <p className="mt-1 text-[11px] text-slate-400">Width is set per-embed in the snippet: <code>data-max-width="840"</code>.</p>
                  </OptionBlock>
                  <OptionBlock title="Embed code">
                    <CodeBlock code={INLINE_SNIPPET} />
                    <p className="mt-2 text-[11px] text-slate-500">The <code>&lt;div&gt;</code> marks where the explorer appears. Put it in the exact page section you want.</p>
                  </OptionBlock>
                </TechColumn>
              </div>

              <Section title="General Settings">
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-ink-900">Enable Explorer</div>
                    <div className="text-[12px] text-slate-500">
                      {form.enabled ? "Popup and embed are eligible to show once a domain is set." : "Disabled — no popup or embed will appear."}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => set("enabled", !form.enabled)}
                    className={`relative h-8 w-16 rounded-full transition ${form.enabled ? "bg-brand-600" : "bg-slate-300"}`}
                    aria-pressed={form.enabled}
                  >
                    <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${form.enabled ? "left-9" : "left-1"}`} />
                  </button>
                </div>
                {!form.enabled && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
                    Disabled. Turn on Enable Explorer to edit the settings below.
                  </p>
                )}
                <fieldset disabled={!form.enabled} className={!form.enabled ? "pointer-events-none opacity-45 grayscale" : ""}>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <Field label="Authorized domain" hint="Base domain — works on all pages & subdomains. Popup/embed are off until set.">
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
                        <input type="color" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-9 w-12 rounded border border-slate-300" />
                        <input className={inp} value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} />
                      </div>
                    </Field>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-2 text-xs font-bold text-slate-600">Extras</div>
                      <Check checked={form.showExternalLinks} onChange={(v) => set("showExternalLinks", v)} label="Show Niche & GreatSchools links on school detail" />
                    </div>
                  </div>
                </fieldset>
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

function IntroBlock() {
  return (
    <div className="rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-5 shadow-sm">
      <h2 className="mb-2 flex items-center gap-2 text-base font-extrabold text-ink-900">
        <span className="h-3 w-1.5 rounded bg-brand-500" />
        Popup vs. Embed
      </h2>
      <p className="text-sm leading-relaxed text-slate-600">
        Use the <strong>popup</strong> when you want zero website redesign: a small button floats on listing
        pages and auto-detects the address. Use the <strong>embed</strong> when you want exact placement:
        a <code className="rounded bg-white px-1">&lt;div&gt;</code> marks where the explorer renders inline.
      </p>
      <p className="mt-2 text-[12px] text-slate-500">
        Both remain <strong>off</strong> until you set an authorized domain in General Settings.
        Need platform-specific steps?{" "}
        <a href="/help" className="font-semibold text-brand-700 hover:text-brand-800">Open Help</a>.
      </p>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Copy / paste</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-3 text-[12px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const inp =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-900">
        <span className="h-3 w-1.5 rounded bg-brand-500" />
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TechColumn({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-extrabold text-ink-900">{title}</h2>
        <p className="text-[12px] text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function OptionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="mb-3 text-sm font-bold text-ink-900">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PopupPreview({ accent, side }: { accent: string; side: "left" | "right" }) {
  return (
    <div className="relative h-56 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-lime-50 p-4">
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <div className="h-3 w-28 rounded bg-slate-200" />
        <div className="mt-2 h-2 w-full rounded bg-slate-100" />
        <div className="mt-1 h-2 w-3/4 rounded bg-slate-100" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="h-20 rounded-xl bg-white shadow-sm" />
        <div className="h-20 rounded-xl bg-white shadow-sm" />
      </div>
      <div className={`absolute bottom-4 ${side === "right" ? "right-4" : "left-4"} flex items-center gap-2`}>
        <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-lg">
          See schools nearby
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white shadow-xl" style={{ backgroundColor: accent }}>
          S
        </div>
      </div>
    </div>
  );
}

function EmbedPreview({ accent }: { accent: string }) {
  return (
    <div className="h-56 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-lime-50 p-4">
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <div className="h-3 w-32 rounded bg-slate-200" />
        <div className="mt-2 h-2 w-full rounded bg-slate-100" />
      </div>
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold text-ink-900">School Explorer</div>
          <span className="h-2 w-12 rounded-full" style={{ backgroundColor: accent }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-100 p-2">
            <div className="h-2 w-16 rounded bg-slate-200" />
            <div className="mt-2 h-8 rounded bg-lime2-400/25" />
          </div>
          <div className="rounded-xl border border-slate-100 p-2">
            <div className="h-2 w-16 rounded bg-slate-200" />
            <div className="mt-2 h-8 rounded bg-brand-100" />
          </div>
        </div>
      </div>
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
