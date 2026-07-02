import { NextResponse, type NextRequest } from "next/server";

// Host-based routing for the customer admin (Option B).
//
//   app.dreamneighborhoodschools.com  → the admin dashboard ONLY.
//       "/"            is rewritten to the admin page (/embed-admin)
//       admin + embed  routes pass through
//       anything else  is redirected to the admin home
//
//   www / apex (the public site) → the admin is hidden.
//       When ADMIN_ENFORCE_HOST=1, /embed-admin redirects to the app subdomain.
//       Otherwise (default) the admin stays reachable at /embed-admin so it can
//       be used before the `app.` DNS/SSL is live.
//
// The cross-origin embed assets (/embed.js, /embed, /api/embed/config,
// /api/embed/scrape) are intentionally left working on every host so partner
// snippets keep functioning.

const ADMIN_PATH = "/embed-admin";
const APP_ORIGIN = "https://app.dreamneighborhoodschools.com";

// Account-app routes served on the app subdomain.
const APP_PAGES = ["/login", "/onboarding", "/dashboard", "/edit", "/owner", "/account", "/reset", "/help"];

function isAppHost(host: string): boolean {
  return host.split(":")[0].toLowerCase().startsWith("app.");
}

function isAllowedOnAppHost(pathname: string): boolean {
  if (APP_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`)) return true; // legacy admin
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/app/") ||
    pathname.startsWith("/api/owner/") ||
    pathname.startsWith("/api/embed/") ||
    pathname === "/api/autocomplete"
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
    // The customer account app lives on this subdomain.
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard"; // dashboard redirects to /login if not signed in
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

  // Public host: optionally hide the account app behind the app subdomain.
  if (
    enforce &&
    (pathname === ADMIN_PATH ||
      pathname.startsWith(`${ADMIN_PATH}/`) ||
      APP_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
  ) {
    return NextResponse.redirect(`${APP_ORIGIN}${pathname}`);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static asset files (which keeps
  // /embed.js, images, etc. serving normally on any host).
  matcher: [
    "/((?!_next/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|js|css|map|woff|woff2|ttf|txt|xml|json)$).*)",
  ],
};
