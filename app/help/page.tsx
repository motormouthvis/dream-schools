"use client";

import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";

// The three install snippets (kept identical to Configure Explorer).
const DUAL_POPUP_SNIPPET = `<script src="https://app.dreamneighborhood.com/explorer/sdk.js" async></script>
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;
const SCHOOL_EMBED_SNIPPET = `<div id="dream-schools-explorer"></div>
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;
const NEIGHBORHOOD_EMBED_SNIPPET = `<div id="dn-explorer"></div>
<script src="https://app.dreamneighborhood.com/explorer/sdk.js" async></script>`;

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

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is the School Explorer really free?",
    a: (
      <>
        Yes — the <strong>School Explorer</strong> (nearby schools, ratings, and details) is free. The{" "}
        <strong>Neighborhood Explorer</strong> (38+ hyperlocal insights — prices, commute, walkability,
        safety, dining, and more) is a paid subscription. The popup snippet includes both, so nothing
        changes in your code if you upgrade later.
      </>
    ),
  },
  {
    q: "Do I need to change my code when I subscribe to Neighborhood Explorer?",
    a: (
      <>
        No. The <strong>popup snippet loads both</strong> products. While you don’t have a Neighborhood
        Explorer subscription, visitors see the free School Explorer popup. The moment your subscription
        is active, the Neighborhood Explorer popup takes over automatically — no new code.
      </>
    ),
  },
  {
    q: "The popup isn’t showing — what do I check?",
    a: (
      <>
        1) Make sure you set your <strong>authorized website URL</strong> on the Configure Explorer page —
        the widget stays off until then. 2) Give it a few seconds; it waits to detect the page address.
        3) The popup <strong>never appears on a page that already has an inline embed</strong> (by design).
        4) If you just installed or changed the snippet, hard-refresh — browsers cache the script for a few
        minutes.
      </>
    ),
  },
  {
    q: "Will the free popup and the paid one ever show at the same time?",
    a: (
      <>
        No. On any page there’s only ever one popup: the paid Neighborhood Explorer if you’re subscribed,
        otherwise the free School Explorer. And neither popup shows on a page that has an inline embed.
      </>
    ),
  },
  {
    q: "Can I put an explorer directly inside a page (not floating)?",
    a: (
      <>
        Yes — use an <strong>embed</strong> snippet. Add the School Explorer embed on a “Schools” page, or
        the Neighborhood Explorer embed on a “The Neighborhood” page. The embed renders inline exactly
        where you place the <code className="rounded bg-slate-100 px-1">&lt;div&gt;</code>.
      </>
    ),
  },
];

