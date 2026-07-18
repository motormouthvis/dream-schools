import Link from "next/link";
import { NeighborhoodCard } from "@/components/demoRealty/NeighborhoodCard";
import { SchoolExplorerScript } from "@/components/demoRealty/SchoolExplorer";
import { demoPath } from "@/lib/demoRealty/base";
import { neighborhoods } from "@/lib/demoRealty/neighborhoods";

export const metadata = {
  title: "Neighborhoods",
  description: "Explore Los Angeles neighborhoods with DN Realty — lifestyle, character, and schools.",
};

export default function NeighborhoodsIndexPage() {
  return (
    <>
      <SchoolExplorerScript />
      <section className="dn-container py-12">
        <nav className="text-sm text-[var(--dn-muted)]">
          <Link href={demoPath("/")} className="hover:text-[var(--dn-forest)]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--dn-ink)]">Neighborhoods</span>
        </nav>
        <h1 className="mt-4 text-4xl text-[var(--dn-ink)] sm:text-5xl">Neighborhoods</h1>
        <p className="mt-3 max-w-2xl text-[var(--dn-ink-soft)]">
          From hillside quiet to beach-city energy — find the pocket of Los Angeles that fits how you
          want to live.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {neighborhoods.map((n) => (
            <NeighborhoodCard key={n.slug} neighborhood={n} />
          ))}
        </div>
      </section>
    </>
  );
}
