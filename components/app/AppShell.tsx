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
      <aside className="flex shrink-0 flex-col bg-[#0b4a3d] p-4 text-white md:min-h-screen md:w-60">
        {/* Brand */}
        <div className="flex items-center gap-2 px-1">
          <SchoolhouseMark className="h-7 w-7 rounded" />
          <span className="text-sm font-extrabold leading-tight">
            Dream Neighborhood
            <span className="block text-[10px] font-semibold tracking-wider text-white/50">SCHOOLS</span>
          </span>
        </div>

        {/* Account (top, above nav) */}
        <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-inset ring-white/10">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold uppercase">
            {me.email.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-tight">{me.email}</div>
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
      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children(me)}</main>
    </div>
  );
}
