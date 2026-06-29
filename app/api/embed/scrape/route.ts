import { preflight, withCors } from "@/lib/embedCors";
import { getPageAddress, slugAsAddress } from "@/lib/addressExtract";
import { geocode } from "@/lib/geocode";

export const dynamic = "force-dynamic";

// Resolve a page to a geocoded address for the explorer iframe.
//
//   POST /api/embed/scrape
//   { page_url, page_title, page_address }   (all optional)
//
// `page_address` is what the client SDK already scraped (JSON-LD / OG /
// microdata / DOM / visible text). We trust it first, then fall back to
// server-side URL + title parsing, then a permissive slug-as-address guess.
// Returns { success, address, lat, lon } so the SDK can decide whether to
// show the widget (requireAddress) and seed the iframe with coordinates.

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return withCors(request, { success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const pageUrl = String(body?.page_url ?? "");
  const pageTitle = String(body?.page_title ?? "");
  const pageAddress = String(body?.page_address ?? "").trim();

  if (!pageUrl && !pageTitle && !pageAddress) {
    return withCors(request, { success: false });
  }

  // 1. Client-scraped structured address (most reliable).
  // 2. Server-side URL/title parsing.
  // 3. Permissive slug-as-address fallback.
  let address = pageAddress || null;
  if (!address) address = getPageAddress(pageUrl, pageTitle);
  if (!address) address = slugAsAddress(pageUrl);

  if (!address) {
    return withCors(request, { success: false });
  }

  try {
    const geo = await geocode(address);
    if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) {
      return withCors(request, { success: false, address });
    }
    const res = withCors(request, {
      success: true,
      address: geo.matchedAddress || address,
      lat: geo.lat,
      lon: geo.lon,
    });
    res.headers.set("Cache-Control", "public, max-age=300");
    return res;
  } catch (err) {
    console.error("embed scrape geocode failed:", err);
    return withCors(request, { success: false, address });
  }
}
