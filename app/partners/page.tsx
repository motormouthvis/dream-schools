import { Logo } from "@/components/Logo";
import { ExplorerPromo } from "@/components/ExplorerPromo";
import { TERMS_URL, PRIVACY_URL } from "@/lib/legalLinks";

export const metadata = {
  title: "Partner Program — Dream Neighborhood Schools",
  description:
    "White-label the free School Explorer for your clients and earn up to 40% recurring revenue when they upgrade to the full Neighborhood Explorer widget.",
};

// Book a demo/partnership call via the shared Dream Neighborhood Calendly.
const CALENDLY_URL = "https://calendly.com/d/cvbg-myt-4x9/dream-neighborhood-demo-call";

const BENEFITS: [string, string][] = [
  [
    "Zero cost to white-label",
    "Offer the School Explorer free to every client site. No license fees, no per-site charges, no minimums.",
  ],
  [
    "Up to 40% recurring revenue",
    "Earn a recurring revenue share every time one of your clients upgrades to the full paid Neighborhood Explorer widget.",
  ],
  [
    "One line of code, any platform",
    "Installs site-wide in under 60 seconds on any IDX platform, CMS, or custom site. No redesign, no maintenance.",
  ],
  [
    "Sticky by design",
    "Once school data is live across your clients' listings, it becomes part of your platform — a golden-handcuffs advantage that's hard to leave.",
  ],
  [
    "A real competitive edge",
    "Differentiate your platform with school ratings, test scores, college readiness, and safety that competitors charge for.",
  ],
  [
    "Your brand, not ours",
    "The free explorer runs on your clients' sites under their brand — no ads, no clutter.",
  ],
];

export default function PartnersPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <a href="/" aria-label="Dream Neighborhood — home" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
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
      <header className="mt-8 overflow-hidden rounded-3xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 shadow-md sm:p-10">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/20">
          Partner program · revenue share
        </span>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-4xl">
          Add school data to every client site — and earn up to 40% recurring revenue.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-700">
          For real estate website developers, IDX providers, and real estate technology companies:
          white-label the free Dream Neighborhood School Explorer across all of your clients&apos; sites
          at <strong>zero cost</strong>, and share in the revenue when they upgrade to the full paid
          widget.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            Book a 15-Minute Demo
          </a>
          <a
            href="/installation"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-600 px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
          >
            Start White-Labeling Today
          </a>
        </div>
      </header>

      {/* The two products, so partners understand exactly what they're offering
          and what the paid upgrade unlocks. */}
      <section className="mt-10">
        <h2 className="text-xl font-extrabold tracking-tight text-ink-900">
          What you&apos;ll offer your clients
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          You white-label the free <strong>School Explorer</strong> across every client site. When a
          client wants the full picture, they upgrade to the paid <strong>Neighborhood Explorer</strong>{" "}
          — and that&apos;s where your revenue share kicks in.
        </p>
        <ExplorerPromo />
      </section>

      {/* How the model works */}
      <section className="mt-10">
        <h2 className="text-xl font-extrabold tracking-tight text-ink-900">How the revenue share works</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ["1", "White-label for free", "Drop one line of code into your platform or client sites. The School Explorer goes live everywhere — free, forever, under your clients' brand."],
            ["2", "Buyers ask for more", "Home buyers see schools on every listing and can request the full Neighborhood Explorer — market trends, commute, demographics, walkability, safety, and 38+ hyperlocal insights."],
            ["3", "You earn recurring revenue", "When a client upgrades to the paid widget, you earn up to 40% recurring revenue for as long as they stay — no selling required."],
          ].map(([n, title, body]) => (
            <div key={n} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{n}</span>
              <h3 className="mt-3 text-sm font-extrabold text-ink-900">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="mt-10">
        <h2 className="text-xl font-extrabold tracking-tight text-ink-900">Why platforms partner with us</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {BENEFITS.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-ink-900">{title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-slate-500">
          Works with any IDX or website and installs with a single line of code — no redesign and no
          ongoing engineering.
        </p>
      </section>

      {/* Closing CTA */}
      <section className="mt-10 rounded-3xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 text-center shadow-md sm:p-8">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Let&apos;s build a partnership</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-700">
          Bring free school data to your clients and add a new recurring revenue stream to your
          platform. We&apos;ll get you white-labeled fast.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            Book a 15-Minute Demo
          </a>
          <a
            href="/installation"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-600 px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
          >
            Start White-Labeling Today
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto mt-12 max-w-2xl border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        <p>© 2026 Dream Neighborhood. All rights reserved.</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-5">
          <a href="/" className="font-medium text-slate-600 transition hover:text-brand-700">Home</a>
          <a href="/installation" className="font-medium text-slate-600 transition hover:text-brand-700">Add to your site</a>
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-600 transition hover:text-brand-700">Terms of Service</a>
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-600 transition hover:text-brand-700">Privacy Policy</a>
        </div>
      </footer>
    </main>
  );
}