export default function HelpPage() {
  return (
    <AppShell active="help">
      {(me) => {
        const isPartnerOrAdmin = me.isOwner || me.isPartner;
        const isRealtor = !isPartnerOrAdmin;
        return (
          <>
            <h1 className="text-xl font-extrabold text-ink-900">Help &amp; installation</h1>
            <p className="text-[12px] text-slate-500">
              {isPartnerOrAdmin
                ? "Onboard your realtors and give them the right code snippet for their website."
                : "How the School Explorer works, and how to add it to your website."}
            </p>

            {/* Role-specific getting-started */}
            {isPartnerOrAdmin ? (
              <PartnerStart isAdmin={me.isOwner} />
            ) : (
              <RealtorStart />
            )}

            {/* Free vs paid — the key mental model */}
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-emerald-900">
                <span className="h-3 w-1.5 rounded bg-emerald-500" />
                Free School Explorer vs. paid Neighborhood Explorer
              </h2>
              <p className="text-[13px] leading-relaxed text-emerald-900/90">
                The <strong>School Explorer is free</strong> — nearby schools, Dream Ratings, and school
                detail. The <strong>Neighborhood Explorer is a paid subscription</strong> — 38+ hyperlocal
                insights (prices, commute, walkability, safety, dining, and more). The popup snippet below
                includes <strong>both</strong>: it shows the free School Explorer, and automatically switches
                to the paid Neighborhood Explorer once a subscription is active — with no code change.
              </p>
            </div>

            {/* The three snippets */}
            <div className="mt-5 text-sm font-extrabold text-ink-900">Your code snippets</div>
            <p className="mb-2 text-[12px] text-slate-500">
              Paste before the closing <code className="rounded bg-slate-100 px-1">&lt;/body&gt;</code> tag.
              The explorer is matched to {isPartnerOrAdmin ? "the realtor’s" : "your"} account by the
              authorized domain — no IDs needed.
            </p>

            <div className="space-y-3">
              <SnippetBlock
                badge="Recommended"
                badgeTone="brand"
                title="Popup — School + Neighborhood Explorer (put this on every page)"
                code={DUAL_POPUP_SNIPPET}
              >
                A floating school button on every listing page. Shows the <strong>free School Explorer</strong>{" "}
                popup, and automatically shows the <strong>paid Neighborhood Explorer</strong> popup instead
                once a subscription is active — <strong>no code change to upgrade</strong>. Paste it once,
                site-wide. It never appears on a page that has an inline embed (below).
              </SnippetBlock>

              <SnippetBlock
                title="School Explorer embed — for a dedicated “Schools” page"
                code={SCHOOL_EMBED_SNIPPET}
              >
                Renders the free <strong>School Explorer inline</strong>, exactly where you place the{" "}
                <code className="rounded bg-slate-100 px-1">&lt;div&gt;</code> — e.g. a tab or section titled{" "}
                <strong>“Schools”</strong>.
              </SnippetBlock>

              <SnippetBlock
                badge="Requires subscription"
                badgeTone="amber"
                title="Neighborhood Explorer embed — for a dedicated “The Neighborhood” page"
                code={NEIGHBORHOOD_EMBED_SNIPPET}
              >
                Renders the <strong>Neighborhood Explorer inline</strong> — e.g. a tab titled{" "}
                <strong>“The Neighborhood.”</strong> This is the <strong>paid</strong> product: it only
                renders when there’s an active <strong>Neighborhood Explorer subscription</strong>. Schools
                are free, but this embed needs a subscription to appear.
              </SnippetBlock>
            </div>

            {/* Concepts */}
            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              <Concept title="Floating popup" tone="brand">
                A small button that <strong>floats in the corner</strong> of every page. Visitors click it to
                open the explorer, which <strong>auto-detects the address</strong> of the listing or
                neighborhood page they’re viewing. One line of code — no layout changes.
              </Concept>
              <Concept title="Inline embed" tone="slate">
                The explorer rendered <strong>directly inside a page</strong>, where you place a{" "}
                <code className="rounded bg-slate-100 px-1">&lt;div&gt;</code> (an empty HTML container that
                marks the spot). Our script fills it at the size and position you choose.
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
                  title="Popup (recommended)"
                  pros={[
                    "Zero website redesign",
                    "Auto-detects the listing/neighborhood address",
                    "Works on every page from one snippet",
                    "Upgrades to Neighborhood Explorer with no code change",
                  ]}
                  cons={["Floats over your page (you don’t control exact placement)"]}
                />
                <ProsCons
                  title="Embed"
                  pros={[
                    "Exact placement and size, inline in your page",
                    "Great for a dedicated “Schools” or “The Neighborhood” tab",
                  ]}
                  cons={[
                    "Needs a small design change (add a div where you want it)",
                    "You choose which page/section it appears on",
                  ]}
                />
              </div>
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 ring-1 ring-inset ring-amber-500/25">
                The popup and School embed stay <strong>off</strong> until the authorized website URL is set
                on the Configure Explorer page. The Neighborhood Explorer embed additionally needs an active
                subscription.
              </p>
            </div>

            {/* Per-platform */}
            <div className="mt-6 text-sm font-bold text-slate-700">Install by platform</div>
            <p className="text-[12px] text-slate-500">
              The steps are the same for any snippet — paste it before <code>&lt;/body&gt;</code>. Use the
              popup snippet site-wide; add an embed snippet on the specific page where you want it inline.
            </p>
            <div className="mt-2 space-y-2">
              {PLATFORMS.map((p) => (
                <Platform key={p.name} {...p} />
              ))}
            </div>

            {/* FAQ */}
            <div className="mt-6 text-sm font-bold text-slate-700">Frequently asked questions</div>
            <div className="mt-2 space-y-2">
              {FAQ.map((f) => (
                <Faq key={f.q} q={f.q} a={f.a} />
              ))}
            </div>

            {isRealtor && (
              <p className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-600">
                Ready to install? Set your website URL and grab your snippets on the{" "}
                <a href="/edit" className="font-semibold text-brand-700 hover:underline">
                  Configure Explorer
                </a>{" "}
                page. Need a hand? Use the{" "}
                <a href="/contact" className="font-semibold text-brand-700 hover:underline">
                  Contact
                </a>{" "}
                page and we’ll help you get set up.
              </p>
            )}
          </>
        );
      }}
    </AppShell>
  );
}

