"use client";

import { useEffect, useState } from "react";
import { SchoolhouseMark } from "@/components/Logo";
import { TERMS_URL, PRIVACY_URL } from "@/lib/legalLinks";

interface Me {
  email: string;
  isOwner: boolean;
  emailVerified: boolean;
  isPartner: boolean;
  partnerId: string | null;
  companyName: string;
  createdAt?: string;
}

export function AppShell({
  active,
  children,
}: {
  active: "home" | "edit" | "help" | "owner" | "account" | "contact";
  children: (me: Me) => React.ReactNode;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (!j.user) {
          window.location.href = "/login";
          return;
        }
        setMe(j.user);
        setLoaded(true);
      })
      .catch(() => (window.location.href = "/login"));
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("dn_sidebar_open") : null;
    if (saved !== null) setSidebarOpen(saved === "1");
    else if (typeof window !== "undefined" && window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  function toggleSidebar() {
    setSidebarOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("dn_sidebar_open", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!loaded || !me) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-400">Loading…</div>;
  }

  const link = (id: string, label: string, href: string) => (
    <a
      href={href}
      className={`block rounded-lg px-3 py-2 text-sm transition ${
        active === id ? "bg-white/12 font-semibold text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
      }`}
    >
      {label}
    </a>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 md:flex-row">
      {sidebarOpen && (
      <aside className="flex shrink-0 flex-col bg-[#0b4a3d] p-4 text-white md:min-h-screen md:w-60">
        {/* Brand */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <SchoolhouseMark className="h-7 w-7 rounded" />
            <span className="text-sm font-extrabold leading-tight">
              Dream Neighborhood
              <span className="block text-[10px] font-semibold tracking-wider text-white/50">SCHOOLS</span>
            </span>
          </div>
          <button
            onClick={toggleSidebar}
            aria-label="Hide menu"
            className="rounded-md p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 19l-7-7 7-7M19 19l-7-7 7-7"/></svg>
          </button>
        </div>

        {/* Account (top, above nav) */}
        <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-inset ring-white/10">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold uppercase">
            {(me.isPartner && me.companyName ? me.companyName : me.email).charAt(0)}
          </div>
          <div className="min-w-0">
            {me.isPartner && me.companyName ? (
              <>
                <div className="truncate text-[13px] font-semibold leading-tight">{me.companyName}</div>
                <div className="truncate text-[10px] text-white/50">{me.email}</div>
              </>
            ) : (
              <div className="truncate text-[13px] font-semibold leading-tight">{me.email}</div>
            )}
            <div className="text-[10px] uppercase tracking-wide text-white/45">
              {me.isOwner ? "Admin" : me.isPartner ? "Partner" : "Account"}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="mt-5 space-y-1">
          {link("home", "Home", "/dashboard")}
          {link("edit", "Configure School Explorer", "/edit")}
          {(me.isOwner || me.isPartner) && link("owner", "Customer List", "/owner")}
          {link("account", "Account Settings", "/account")}
          {link("help", "Help", "/help")}
          {link("contact", "Contact us", "/contact")}
        </nav>

        {/* Legal + copyright (small, bottom) */}
        <div className="mt-5 space-y-1 pt-4 text-[11px] text-white/40 md:mt-auto">
          <p>© 2026 Dream Neighborhood.</p>
          <div className="flex items-center gap-2">
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white/70">
              Terms
            </a>
            <span aria-hidden>·</span>
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white/70">
              Privacy
            </a>
          </div>
        </div>
      </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {!sidebarOpen && (
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <button
              onClick={toggleSidebar}
              aria-label="Show menu"
              className="rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <div className="flex items-center gap-2">
              <SchoolhouseMark className="h-6 w-6 rounded" />
              <span className="text-sm font-extrabold text-ink-900">Dream Neighborhood Schools</span>
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children(me)}</main>
      </div>
    </div>
  );
}
