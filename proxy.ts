import { NextResponse, type NextRequest } from "next/server";

// Host-based routing for the customer admin (Option B).
//
//   app.dreamneighborhoodschools.com  → the account app ONLY.
//   www / apex → public marketing + explorer; account pages redirect to app
//   when ADMIN_ENFORCE_HOST=1.
//
// Shared public support pages (/contact, /feedback) stay on www.

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
];

/** Public support pages: work on www AND app; never redirected www → app. */
const SHARED_PUBLIC_PAGES = ["/contact", "/feedback"];

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
