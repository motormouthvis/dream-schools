import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SchoolExplorerEmbed,
  SchoolExplorerScript,
} from "@/components/demoRealty/SchoolExplorer";
import { PropertyCard } from "@/components/demoRealty/PropertyCard";
import { demoPath } from "@/lib/demoRealty/base";
import {
  getNeighborhoodBySlug,
  neighborhoodAnchorAddress,
  neighborhoods,
} from "@/lib/demoRealty/neighborhoods";
import { properties } from "@/lib/demoRealty/properties";

export function generateStaticParams() {
  return neighborhoods.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = getNeighborhoodBySlug(slug);
  if (!n) return { title: "Neighborhood" };
  return {
    title: n.canonicalName,
    description: n.metaDescription,
    openGraph: {
      title: n.canonicalName,
      description: n.metaDescription,
      images: [n.cardImage],
    },
    other: {
      "og:street-address": n.anchorStreet,
      "og:locality": n.anchorLocality,
      "og:region": n.anchorRegion,
      "og:postal-code": n.anchorPostalCode,
    },
  };
}

export default async function NeighborhoodDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const n = getNeighborhoodBySlug(slug);
  if (!n) notFound();

  const address = neighborhoodAnchorAddress(n);
  const useEmbed = n.explorerMode === "embed";
  const nearby = properties
    .filter(
      (p) =>
        p.neighborhood === n.shortLabel ||
        p.neighborhood.includes(n.shortLabel) ||
        n.shortLabel.includes(p.neighborhood)
    )
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: n.canonicalName,
    address: {
      "@type": "PostalAddress",
      streetAddress: n.anchorStreet,
      addressLocality: n.anchorLocality,
      addressRegion: n.anchorRegion,
      postalCode: n.anchorPostalCode,
      addressCountry: "US",
    },
  };

  return (
    <>
      <SchoolExplorerScript />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article>
        <div className="border-b border-[rgba(15,28,25,0.08)] bg-[rgba(255,255,255,0.45)]">
          <div className="dn-container py-10">
            <nav className="text-sm text-[var(--dn-muted)]" aria-label="Breadcrumb">
              <Link href={demoPath("/")} className="hover:text-[var(--dn-forest)]">
                Home
              </Link>
              <span className="mx-2">/</span>
              <Link href={demoPath("/neighborhoods")} className="hover:text-[var(--dn-forest)]">
                Neighborhoods
              </Link>
              <span className="mx-2">/</span>
              <span className="text-[var(--dn-ink)]">{n.canonicalName}</span>
            </nav>
            <h1 className="mt-6 text-4xl text-[var(--dn-ink)] sm:text-5xl">{n.canonicalName}</h1>
            <p className="mt-3 max-w-2xl text-[var(--dn-ink-soft)]">
              A closer look at living in {n.shortLabel} — lifestyle, character, and the schools that
              shape daily life here.
            </p>
            <div className="mt-8 overflow-hidden rounded-[1.25rem] border border-[rgba(15,28,25,0.08)] shadow-[var(--dn-shadow)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={n.cardImage}
                alt={`Scenic view representing ${n.shortLabel}`}
                className="aspect-[21/9] max-h-[min(22rem,50vh)] w-full object-cover"
              />
            </div>
          </div>
        </div>

        <section className="dn-container py-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl text-[var(--dn-ink)]">About this area</h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-[var(--dn-ink-soft)]">
              {n.description.map((para) => (
                <p key={para.slice(0, 40)}>{para}</p>
              ))}
            </div>
          </div>
        </section>

        {useEmbed && (
          <section className="dn-container pb-16">
            <h2 className="text-center font-[family-name:var(--font-dn-display)] text-2xl text-[var(--dn-ink)]">
              Schools in {n.shortLabel}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-sm text-[var(--dn-muted)]">
              Ratings, test scores, and safety for schools near this neighborhood.
            </p>
            <div className="mx-auto mt-6 max-w-[920px] overflow-hidden rounded-2xl border border-[rgba(15,28,25,0.08)] bg-white shadow-[var(--dn-shadow)]">
              <SchoolExplorerEmbed address={address} frameless />
            </div>
          </section>
        )}

        {nearby.length > 0 && (
          <section className="dn-container pb-16">
            <h2 className="text-2xl text-[var(--dn-ink)]">Homes in {n.shortLabel}</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {nearby.map((p) => (
                <PropertyCard key={p.slug} property={p} />
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
