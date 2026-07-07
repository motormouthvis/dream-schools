import { Logo } from "@/components/Logo";
import { ExplorerPromo } from "@/components/ExplorerPromo";
import { TERMS_URL, PRIVACY_URL } from "@/lib/legalLinks";

export const metadata = {
  title: "School Explorer for Realtors & Brokerages - Dream Neighborhood Schools",
  description:
    "Add the free School Explorer to every listing with one line of code, and give buyers a one-click upgrade to the full Neighborhood Explorer. No monthly fees, no redesign, your brand.",
};

const NEIGHBORHOOD_DEMO_URL = "https://www.dreamneighborhood.com";

const REASONS: [string, string][] = [
  [
    "Free forever - no monthly fees",
    "Stop paying $100-$800/month to GreatSchools® or Niche™ for school data that lives off your site. The School Explorer is free forever, with no ads and no credit card.",
  ],
  [
    "Installs with one line of code",
    "Zero redesign. Paste one line once and the Explorer goes live on every page in under 60 seconds - on any IDX platform, CMS, or custom website.",
  ],
  [
    "Automatic address detection",
    "The Explorer reads each listing's address right off the page, so the correct nearby schools appear everywhere automatically - no per-page setup.",
  ],
  [
    "Your brand, on your site",
    "Ratings, test scores, college readiness, and safety on every listing - under your brand, keeping buyers on your site instead of leaking to Zillow®.",
  ],
  [
    "A built-in upgrade path",
    "Buyers can request the full Neighborhood Explorer right from the popup - market trends, commute, demographics, walkability, safety, and 38+ hyperlocal insights.",
  ],
  [
    "Happier clients, better SEO",
    "Rich local data means more time on page, stronger local SEO, fewer showings per sale, and buyers who feel taken care of.",
  ],
];

export default function RealtorsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <a
          href="/"
          aria-label="Dream Neighborhood - home"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Logo />
        </a>
        <a
          href="/installation"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
        >
          Install on My Site
        </a>
      </div>

      {/* Hero */}
      <header className="mt-8 overflow-hidden rounded-3xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 shadow-md sm:p-10">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/20">
          For realtors & brokerages
        </span>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-4xl">
          Add Free School Explorer to Every Listing - and Give Buyers the Full Picture
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-700">
          Put beautiful, accurate school data on every listing with a single line of code - free,
          forever. Then let buyers upgrade in one click to the full Neighborhood Explorer, our paid
          widget with 38+ hyperlocal insights. Here&apos;s exactly what each one does.
        </p>
      </header>

      {/* The two products, explained (reused from the home page). */}
      <section className="mt-8">
        <h2 className="text-xl font-extrabold tracking-tight text-ink-900">
          The free explorer &amp; the paid upgrade
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          The <strong>School Explorer</strong> is free forever and lives on your site. The{" "}
          <strong>Neighborhood Explorer</strong> is the paid upgrade your buyers can request for the
          full neighborhood picture.
        </p>
        <ExplorerPromo />
      </section>

      {/* Why realtors add it */}
      <section className="mt-10">
        <h2 className="text-xl font-extrabold tracking-tight text-ink-900">
          Why realtors &amp; brokerages add it
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {REASONS.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-ink-900">{title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mt-10 rounded-3xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 via-white to-lime-50 p-6 text-center shadow-md sm:p-8">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">
          Ready to put school data on every listing?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-700">
          It takes under 60 seconds and one line of code - free, forever. See the full paid widget in
          action, or install the free School Explorer on your site right now.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="/installation"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            Install on My Site
          </a>
          <a
            href={NEIGHBORHOOD_DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-600 px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
          >
            See the Neighborhood Explorer in Action
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto mt-12 max-w-2xl border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        <p>© 2026 Dream Neighborhood. All rights reserved.</p>
        <p className="mx-auto mt-1 max-w-xl text-[10px] leading-relaxed text-slate-400">
          Third-party names and logos (e.g. GreatSchools®, Niche™) are trademarks of their
          respective owners and do not imply affiliation or endorsement.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-5">
          <a href="/" className="font-medium text-slate-600 transition hover:text-brand-700">Home</a>
          <a href="/installation" className="font-medium text-slate-600 transition hover:text-brand-700">Add to your site</a>
          <a href="/partners" className="font-medium text-slate-600 transition hover:text-brand-700">Partners</a>
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-600 transition hover:text-brand-700">Terms of Service</a>
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-600 transition hover:text-brand-700">Privacy Policy</a>
        </div>
      </footer>
    </main>
  );
}
