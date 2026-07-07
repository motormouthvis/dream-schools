import { Logo } from "@/components/Logo";
import { ArrowRight, Check } from "lucide-react";
import { CodeBlock, POPUP_SNIPPET, INLINE_SNIPPET } from "@/components/CodeBlock";
import { TERMS_URL, PRIVACY_URL, CALENDLY_URL } from "@/lib/legalLinks";

export const metadata = {
  title: "Partner Installation - Website Developers & IDX Providers",
  description:
    "White-label the free School Explorer across every client site with one line of code, and earn up to 40% recurring revenue when clients upgrade to the full Neighborhood Explorer.",
};

function Benefit({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
      <span className="text-sm text-slate-700">{children}</span>
    </li>
  );
}

export default function PartnerInstallationPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <a href="/" aria-label="Dream Neighborhood - home" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <Logo />
        </a>
        <a
          href={CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          Book a Demo
        </a>
      </div>

      {/* Hero */}
      <header className="mt-8">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/15">
          For website developers & IDX providers · revenue share
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          Install the School Explorer across every client site
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
          Deploy the free School Explorer platform-wide with a single line of code, and earn recurring
          revenue when your clients upgrade to the full Neighborhood Explorer widget.
        </p>
      </header>

      <div className="mt-6">
        <div className="rounded-2xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 shadow-sm">
          <h2 className="text-xl font-extrabold tracking-tight text-ink-900">
            White-label the School Explorer, earn up to 40% recurring
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Give every client the free School Explorer at zero cost, and share in the revenue when
            they upgrade to the full paid Neighborhood Explorer widget. One integration, every client
            site - instantly.
          </p>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <Benefit><strong>Zero cost to white-label</strong> - free for every client site, no minimums.</Benefit>
            <Benefit><strong>Up to 40% recurring revenue</strong> on every client upgrade.</Benefit>
            <Benefit><strong>Deploy to all client sites at once</strong> - add it to your global template and it&apos;s live everywhere.</Benefit>
            <Benefit><strong>Works with any IDX, CMS, or custom site</strong> - one line of code, no redesign.</Benefit>
            <Benefit><strong>Sticky &amp; competitive</strong> - school data becomes part of your platform and your brand.</Benefit>
            <Benefit><strong>Your clients look like heroes</strong> - richer listings, happier buyers, more time on site.</Benefit>
          </ul>
          <a
            href="/partners"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            See the full partner program <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* Step 1 - install */}
        <section className="mt-8">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">1</span>
            <h2 className="text-lg font-extrabold tracking-tight text-ink-900">Drop in one line, platform-wide</h2>
          </div>
          <p className="mt-2 pl-10 text-sm leading-relaxed text-slate-600">
            Add the script once to your global template or theme and it goes live across every client
            listing page automatically - no per-site work. It auto-detects the listing address on each
            page, so the right schools always show.
          </p>
          <div className="mt-3 pl-10">
            <CodeBlock code={POPUP_SNIPPET} />
          </div>
          <p className="mt-2 pl-10 text-xs text-slate-500">
            Prefer inline placement in your listing template? Use the container version:
          </p>
          <div className="mt-2 pl-10">
            <CodeBlock code={INLINE_SNIPPET} />
          </div>
        </section>

        {/* Step 2 - revenue share */}
        <section className="mt-8">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">2</span>
            <h2 className="text-lg font-extrabold tracking-tight text-ink-900">Set up your revenue share</h2>
          </div>
          <p className="mt-2 pl-10 text-sm leading-relaxed text-slate-600">
            We&apos;ll set your account as a Partner so upgrades from your client sites are attributed to
            you. Book a quick call to get white-labeled and configure your revenue share.
          </p>
          <div className="mt-3 flex flex-col gap-3 pl-10 sm:flex-row">
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
            >
              Book a 15-Minute Demo
            </a>
            <a
              href="/partners"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-600 px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
            >
              See the Partner Program
            </a>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="mx-auto mt-12 max-w-2xl border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        <p>© 2026 Dream Neighborhood. All rights reserved.</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-5">
          <a href="/" className="font-medium text-slate-600 transition hover:text-brand-700">Home</a>
          <a href="/partners" className="font-medium text-slate-600 transition hover:text-brand-700">Partners</a>
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-600 transition hover:text-brand-700">Terms of Service</a>
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-600 transition hover:text-brand-700">Privacy Policy</a>
        </div>
      </footer>
    </main>
  );
}
