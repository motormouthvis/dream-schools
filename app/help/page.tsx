"use client";

import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";

const POPUP_SNIPPET = `<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;
const INLINE_SNIPPET = `<div id="dream-schools-explorer"></div>
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;

// Per-platform install steps (mirrors the platforms our paid product supports).
const PLATFORMS: { name: string; subtitle: string; steps: string[]; note?: string }[] = [
  {
    name: "WordPress",
    subtitle: "Any theme — classic or block-based.",
    steps: [
      "Install a free “headers & footers” plugin (e.g. WPCode, or Insert Headers and Footers by WPBeginner).",
      "In WordPress admin → Plugins → Add New, search, install, and activate it.",
      "Open the plugin’s settings (Settings → Insert Headers and Footers, or WPCode).",
      "Paste the snippet into the Footer / Body field and Save.",
    ],
    note: "Self-hosted WordPress only — WordPress.com needs a Business plan for custom scripts. Elementor/Divi still work.",
  },
  {
    name: "Squarespace",
    subtitle: "Under 2 minutes.",
    steps: [
      "Sign in at squarespace.com and select your site.",
      "Go to Settings → Advanced → Code Injection.",
      "Paste the snippet into the FOOTER box (not the Header).",
      "Click Save.",
    ],
    note: "Code Injection requires a Business plan or higher.",
  },
  {
    name: "Wix",
    subtitle: "Via Custom Code.",
    steps: [
      "Sign in and click Edit Site.",
      "Settings (top menu) → Custom Code → Add Custom Code.",
      "Paste the snippet; set “Place Code in” to Body — End.",
      "Choose Apply to: All pages, Load once, then Apply.",
    ],
    note: "Custom Code requires a Premium Wix plan.",
  },
  {
    name: "GoDaddy Website Builder",
    subtitle: "Via an HTML section.",
    steps: [
      "Sign in at godaddy.com and click Edit Website.",
      "Add Section → HTML (place it anywhere — it’s invisible).",
      "Click Custom Code and paste the snippet, then Done.",
      "Click Publish.",
    ],
    note: "Add it to every page, or once in a global footer if your theme has one.",
  },
  {
    name: "Webflow",
    subtitle: "Via project custom code.",
    steps: [
      "In the Designer, click the project name → Project Settings.",
      "Open the Custom Code tab.",
      "Paste the snippet into the Footer Code field and Save Changes.",
      "Click Publish.",
    ],
    note: "Custom Code requires a paid Webflow plan.",
  },
  {
    name: "Shopify",
    subtitle: "Via theme.liquid.",
    steps: [
      "Admin → Online Store → Themes.",
      "Actions → Edit code on your active theme.",
      "Open Layout → theme.liquid.",
      "Paste the snippet right before the closing </body> tag and Save.",
    ],
  },
  {
    name: "IDX Broker",
    subtitle: "Via Sub-Headers.",
    steps: [
      "Sign in at idxbroker.com and open your control panel.",
      "Design → Website → Sub-Headers.",
      "Turn OFF the WYSIWYG (visual) editor so you can paste raw code.",
      "Paste the snippet and Save. It applies to all IDX-hosted pages.",
    ],
  },
  {
    name: "iHomeFinder / Ylopo / Luxury Presence",
    subtitle: "Real-estate site platforms.",
    steps: [
      "Open your platform’s site/theme settings and find the custom code / tracking scripts area (often “Header & Footer scripts”, “Custom code”, or “Analytics”).",
      "Paste the snippet into the Footer / Body-end field.",
      "Save and publish.",
    ],
    note: "If you can’t find a code field, your account manager can add it — or contact us.",
  },
  {
    name: "Any other site / raw HTML",
    subtitle: "Generic instructions.",
    steps: [
      "Open the template that controls every page (index.html, base.html, layout.html, etc.).",
      "Find the closing </body> tag near the bottom.",
      "Paste the snippet right before </body> and save.",
      "Deploy or click your platform’s Publish button.",
    ],
  },
];

