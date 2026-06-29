import { timingSafeEqual } from "crypto";

// Minimal shared-secret auth for the embed admin endpoints. The password is
// read from EMBED_ADMIN_PASSWORD. Requests authenticate with either an
// `Authorization: Bearer <password>` header or an `x-embed-admin-password`
// header (used by the admin page's fetch calls).

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.EMBED_ADMIN_PASSWORD);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function isAuthorized(request: Request): boolean {
  const expected = process.env.EMBED_ADMIN_PASSWORD;
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const header = request.headers.get("x-embed-admin-password") || "";
  const provided = bearer || header;
  if (!provided) return false;
  return safeEqual(provided, expected);
}
