import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/demoRealty/PropertyCard";
import { SchoolExplorerScript } from "@/components/demoRealty/SchoolExplorer";
import { demoPath } from "@/lib/demoRealty/base";
import {
  agents,
  formatPrice,
  fullAddress,
  getPropertyBySlug,
  properties,
} from "@/lib/demoRealty/properties";

export function generateStaticParams() {
  return properties.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPropertyBySlug(slug);
  if (!p) return { title: "Listing" };
  return {
    title: fullAddress(p),
    description: p.summary,
    openGraph: {
      title: fullAddress(p),
      description: p.summary,
      images: [p.images[0]],
    },
    other: {
      "og:street-address": p.address,
      "og:locality": p.city,
      "og:region": p.state,
      "og:postal-code": p.zip,
    },
  };
}

export default async function ListingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPropertyBySlug(slug);
  if (!p) notFound();
  const agent = agents[p.agent];
  const similar = properties
    .filter((x) => x.slug !== p.slug)
    .sort((a, b) => Number(b.neighborhood === p.neighborhood) - Number(a.neighborhood === p.neighborhood))
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SingleFamilyResidence",
    name: fullAddress(p),
    address: {
      "@type": "PostalAddress",
      streetAddress: p.address,
      addressLocality: p.city,
      addressRegion: p.state,
      postalCode: p.zip,
      addressCountry: "US",
    },
  };

  const facts = [
    { label: "Bedrooms", value: String(p.beds) },
    { label: "Bathrooms", value: String(p.baths) },
    { label: "Living area", value: `${p.sqft.toLocaleString()} sqft` },
    { label: "Property type", value: p.type },
  ];

  return (
    <>
      <SchoolExplorerScript />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article itemScope itemType="https://schema.org/SingleFamilyResidence">
        <div className="dn-container pt-8">
          <nav className="text-sm text-[var(--dn-muted)]" aria-label="Breadcrumb">
            <Link href={demoPath("/")} className="hover:text-[var(--dn-forest)]">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href={demoPath("/listings")} className="hover:text-[var(--dn-forest)]">
              Listings
            </Link>
            <span className="mx-2">/</span>
            <span className="text-[var(--dn-ink)]">{p.address}</span>
          </nav>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[rgba(31,92,76,0.12)] px-3 py-1 text-xs font-semibold text-[var(--dn-forest)]">
                  {p.status}
                </span>
                <span className="rounded-full bg-[rgba(15,28,25,0.06)] px-3 py-1 text-xs font-medium text-[var(--dn-ink-soft)]">
                  {p.type}
                </span>
              </div>
              <h1 className="mt-3 text-3xl text-[var(--dn-ink)] sm:text-4xl">
                <span itemProp="streetAddress">{p.address}</span>
              </h1>
              <p className="mt-1 text-[var(--dn-muted)]">
                <span itemProp="addressLocality">{p.city}</span>,{" "}
                <span itemProp="addressRegion">{p.state}</span>{" "}
                <span itemProp="postalCode">{p.zip}</span>
                <span className="mx-1.5">·</span>
                {p.neighborhood}
              </p>
            </div>
            <p className="font-[family-name:var(--font-dn-display)] text-3xl text-[var(--dn-forest)] sm:text-4xl">
              {formatPrice(p.price)}
            </p>
          </div>
        </div>

        <div className="dn-container mt-6">
          <div className="grid gap-3 sm:grid-cols-4 sm:grid-rows-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.images[0]}
              alt={`${p.address} exterior`}
              className="aspect-[4/3] w-full rounded-2xl object-cover sm:col-span-2 sm:row-span-2 sm:aspect-auto sm:h-full sm:min-h-[320px]"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.images[1]} alt={`${p.address} interior`} className="aspect-[4/3] w-full rounded-2xl object-cover sm:col-span-2" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.images[2]} alt={`${p.address} detail`} className="aspect-[4/3] w-full rounded-2xl object-cover sm:col-span-2" />
          </div>
        </div>

        <div className="dn-container grid gap-10 py-12 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {facts.map((f) => (
                <div key={f.label} className="rounded-2xl border border-[rgba(15,28,25,0.08)] bg-white/90 p-4">
                  <p className="text-lg font-semibold text-[var(--dn-ink)]">{f.value}</p>
                  <p className="text-xs text-[var(--dn-muted)]">{f.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <h2 className="text-2xl text-[var(--dn-ink)]">About this home</h2>
              <p className="mt-3 leading-relaxed text-[var(--dn-ink-soft)]">{p.description}</p>
            </div>

            <div className="mt-10">
              <h2 className="text-2xl text-[var(--dn-ink)]">Features &amp; amenities</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-[var(--dn-ink-soft)]">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[rgba(31,92,76,0.12)] text-[var(--dn-forest)] text-xs font-bold">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="h-fit rounded-[1.25rem] border border-[rgba(15,28,25,0.08)] bg-white p-5 shadow-[var(--dn-shadow)] lg:sticky lg:top-24">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dn-muted)]">Listed by</p>
            {agent && (
              <div className="mt-4 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={agent.photo} alt={agent.name} className="h-14 w-14 rounded-full object-cover" />
                <div>
                  <p className="font-bold text-[var(--dn-ink)]">{agent.name}</p>
                  <p className="text-xs text-[var(--dn-muted)]">{agent.title}</p>
                </div>
              </div>
            )}
            {agent && (
              <div className="mt-5 space-y-2 text-sm text-[var(--dn-ink-soft)]">
                <p>
                  <a href={`tel:${agent.phone.replace(/[^\d+]/g, "")}`} className="font-semibold hover:text-[var(--dn-forest)]">
                    {agent.phone}
                  </a>
                </p>
                <p>
                  <a href={`mailto:${agent.email}`} className="hover:text-[var(--dn-forest)]">
                    {agent.email}
                  </a>
                </p>
              </div>
            )}
            <a href={`mailto:${agent?.email || "sales@dreamneighborhood.com"}?subject=${encodeURIComponent(`Tour request: ${p.address}`)}`} className="dn-btn dn-btn-primary mt-6 w-full">
              Request a tour
            </a>
            <p className="mt-3 text-center text-[11px] text-[var(--dn-muted)]">Demo only — no real showings</p>
          </aside>
        </div>

        <div className="dn-container pb-16">
          <h2 className="text-2xl text-[var(--dn-ink)]">Similar homes</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {similar.map((x) => (
              <PropertyCard key={x.slug} property={x} />
            ))}
          </div>
        </div>
      </article>
    </>
  );
}