export default function HelpPage() {
  return (
    <AppShell active="help">
      {() => (
        <>
          <h1 className="text-xl font-extrabold text-ink-900">Help &amp; installation</h1>
          <p className="text-[12px] text-slate-500">
            How the popup and embed work, and how to install on any website.
          </p>

          {/* What they are */}
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <Concept title="Floating popup" tone="brand">
              A small school-explorer <strong>button that floats in the corner</strong> of every page.
              Visitors click it to open the explorer, which <strong>auto-detects the address</strong> of
              the listing or neighborhood page they’re viewing. Add one line of code — no layout changes.
            </Concept>
            <Concept title="Inline embed" tone="slate">
              The explorer rendered <strong>directly inside a page</strong>, exactly where you place a{" "}
              <code className="rounded bg-slate-100 px-1">&lt;div&gt;</code>. A{" "}
              <code className="rounded bg-slate-100 px-1">&lt;div&gt;</code> is just an empty HTML
              container that marks the spot; our script fills it with the explorer at the size and
              position you choose.
            </Concept>
          </div>

          {/* Popup vs embed */}
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-900">
              <span className="h-3 w-1.5 rounded bg-brand-500" />
              Popup vs. embed — which should I use?
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <ProsCons
                title="Popup"
                pros={[
                  "Zero website redesign",
                  "Auto-detects the listing/neighborhood address",
                  "Works on every page from one snippet",
                ]}
                cons={["Floats over your page (you don’t control exact placement)"]}
              />
              <ProsCons
                title="Embed"
                pros={[
                  "Exact placement and size, inline in your page",
                  "Feels built-in / native to your design",
                ]}
                cons={[
                  "Needs a small design change (add a div where you want it)",
                  "You set which page/section it appears on",
                ]}
              />
            </div>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 ring-1 ring-inset ring-amber-500/25">
              Both the popup and the embed stay <strong>off</strong> until you create an account and set
              your authorized website URL on the Configure page.
            </p>
          </div>

          {/* Snippets */}
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <SnippetCard title="Popup snippet" code={POPUP_SNIPPET} />
            <SnippetCard title="Inline embed snippet" code={INLINE_SNIPPET} />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Paste before the closing <code>&lt;/body&gt;</code> tag. The explorer is matched to your
            account by your authorized domain — no IDs needed.
          </p>

          {/* Per-platform */}
          <div className="mt-6 text-sm font-bold text-slate-700">Install by platform</div>
          <p className="text-[12px] text-slate-500">
            Works with WordPress, Squarespace, Wix, GoDaddy, Webflow, Shopify, IDX platforms, and
            custom-built sites.
          </p>
          <div className="mt-2 space-y-2">
            {PLATFORMS.map((p) => (
              <Platform key={p.name} {...p} />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

function Concept({ title, tone, children }: { title: string; tone: "brand" | "slate"; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className={`text-sm font-bold ${tone === "brand" ? "text-brand-700" : "text-ink-900"}`}>{title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}

function ProsCons({ title, pros, cons }: { title: string; pros: string[]; cons: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[13px] font-bold text-ink-900">{title}</div>
      <ul className="mt-1.5 space-y-1">
        {pros.map((t) => (
          <li key={t} className="flex items-start gap-1.5 text-[12px] text-slate-600">
            <span className="mt-0.5 text-emerald-600">✓</span>
            {t}
          </li>
        ))}
        {cons.map((t) => (
          <li key={t} className="flex items-start gap-1.5 text-[12px] text-slate-500">
            <span className="mt-0.5 text-slate-400">•</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SnippetCard({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</div>
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
      <div>
        <pre className="overflow-x-auto px-3 py-2.5 text-[12px] leading-relaxed text-slate-100">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function Platform({ name, subtitle, steps, note }: { name: string; subtitle: string; steps: string[]; note?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span>
          <span className="text-sm font-bold text-ink-900">{name}</span>
          <span className="ml-2 text-[12px] text-slate-400">{subtitle}</span>
        </span>
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          {note && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{note}</p>
          )}
        </div>
      )}
    </div>
  );
}
