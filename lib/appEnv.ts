// ---------------------------------------------------------------------------
// Which deployment this dyno is.
//
// Staging (`dream-schools-preview`) and production (`dream-schools`) diverge on
// purpose as part of the Dream Neighborhood integration — see
// docs/DN_INTEGRATION.md. On staging, DN is the single source of truth: the
// customer dashboard is retired and DN decides who gets the School Explorer. On
// production nothing changes, and DN is never a hard dependency: if DN is
// unreachable, production behaves exactly as it did before the integration.
//
// The divergence is gated here rather than by holding a branch back, so the two
// environments can run the same code.
//
// Anything other than an explicit APP_ENV=staging is production. Forgetting the
// config var must never be what makes production behave like staging.
// ---------------------------------------------------------------------------

export type AppEnv = "production" | "staging";

export function appEnv(): AppEnv {
  const raw = (process.env.APP_ENV || "").trim().toLowerCase();
  return raw === "staging" || raw === "preview" ? "staging" : "production";
}

export function isStaging(): boolean {
  return appEnv() === "staging";
}

/**
 * Staging retires the customer dashboard (`app.dreamneighborhoodschools.com`
 * and its account pages); DN configures the School Explorer there instead.
 * Production keeps it as a fully working parallel control surface.
 */
export function dashboardRetired(): boolean {
  return isStaging();
}

/** Origin of the Dream Neighborhood app for this environment. */
export function dnOrigin(): string {
  const configured = (process.env.DN_ORIGIN || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return isStaging() ? "https://staging.dreamneighborhood.com" : "https://app.dreamneighborhood.com";
}