function RealtorStart() {
  return (
    <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
      <h2 className="mb-2 text-sm font-extrabold text-brand-800">Get started in 3 steps</h2>
      <ol className="space-y-2">
        {[
          <>
            On the <a href="/edit" className="font-semibold text-brand-700 hover:underline">Configure Explorer</a>{" "}
            page, set your <strong>authorized website URL</strong> (and a default address if you like).
          </>,
          <>
            Copy the <strong>Popup snippet</strong> below and paste it once, site-wide, before{" "}
            <code className="rounded bg-white px-1">&lt;/body&gt;</code>. That’s it — the free School Explorer
            is now live on every listing page.
          </>,
          <>
            Optional: add a <strong>Schools</strong> or <strong>The Neighborhood</strong> page using the embed
            snippets for an inline explorer.
          </>,
        ].map((s, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PartnerStart({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
      <h2 className="mb-2 text-sm font-extrabold text-brand-800">
        {isAdmin ? "Admin — onboarding realtors" : "Partner — onboarding your realtors"}
      </h2>
      <ol className="space-y-2">
        {[
          <>
            On the <a href="/owner" className="font-semibold text-brand-700 hover:underline">Customer List</a>,
            add realtors with <strong>+ Add customer</strong> or <strong>Import</strong>. Each account is
            created ready-to-go (verified, no password needed).
          </>,
          <>
            Set the realtor’s <strong>authorized domain</strong> and default address (via Import fields, or{" "}
            <strong>View as</strong> to configure it for them). Their School Explorer works immediately.
          </>,
          <>
            Use <strong>Send login link</strong> (single or bulk) so the realtor gets a branded email with a
            secure link to manage their own settings. You can edit that email’s message under{" "}
            <a href="/account" className="font-semibold text-brand-700 hover:underline">Account Settings</a>.
          </>,
          <>
            Give the realtor the <strong>Popup snippet</strong> below to paste on their site — or paste it for
            them. See the full{" "}
            <a href="/partner-guide" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">
              Partner Onboarding Guide
            </a>
            .
          </>,
        ].map((s, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[12px] text-slate-500">
        You can also set a <strong>default widget color</strong> for every new customer under Account
        Settings.
      </p>
    </div>
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

function SnippetBlock({
  title,
  code,
  badge,
  badgeTone = "brand",
  children,
}: {
  title: string;
  code: string;
  badge?: string;
  badgeTone?: "brand" | "amber";
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-ink-900">{title}</h3>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
              badgeTone === "amber"
                ? "bg-amber-100 text-amber-800"
                : "bg-brand-100 text-brand-700"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="mb-2.5 text-[13px] leading-relaxed text-slate-600">{children}</p>
      <SnippetCode code={code} />
    </div>
  );
}

function SnippetCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
      <div className="flex items-center justify-end border-b border-white/10 px-3 py-1.5">
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
      <pre className="overflow-x-auto px-3 py-2.5 text-[12px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
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

function Faq({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-ink-900">{q}</span>
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
          {a}
        </div>
      )}
    </div>
  );
}
