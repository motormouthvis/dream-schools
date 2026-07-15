/** Public path prefix for the fake brokerage showcase. */
export const DEMO_BASE = "/realestatewebsitedemo";

export function demoPath(path = ""): string {
  if (!path || path === "/") return DEMO_BASE;
  return `${DEMO_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
