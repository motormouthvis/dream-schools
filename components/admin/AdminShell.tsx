"use client";

import React, { useEffect, useState } from "react";
import { Home as HomeIcon, HelpCircle, Menu, X } from "lucide-react";

// Admin chrome for the Dream Neighborhood Schools customer dashboard. Mirrors
// the look of app.dreamneighborhood.com (emerald rail + light content area),
// adapted to the Schools product and simplified to a single "Home" section.

const SIDEBAR_BG = "#0d5c52";

type Props = {
  pageTitle: string;
  /** Optional account email shown in the top bar. */
  accountEmail?: string;
  /** Sign-out handler; when provided a control is shown in the top bar. */
  onSignOut?: () => void;
  children: React.ReactNode;
};

export default function AdminShell({
  pageTitle,
  accountEmail,
  onSignOut,
  children,
}: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const mq = window.matchMedia("(min-width: 768px)");
    document.body.style.overflow = "hidden";
    const onMq = () => {
      if (mq.matches) {
        setMobileNavOpen(false);
        document.body.style.overflow = "";
      }
    };
    mq.addEventListener("change", onMq);
    return () => {
      mq.removeEventListener("change", onMq);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  return (
    <div className="flex h-[100dvh] md:h-screen overflow-hidden bg-white font-sans text-zinc-900">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {/* Sidebar — drawer on mobile, fixed rail from md */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col text-white transition-transform duration-200 ease-out md:relative md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ backgroundColor: SIDEBAR_BG }}
      >
        <div className="relative flex items-center gap-3 border-b border-white/15 px-8 pb-6 pt-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black p-1 ring-1 ring-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dn-logo-mark.png"
              alt="Dream Neighborhood Schools"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <div className="min-w-0 pr-10 md:pr-0">
            <div className="text-lg font-semibold leading-tight tracking-tight text-white">
              Dream Neighborhood
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#d9f99d]/85">
              Schools
            </div>
          </div>
          <button
            type="button"
            className="absolute right-5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-white hover:bg-white/10 md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="px-6 pt-8">
          <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d9f99d] text-sm font-bold text-[#166534]">
              D
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#d9f99d]/80">
                Current Team
              </div>
              <div className="truncate text-sm font-medium text-white">
                Dream Neighborhood Schools
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex-1 overflow-auto px-3">
          <nav className="space-y-1 px-3">
            <span className="flex w-full items-center gap-3 rounded-2xl bg-white/15 px-5 py-[14px] text-left text-sm font-medium text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] ring-1 ring-white/15">
              <HomeIcon className="h-5 w-5 shrink-0 opacity-90" />
              Home
            </span>
          </nav>

          <div className="mt-12 px-3">
            <a
              href="https://www.dreamneighborhoodschools.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-3 rounded-2xl px-5 py-[14px] text-left text-sm font-medium text-white hover:bg-white/10"
            >
              <HelpCircle className="h-5 w-5" />
              Help &amp; Support
            </a>
          </div>
        </div>

        <div className="mt-auto border-t border-white/10 p-6">
          <div className="text-xs text-[#d9f99d]/50">
            © Dream Neighborhood Schools
          </div>
        </div>
      </div>

      {/* Main pane */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-16 items-center justify-between gap-3 border-b bg-white px-4 shadow-sm md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              className="-ml-1 shrink-0 rounded-xl p-2 text-zinc-600 hover:bg-zinc-100 md:hidden"
              aria-label="Open menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <nav
              aria-label="Breadcrumb"
              className="flex min-w-0 items-center gap-2 text-xs font-medium text-blue-700 sm:gap-2.5 sm:text-sm"
            >
              <span className="truncate">Dream Neighborhood Schools</span>
              <span className="shrink-0 text-zinc-300" aria-hidden>
                &gt;
              </span>
              <span className="truncate text-blue-700">{pageTitle}</span>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3 text-sm text-zinc-700">
            {accountEmail ? (
              <span className="hidden max-w-[10rem] truncate sm:inline md:max-w-[14rem]">
                {accountEmail}
              </span>
            ) : null}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d9f99d]/30 text-xs font-medium text-[#0d5c52] ring-1 ring-[#0d5c52]/25">
              DN
            </div>
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto bg-zinc-50 p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
