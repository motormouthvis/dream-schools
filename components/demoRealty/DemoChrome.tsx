"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { demoPath } from "@/lib/demoRealty/base";
import { nav, site } from "@/lib/demoRealty/site";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

export function DemoChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);

  const active = (href: string, matchSection?: string) => {
    const norm = (p: string) => p.replace(/\/$/, "") || "/";
    const path = norm(pathname);
    const h = norm(href);
    if (matchSection === "neighborhoods") {
      return path === demoPath("/neighborhoods") || path.startsWith(demoPath("/neighborhoods") + "/");
    }
    if (h === demoPath("/")) return path === demoPath("/") || path === demoPath("");
    return path === h || path.startsWith(h + "/");
  };

  return (
    <>
      <div className="dn-banner">
        <div className="dn-container flex flex-wrap items-center justify-between gap-2 py-2.5">
          <p>
            Sample brokerage site · <strong className="text-white">DN Realty</strong>
          </p>
          <p className="text-[12px] font-medium opacity-90">
            <Link href="/installation">Add this to your site</Link>
            {" · "}
            <Link href="/realtors">For realtors</Link>
          </p>
        </div>
      </div>

      <header className="dn-header">
        <div className="dn-container flex items-center justify-between py-3">
          <Link href={demoPath("/")} className="flex items-center gap-2.5" aria-label={`${site.name} home`}>
            <span className="dn-mark">
              <HomeIcon />
            </span>
            <span className="font-[family-name:var(--font-dn-display)] text-xl font-semibold tracking-tight text-[var(--dn-ink)]">
              {site.name}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active(item.href, item.matchSection)
                    ? "bg-[rgba(31,92,76,0.12)] text-[var(--dn-forest)]"
                    : "text-[var(--dn-ink-soft)] hover:text-[var(--dn-forest)]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={`tel:${site.phone.replace(/[^\d+]/g, "")}`}
              className="hidden text-sm font-semibold text-[var(--dn-ink-soft)] hover:text-[var(--dn-forest)] md:inline"
            >
              {site.phone}
            </a>
            <Link href={demoPath("/listings")} className="dn-btn dn-btn-primary hidden sm:inline-flex">
              Browse listings
            </Link>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(15,28,25,0.15)] lg:hidden"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="text-lg leading-none">{open ? "×" : "☰"}</span>
            </button>
          </div>
        </div>

        {open && (
          <nav className="dn-container flex flex-col gap-1 border-t border-[rgba(15,28,25,0.06)] py-3 lg:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-base font-semibold text-[var(--dn-ink-soft)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main>{children}</main>

      <footer className="dn-footer">
        <div className="dn-container grid gap-8 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-[family-name:var(--font-dn-display)] text-2xl text-white">{site.name}</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed opacity-80">{site.tagline}</p>
            <p className="mt-4 text-xs opacity-60">
              Sample brokerage site for demonstration. Not a licensed real estate company.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--dn-forest-light)]">Explore</p>
            <ul className="mt-3 space-y-2 text-sm">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--dn-forest-light)]">Connect</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`}>{site.phone}</a>
              </li>
              <li>
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </li>
              <li>
                <Link href="/contact">Contact Dream Neighborhood</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs opacity-50">
          © {new Date().getFullYear()} DN Realty · Sample site
        </div>
      </footer>
    </>
  );
}
