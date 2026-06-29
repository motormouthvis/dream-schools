import { NextResponse } from "next/server";

// The embed endpoints are called cross-origin from partner sites, so they must
// send permissive CORS headers. They expose only public, non-sensitive widget
// config + geocoding, so reflecting the requesting origin is acceptable.

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function withCors(request: Request, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  for (const [k, v] of Object.entries(corsHeaders(request))) res.headers.set(k, v);
  return res;
}

export function preflight(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}
