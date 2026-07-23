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
  inlineMinHeight: 0,
  inlineShowHeader: false,
  showExternalLinks: true,
  enabled: true,
};

export default function EditPage() {
  const [form, setForm] = useState<Form>(BLANK);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detection, setDetection] = useState<{ popupDetected?: boolean; embedDetected?: boolean; popupLastSeen?: string | null; embedLastSeen?: string | null; detected?: boolean; lastSeen?: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/app/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setDetection(j))
      .catch(() => {});
  }, []);

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
      {(me) => (
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
              {/* 1) Integration explainer with side-by-side popup/embed descriptions
                     and collapsed screenshot dropdowns. */}
              <Section title="Integrating School Explorer to Your Website">
                <p className="text-[12px] leading-relaxed text-slate-500">
                  Two ways to add the School Explorer to your site. Use one or both.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <h3 className="text-sm font-extrabold text-brand-700">Popup</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                      A small button floats in the corner of every page and{" "}
                      <strong>auto-detects the listing address</strong>. Zero website redesign — just one
                      line of code.
                    </p>
                    <Collapsible summary="View screenshot of the popup on a listing page">
                      <PopupShot accent={form.accentColor} side={form.position} />
                    </Collapsible>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <h3 className="text-sm font-extrabold text-ink-900">Embed</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                      The explorer renders <strong>inline, exactly where you place it</strong> on a page —
                      full control of placement and size.
                    </p>
                    <Collapsible summary="View screenshot of the embed on a listing page">
                      <EmbedShot accent={form.accentColor} />
                    </Collapsible>
                  </div>
                </div>
              </Section>

              {/* 2) General Settings next. */}
              <Section title="General Settings">
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-ink-900">Enable Explorer</div>
                    <div className="text-[12px] text-slate-500">
                      {form.enabled ? "The Popup or Embed School Explorer are eligible to show once a domain is set." : "Disabled — no popup or embed will appear."}
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
                {!form.authorizedDomain.trim() && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
                    Explorer will not appear until you set an authorized domain.{" "}
                    <a href="/help" className="font-semibold underline hover:text-amber-900">Need platform-specific steps? Open Help.</a>
                  </p>
                )}
                <fieldset disabled={!form.enabled} className={!form.enabled ? "pointer-events-none opacity-45 grayscale" : ""}>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <Field label="Authorized domain" hint="Base domain — works on all pages & subdomains.">
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
                      <Check checked={form.showExternalLinks} onChange={(v) => set("showExternalLinks", v)} label="Show Niche™ & GreatSchools® links on school detail" />
                    </div>
                  </div>
                </fieldset>
              </Section>

              {/* 3) Two-column popup/embed options. */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <TechColumn title="Popup" subtitle="A floating school button for every listing page.">
                  <OptionBlock title="Popup options">
                    <DetectionLine
                      label="Popup"
                      detected={detection?.popupDetected}
                      lastSeen={detection?.popupLastSeen}
                      domain={form.authorizedDomain}
                      anySurface={Boolean(detection?.popupDetected || detection?.embedDetected)}
                      overallDetected={detection?.detected}
                      overallLastSeen={detection?.lastSeen}
                    />
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
                  </OptionBlock>
                  <OptionBlock title="Popup code (School + Neighborhood Explorer)">
                    <CodeBlock code={POPUP_DUAL_SNIPPET} />
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      Paste once before <code>&lt;/body&gt;</code> on your listing pages. It shows the free{" "}
                      <strong>School Explorer</strong> popup — and automatically shows the paid{" "}
                      <strong>Neighborhood Explorer</strong> popup instead if this realtor has an active
                      subscription. No code change is needed when they upgrade. The popup never appears on a
                      page that has an inline embed (below).
                    </p>
                  </OptionBlock>
                </TechColumn>

                <TechColumn title="Embed" subtitle="A static inline explorer placed exactly where you want it (e.g. a “Schools” or “The Neighborhood” tab).">
                  <OptionBlock title="Embed options">
                    <DetectionLine
                      label="Embed"
                      detected={detection?.embedDetected}
                      lastSeen={detection?.embedLastSeen}
                      domain={form.authorizedDomain}
                      anySurface={Boolean(detection?.popupDetected || detection?.embedDetected)}
                      overallDetected={detection?.detected}
                      overallLastSeen={detection?.lastSeen}
                    />
                    <p className="text-[12px] leading-relaxed text-slate-500">
                      A <code className="rounded bg-white px-1">&lt;div&gt;</code> marks where the explorer
                      renders inline. Put it in the exact page section you want.
                    </p>
                    <Field label="Min height (px)" hint="0 = auto-fit to content.">
                      <input type="number" min={0} className={inp} value={form.inlineMinHeight} onChange={(e) => set("inlineMinHeight", Number(e.target.value) || 0)} />
                    </Field>
                    <Check checked={form.inlineShowHeader} onChange={(v) => set("inlineShowHeader", v)} label="Show the header bar on the inline embed" />
                    <p className="mt-1 text-[11px] text-slate-400">Header bar adds a branded title strip above the inline embed. Leave it off if the page already labels the section. Width is set per-embed in the snippet: <code>data-max-width="840"</code>.</p>
                  </OptionBlock>
                  <OptionBlock title="School Explorer embed code">
                    <CodeBlock code={SCHOOL_EMBED_SNIPPET} />
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      Renders the <strong>School Explorer</strong> inline where you place the{" "}
                      <code className="rounded bg-white px-1">&lt;div&gt;</code> — e.g. a dedicated{" "}
                      <strong>“Schools”</strong> page.
                    </p>
                  </OptionBlock>
                  <OptionBlock title="Neighborhood Explorer embed code">
                    <CodeBlock code={NEIGHBORHOOD_EMBED_SNIPPET} />
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      Renders the paid <strong>Neighborhood Explorer</strong> inline — e.g. a{" "}
                      <strong>“The Neighborhood”</strong> page. Requires an active Neighborhood Explorer
                      subscription; it&apos;s configured from the realtor&apos;s Neighborhood Explorer account.
                    </p>
                  </OptionBlock>
                </TechColumn>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

// Listing-page popup: load BOTH products. The free School Explorer popup shows
// unless the realtor has an active Neighborhood Explorer subscription, in which
// case the paid popup shows instead — no code change needed to upgrade. Neither
// popup appears on a page that has an inline embed.
const POPUP_DUAL_SNIPPET = `<script src="https://app.dreamneighborhood.com/explorer/sdk.js" async></script>
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;
// Static inline School Explorer (e.g. a "Schools" page).
const SCHOOL_EMBED_SNIPPET = `<div id="dream-schools-explorer"></div>
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;
// Static inline Neighborhood Explorer (e.g. a "The Neighborhood" page).
const NEIGHBORHOOD_EMBED_SNIPPET = `<div id="dn-explorer"></div>
<script src="https://app.dreamneighborhood.com/explorer/sdk.js" async></script>`;

function fmtSeen(v?: string | null): string {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

function DetectionLine({
  label,
  detected,
  lastSeen,
  domain,
  anySurface,
  overallDetected,
  overallLastSeen,
}: {
  label: string;
  detected?: boolean;
  lastSeen?: string | null;
  domain?: string;
  anySurface?: boolean;
  overallDetected?: boolean;
  overallLastSeen?: string | null;
}) {
  const where = domain?.trim() ? ` on ${domain.trim()}` : "";

  // Prefer the per-surface signal. If we have no per-surface data yet (feature
  // is new / the site is still serving a cached embed.js) but the Explorer is
  // detected overall, show that instead of a misleading "not detected".
  let green: boolean;
  let text: string;
  if (detected) {
    green = true;
    const s = fmtSeen(lastSeen);
    text = `${label} detected${where}${s ? ` · ${s}` : ""}`;
  } else if (anySurface) {
    green = false;
    text = `${label} not detected${where}`;
  } else if (overallDetected) {
    green = true;
    const s = fmtSeen(overallLastSeen);
    text = `Explorer detected${where}${s ? ` · ${s}` : ""} — confirming ${label.toLowerCase()} on next visit`;
  } else {
    green = false;
    text = `${label} not detected${where}`;
  }

  return (
    <div
      className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        green ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${green ? "bg-emerald-500" : "bg-amber-500"}`} />
      {text}
    </div>
  );
}

function Collapsible({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
      >
        {summary}
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
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

// A fake browser window so the mock is instantly recognizable as a screenshot.
function BrowserMock({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md ring-1 ring-black/5">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <div className="ml-2 flex-1 truncate rounded-md bg-white px-2 py-1 text-[10px] text-slate-400 ring-1 ring-slate-200">
          {url}
        </div>
      </div>
      <div className="relative h-[268px] overflow-hidden bg-white">{children}</div>
    </div>
  );
}

function ListingHeader() {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-4 rounded bg-slate-300" />
        <div className="h-2.5 w-20 rounded bg-slate-200" />
      </div>
      <div className="flex gap-2">
        <div className="h-2 w-8 rounded bg-slate-100" />
        <div className="h-2 w-8 rounded bg-slate-100" />
        <div className="h-2 w-8 rounded bg-slate-100" />
      </div>
    </div>
  );
}

function PopupShot({ accent, side }: { accent: string; side: "left" | "right" }) {
  return (
    <BrowserMock url="youragency.com/listings/123-main-st">
      <ListingHeader />
      <div className="relative mx-3 mt-3 h-28 overflow-hidden rounded-lg bg-gradient-to-br from-slate-200 to-slate-300">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-banner.png" alt="Listing photo preview" className="h-full w-full object-cover object-right opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        <span className="absolute bottom-1 left-2 text-[9px] font-semibold text-white/90">Listing photo</span>
      </div>
      <div className="px-3 pt-2">
        <div className="text-[14px] font-extrabold text-ink-900">$525,000</div>
        <div className="text-[11px] font-semibold text-slate-600">123 Main St, Fort Pierce, FL</div>
        <div className="mt-0.5 text-[10px] text-slate-400">3 bd · 2 ba · 1,850 sqft</div>
      </div>
      {/* Floating popup button + tooltip */}
      <div className={`absolute bottom-3 flex items-center gap-2 ${side === "right" ? "right-3 flex-row" : "left-3 flex-row-reverse"}`}>
        <div className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 shadow-lg ring-1 ring-black/5">
          See schools near this home
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-xl"
          style={{ backgroundColor: accent }}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
      </div>
    </BrowserMock>
  );
}

function EmbedShot({ accent }: { accent: string }) {
  const rows: [string, string, string][] = [
    ["Lincoln Elementary", "Public · K–5", "#16a34a"],
    ["Riverside Middle", "Public · 6–8", "#16a34a"],
    ["Central High", "Public · 9–12", "#d97706"],
  ];
  return (
    <BrowserMock url="youragency.com/listings/123-main-st">
      <ListingHeader />
      <div className="px-3 pt-2">
        <div className="text-[12px] font-extrabold text-ink-900">$525,000 · 123 Main St</div>
        <div className="text-[10px] text-slate-400">3 bd · 2 ba · 1,850 sqft</div>
      </div>
      {/* Inline embedded explorer */}
      <div className="mx-3 mt-2 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-white" style={{ backgroundColor: accent }}>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25">
            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </span>
          <span className="text-[10px] font-bold">Dream Neighborhood School Explorer</span>
        </div>
        <div className="space-y-1.5 p-2">
          {rows.map(([name, meta, color]) => (
            <div key={name} className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1">
              <div>
                <div className="text-[10px] font-semibold text-ink-900">{name}</div>
                <div className="text-[8px] text-slate-400">{meta}</div>
              </div>
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: color }}>
                {color === "#16a34a" ? "9" : "6"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </BrowserMock>
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
