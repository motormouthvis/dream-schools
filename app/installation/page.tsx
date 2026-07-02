"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Check, Copy, ArrowRight } from "lucide-react";
import { TERMS_URL, PRIVACY_URL } from "@/lib/legalLinks";

const POPUP_SNIPPET = `<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;

const INLINE_SNIPPET = `<div id="dream-schools-explorer"></div>
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 px-4 py-3.5 pr-12 text-[13px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
        aria-label="Copy code"
        className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function InstallationPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <a
          href="/"
          aria-label="Dream Neighborhood — home"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Logo />
        </a>
        <a
          href="https://app.dreamneighborhoodschools.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          Sign up — free <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      {/* Hero */}
      <header className="mt-8">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/15">
          ★ Free forever · no ads
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          Add the School Explorer to your site
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
          One line of code puts a beautiful school-ratings explorer on every listing — ratings,
          test scores, college readiness &amp; safety, nationwide. No website redesign, no ads,
          and it&apos;s free forever.
        </p>
      </header>

      {/* Step 1 — sign up */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
            1
          </span>
          <h2 className="text-lg font-extrabold tracking-tight text-ink-900">
            Create your free account
          </h2>
        </div>
        <p className="mt-2 pl-10 text-sm leading-relaxed text-slate-600">
          Sign up and authorize your website&apos;s domain. Your account also lets you customize the
          popup — accent color, position, and tooltip.
        </p>
        <div className="mt-3 pl-10">
          <a
            href="https://app.dreamneighborhoodschools.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            Sign up at app.dreamneighborhoodschools.com <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* Step 2 — popup snippet */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
            2
          </span>
          <h2 className="text-lg font-extrabold tracking-tight text-ink-900">
            Paste one line of code (floating popup)
          </h2>
        </div>
        <p className="mt-2 pl-10 text-sm leading-relaxed text-slate-600">
          Add this snippet once, anywhere in your site&apos;s HTML (a global footer or theme template
          works great). A school-explorer button appears in the corner of every page, and the
          explorer auto-detects each listing&apos;s address.
        </p>
        <div className="mt-3 pl-10">
          <CodeBlock code={POPUP_SNIPPET} />
        </div>
        <p className="mt-2 pl-10 text-xs text-slate-500">
          Works with WordPress, Squarespace, Wix, IDX platforms, and custom-built sites.
        </p>
      </section>

      {/* Step 3 — inline embed */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
            3
          </span>
          <h2 className="text-lg font-extrabold tracking-tight text-ink-900">
            Optional: embed it inline on a page
          </h2>
        </div>
        <p className="mt-2 pl-10 text-sm leading-relaxed text-slate-600">
          Prefer the explorer directly in the page instead of a popup? Drop a container where you
          want it and add the same script. The panel sizes itself to your layout.
        </p>
        <div className="mt-3 pl-10">
          <CodeBlock code={INLINE_SNIPPET} />
        </div>
      </section>

      {/* Help / customize */}
      <section className="mt-10 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6">
        <h2 className="text-base font-extrabold tracking-tight text-ink-900">
          Customize &amp; manage
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Set your accent color, popup position, tooltip text, and authorized domains anytime from
          your account dashboard.
        </p>
        <a
          href="https://app.dreamneighborhoodschools.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand-800"
        >
          Open your dashboard <ArrowRight className="h-4 w-4" />
        </a>
      </section>

      {/* Footer — matches dreamneighborhood.com */}
      <footer className="mx-auto mt-12 max-w-2xl border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        <p>© 2026 Dream Neighborhood. All rights reserved.</p>
        <div className="mt-2 flex items-center justify-center gap-5">
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 transition hover:text-brand-700"
          >
            Terms of Service
          </a>
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 transition hover:text-brand-700"
          >
            Privacy Policy
          </a>
        </div>
      </footer>
    </main>
  );
}
