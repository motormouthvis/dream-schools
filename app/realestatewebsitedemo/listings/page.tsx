import Link from "next/link";
import { PropertyCard } from "@/components/demoRealty/PropertyCard";
import { SchoolExplorerScript } from "@/components/demoRealty/SchoolExplorer";
import { demoPath } from "@/lib/demoRealty/base";
import { properties } from "@/lib/demoRealty/properties";

export const metadata = {
  title: "Listings",
  description: "Browse exclusive homes for sale across Los Angeles with DN Realty.",
};

export default function ListingsIndexPage() {
  return (
    <>
      <SchoolExplorerScript />
      <section className="dn-container py-12">
        <nav className="text-sm text-[var(--dn-muted)]">
          <Link href={demoPath("/")} className="hover:text-[var(--dn-forest)]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--dn-ink)]">Listings</span>
        </nav>
        <h1 className="mt-4 text-4xl text-[var(--dn-ink)] sm:text-5xl">Listings</h1>
        <p className="mt-3 max-w-2xl text-[var(--dn-ink-soft)]">
          Curated homes across Los Angeles — each with the neighborhood and school context buyers
          expect before they book a tour.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <PropertyCard key={p.slug} property={p} />
          ))}
        </div>
      </section>
    </>
  );
}
