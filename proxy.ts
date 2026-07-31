import { NextResponse, type NextRequest } from "next/server";
import { dashboardRetired, dnOrigin } from "@/lib/appEnv";

// Host-based routing for the customer admin (Option B).
//
//   app.dreamneighborhoodschools.com  → the account app ONLY.
//   www / apex → public marketing + explorer; account pages redirect to app
//   when ADMIN_ENFORCE_HOST=1.
//
// Shared public support pages (/contact, /feedback) stay on www.
//
// On staging the account app is retired entirely and Dream Neighborhood
// configures the School Explorer instead — see docs/DN_INTEGRATION.md. The
// widget itself (/embed, /embed.js, /api/embed/config, /api/embed/scrape,
// /api/upgrade/*) is the product, not the dashboard, and keeps working there.

const ADMIN_PATH = "/embed-admin";
const APP_ORIGIN = "https://app.dreamneighborhoodschools.com";

const APP_PAGES = [
  "/login",
  "/onboarding",
  "/dashboard",
  "/edit",
  "/owner",
  "/upgrade-requests",
  "/account",
  "/reset",
  "/help",
  "/server",
  "/test",
  "/partner-guide",
];

/** Public support pages: work on www AND app; never redirected www → app. */
const SHARED_PUBLIC_PAGES = ["/contact", "/feedback"];

/**
 * The dashboard, for the purpose of retiring it on staging: the customer
 * account app and the partner-config admin. Deliberately narrower than
 * APP_PAGES — /help and /partner-guide are documentation, and /server and
 * /test are diagnostics that stay useful on staging.
 */
const DASHBOARD_PAGES = [
  "/login",
  "/onboarding",
  "/dashboard",
  "/edit",
  "/owner",
  "/upgrade-requests",
  "/account",
  "/reset",
  ADMIN_PATH,
];

/** The endpoints behind those pages. Retired together, or it isn't retired. */
const DASHBOARD_API_PREFIXES = ["/api/app/", "/api/auth/", "/api/owner/", "/api/embed/admin"];

function isAppHost(host: string): boolean {
  return host.split(":")[0].toLowerCase().startsWith("app.");
}

function matchesPath(pathname: string, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAllowedOnAppHost(pathname: string): boolean {
  if (matchesPath(pathname, APP_PAGES) || matchesPath(pathname, SHARED_PUBLIC_PAGES)) return true;
  if (pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`)) return true;
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/app/") ||
    pathname.startsWith("/api/owner/") ||
    pathname.startsWith("/api/embed/") ||
    pathname.startsWith("/api/upgrade/") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/autocomplete" ||
    pathname === "/api/contact"
  ) {
    return true;
  }
  if (pathname === "/embed" || pathname.startsWith("/embed/") || pathname === "/embed.js") return true;
  return false;
}

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const { pathname } = req.nextUrl;
  const enforce = process.env.ADMIN_ENFORCE_HOST === "1";

  if (dashboardRetired()) {
    if (DASHBOARD_API_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))) {
      return NextResponse.json(
        { error: "The Dream Schools dashboard is retired on this environment. Configure the School Explorer in Dream Neighborhood.", dashboard: dnOrigin() },
        { status: 410 }
      );
    }
    if (matchesPath(pathname, DASHBOARD_PAGES)) {
      return NextResponse.redirect(`${dnOrigin()}/`);
    }
  }

  if (isAppHost(host)) {
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.rewrite(url);
    }
    if (!isAllowedOnAppHost(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (
    enforce &&
    (pathname === ADMIN_PATH ||
      pathname.startsWith(`${ADMIN_PATH}/`) ||
      matchesPath(pathname, APP_PAGES))
  ) {
    return NextResponse.redirect(`${APP_ORIGIN}${pathname}`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|js|css|map|woff|woff2|ttf|txt|xml|json)$).*)",
  ],
};
