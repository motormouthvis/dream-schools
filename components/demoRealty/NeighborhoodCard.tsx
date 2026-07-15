import Link from "next/link";
import { demoPath } from "@/lib/demoRealty/base";
import type { DemoNeighborhood } from "@/lib/demoRealty/neighborhoods";

export function NeighborhoodCard({ neighborhood: n }: { neighborhood: DemoNeighborhood }) {
  const href = demoPath(`/neighborhoods/${n.slug}`);
  return (
    <article className="dn-card group flex flex-col">
      <Link href={href} className="relative block aspect-[16/10] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={n.cardImage}
          alt={n.canonicalName}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(15,28,25,0.75)] via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dn-forest-light)]">Neighborhood</p>
          <h3 className="mt-1 font-[family-name:var(--font-dn-display)] text-2xl text-white">{n.shortLabel}</h3>
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm leading-relaxed text-[var(--dn-ink-soft)] line-clamp-3">{n.description[0]}</p>
        <Link href={href} className="dn-btn dn-btn-ghost mt-5 self-start">
          Explore area →
        </Link>
      </div>
    </article>
  );
}
