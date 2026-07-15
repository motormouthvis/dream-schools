import Link from "next/link";
import { PropertyCard } from "@/components/demoRealty/PropertyCard";
import { SchoolExplorerScript } from "@/components/demoRealty/SchoolExplorer";
import { demoPath } from "@/lib/demoRealty/base";
import { properties } from "@/lib/demoRealty/properties";

export const metadata = {
  title: "Listings",
  description: "Browse demo listings — each detail page includes the School Explorer popup.",
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
          Open any home to see the floating <strong>School Explorer</strong> button — it scrapes the listing
          address and shows nearby school ratings without leaving the page.
        </p>
        <div className="dn-callout mt-6">
          <p className="text-sm text-[var(--dn-ink-soft)]">
            Tip: try{" "}
            <Link href={demoPath("/listings/6947-oporto-drive")} className="font-bold text-[var(--dn-forest)] underline">
              6947 Oporto Drive
            </Link>{" "}
            and watch for the corner popup.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <PropertyCard key={p.slug} property={p} />
          ))}
        </div>
      </section>
    </>
  );
}
