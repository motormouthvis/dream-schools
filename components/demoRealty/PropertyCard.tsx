import Link from "next/link";
import { demoPath } from "@/lib/demoRealty/base";
import { formatPrice, type DemoProperty } from "@/lib/demoRealty/properties";

export function PropertyCard({ property: p }: { property: DemoProperty }) {
  const href = demoPath(`/listings/${p.slug}`);
  return (
    <article className="dn-card group flex flex-col">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.images[0]}
          alt={`${p.address}, ${p.city}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[var(--dn-forest)] shadow-sm">
          {p.status}
        </span>
        <span className="absolute right-4 top-4 rounded-full bg-[rgba(15,28,25,0.8)] px-3 py-1 text-xs font-medium text-white backdrop-blur">
          {p.type}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-lg font-semibold text-[var(--dn-ink)]">{formatPrice(p.price)}</p>
        <Link href={href} className="mt-1 font-[family-name:var(--font-dn-display)] text-lg text-[var(--dn-ink)] hover:text-[var(--dn-forest)]">
          {p.address}
        </Link>
        <p className="mt-0.5 text-sm text-[var(--dn-muted)]">
          {p.neighborhood}, {p.city}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[rgba(15,28,25,0.08)] pt-4 text-sm text-[var(--dn-ink-soft)]">
          <span>{p.beds} Beds</span>
          <span>{p.baths} Baths</span>
          <span>{p.sqft.toLocaleString()} sqft</span>
        </div>
      </div>
    </article>
  );
}
