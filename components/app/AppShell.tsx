"use client";

import { useEffect, useState } from "react";
import { SchoolhouseMark } from "@/components/Logo";

interface Me {
  email: string;
  isOwner: boolean;
  emailVerified: boolean;
  createdAt?: string;
}

export function AppShell({
  active,
  children,
}: {
  active: "home" | "edit" | "help" | "owner" | "account";
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  if (!loaded || !me) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-400">Loading…</div>;
  }

  const link = (id: string, label: string, href: string) => (
    <a
      href={href}
      className={`block rounded-lg px-3 py-1.5 text-sm transition ${
        active === id ? "bg-white/10 font-semibold text-white" : "text-white/60 hover:text-white"
      }`}
    >
      {label}
    </a>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-52 shrink-0 flex-col bg-[#0b4a3d] p-4 text-white">
        <div className="mb-6 flex items-center gap-2">
          <SchoolhouseMark className="h-7 w-7 rounded" />
          <span className="text-sm font-extrabold leading-tight">
            Dream Neighborhood
            <span className="block text-[10px] font-semibold tracking-wider text-white/50">SCHOOLS</span>
          </span>
        </div>
        {link("home", "Home", "/dashboard")}
        {link("edit", "Configure School Explorer", "/edit")}
        {me.isOwner && link("owner", "Customer List", "/owner")}
        {link("account", "Account Settings", "/account")}

        <div className="mt-auto space-y-3 pt-4">
          {link("help", "Help", "/help")}
          <div className="space-y-1 border-t border-white/10 pt-3 text-[12px] text-white/60">
            <div className="font-semibold uppercase tracking-wide text-white/40">Contact us</div>
            <a href="mailto:support@dreamneighborhood.com" className="block truncate hover:text-white">
              support@dreamneighborhood.com
            </a>
            <a href="tel:+17722020185" className="block hover:text-white">(772) 202-0185</a>
          </div>
          <div className="space-y-1 border-t border-white/10 pt-3 text-[12px]">
            <a
              href="https://docs.google.com/document/d/e/2PACX-1vSndxJR71x1k8uI1vmjOZGYvWfpxM-TJSFuMVXclgzx_h5P1Iey2BdKlY0DDiVPSGTJLn0NMLYKXTB5/pub"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-white/60 hover:text-white"
            >
              Terms of Service
            </a>
            <a
              href="https://docs.google.com/document/d/e/2PACX-1vREF8QKsVkEpUyWff3FWUU8D4GoS2aRtz67qgCTmMb2uIQcXHjaqgBtJi6OBhUw-uZsqgM5itrsrxFR/pub"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-white/60 hover:text-white"
            >
              Privacy Policy
            </a>
          </div>
          <div className="space-y-2 border-t border-white/10 pt-3 text-[12px] text-white/50">
            <div className="truncate">{me.email}</div>
            <button onClick={logout} className="text-white/70 hover:text-white">Sign out</button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-6">{children(me)}</main>
    </div>
  );
}
