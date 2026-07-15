import Link from "next/link";
import { NeighborhoodCard } from "@/components/demoRealty/NeighborhoodCard";
import { PropertyCard } from "@/components/demoRealty/PropertyCard";
import { SchoolExplorerScript } from "@/components/demoRealty/SchoolExplorer";
import { demoPath } from "@/lib/demoRealty/base";
import { neighborhoods } from "@/lib/demoRealty/neighborhoods";
import { properties } from "@/lib/demoRealty/properties";
import { site, stats, testimonials } from "@/lib/demoRealty/site";

export default function DemoHomePage() {
  const featured = properties.filter((p) => p.featured).slice(0, 3);
  const latest = properties.slice(0, 6);

  return (
    <>
      <SchoolExplorerScript />

      <section className="dn-hero-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=80"
          alt="Modern home exterior at dusk"
        />
        <div className="dn-hero-veil" />
        <div className="dn-container relative z-10 flex min-h-[min(72vh,640px)] flex-col justify-end pb-14 pt-28 sm:pb-20">
          <p className="dn-eyebrow dn-rise text-[var(--dn-forest-light)]">
            <span className="h-px w-8 bg-[var(--dn-forest-light)]" />
            Exclusive listings · demo site
          </p>
          <h1 className="dn-rise dn-rise-delay-1 mt-4 max-w-3xl text-4xl text-white sm:text-5xl lg:text-6xl">
            {site.name}
          </h1>
          <p className="dn-rise dn-rise-delay-2 mt-3 max-w-2xl text-lg text-white/90 sm:text-xl">
            {site.tagline} Every listing ships with free school ratings — look for the School Explorer button
            in the corner.
          </p>
          <div className="dn-rise dn-rise-delay-3 mt-8 flex flex-wrap gap-3">
            <Link href={demoPath("/listings")} className="dn-btn dn-btn-primary dn-pulse">
              Browse listings
            </Link>
            <Link
              href={demoPath("/neighborhoods")}
              className="dn-btn border border-white/35 bg-white/10 text-white backdrop-blur hover:bg-white/20"
            >
              Explore neighborhoods
            </Link>
          </div>
        </div>
      </section>

      <section className="dn-container -mt-8 relative z-20">
        <div className="grid gap-3 rounded-[1.5rem] border border-[rgba(15,28,25,0.08)] bg-white/95 p-4 shadow-[var(--dn-shadow)] sm:grid-cols-3 sm:p-5">
          {stats.slice(0, 3).map((s) => (
            <div key={s.label} className="px-2 py-1 text-center sm:text-left">
              <p className="font-[family-name:var(--font-dn-display)] text-3xl text-[var(--dn-ink)]">{s.value}</p>
              <p className="text-sm text-[var(--dn-muted)]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="dn-container py-16">
        <div className="dn-callout">
          <p className="text-sm font-bold text-[var(--dn-forest)]">How to try School Explorer here</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--dn-ink-soft)]">
            Open any <strong>listing</strong> for the floating popup (auto-detects the address). Open a{" "}
            <strong>neighborhood</strong> page for popup <em>and</em> an inline embed side-by-side.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="dn-eyebrow">Featured properties</p>
            <h2 className="mt-3 text-3xl text-[var(--dn-ink)] sm:text-4xl">Handpicked homes worth touring</h2>
          </div>
          <Link href={demoPath("/listings")} className="dn-btn dn-btn-ghost">
            View all →
          </Link>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <PropertyCard key={p.slug} property={p} />
          ))}
        </div>
      </section>

      <section className="bg-[var(--dn-ink)] py-20 text-[var(--dn-paper)]">
        <div className="dn-container grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="dn-eyebrow text-[var(--dn-forest-light)]">
              <span className="h-px w-8 bg-[var(--dn-forest-light)]" />
              The DN difference
            </p>
            <h2 className="mt-5 text-3xl text-white sm:text-4xl">
              Every listing comes with school ratings — without leaving the page.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/75">
              Buyers care about schools. We surface Dream Ratings, test scores, college readiness, and safety
              via a free School Explorer popup on listings, plus popup + embed on neighborhood pages.
            </p>
            <ul className="mt-6 grid gap-2 text-sm text-white/85 sm:grid-cols-2">
              {["Dream Ratings", "Test scores", "College readiness", "Safety climate", "Demographics (limited)", "One line of code"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--dn-forest)] text-[10px] font-bold">
                      ✓
                    </span>
                    {item}
                  </li>
                )
              )}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={demoPath("/listings/6947-oporto-drive")} className="dn-btn dn-btn-primary">
                See popup on a listing
              </Link>
              <Link
                href={demoPath("/neighborhoods/hollywood-hills-ca")}
                className="dn-btn border border-white/25 text-white hover:bg-white/10"
              >
                See popup + embed
              </Link>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80"
            alt="Agent reviewing neighborhood insights"
            className="h-full max-h-[420px] w-full rounded-[1.5rem] object-cover shadow-[var(--dn-shadow)]"
          />
        </div>
      </section>

      <section className="dn-container py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="dn-eyebrow">Neighborhoods</p>
            <h2 className="mt-3 text-3xl text-[var(--dn-ink)] sm:text-4xl">Explore the area, not just the address</h2>
          </div>
          <Link href={demoPath("/neighborhoods")} className="dn-btn dn-btn-ghost">
            All neighborhoods →
          </Link>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {neighborhoods.map((n) => (
            <NeighborhoodCard key={n.slug} neighborhood={n} />
          ))}
        </div>
      </section>

      <section className="dn-container pb-8">
        <p className="dn-eyebrow">Just listed</p>
        <h2 className="mt-3 text-3xl text-[var(--dn-ink)]">Latest properties</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {latest.map((p) => (
            <PropertyCard key={p.slug} property={p} />
          ))}
        </div>
      </section>

      <section className="dn-container py-16">
        <p className="dn-eyebrow">Testimonials</p>
        <h2 className="mt-3 text-3xl text-[var(--dn-ink)]">Clients who found their fit</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <blockquote
              key={t.name}
              className="rounded-[1.25rem] border border-[rgba(15,28,25,0.08)] bg-white/80 p-6 shadow-[var(--dn-shadow)]"
            >
              <p className="text-sm leading-relaxed text-[var(--dn-ink-soft)]">&ldquo;{t.quote}&rdquo;</p>
              <footer className="mt-4 text-sm font-bold text-[var(--dn-ink)]">
                {t.name}
                <span className="mt-0.5 block font-medium text-[var(--dn-muted)]">{t.location}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>
    </>
  );
}
