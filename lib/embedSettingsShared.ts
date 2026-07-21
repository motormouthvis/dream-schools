// Client-safe constants for the Neighborhood Explorer coexistence grace period.
// Kept free of any server-only imports (e.g. pg) so client components can use
// them without pulling the DB driver into the browser bundle.

/** Default wait (ms) before showing the School popup when Neighborhood Explorer hasn't signaled ready. */
export const DEFAULT_NEIGHBORHOOD_EXPLORER_GRACE_MS = 4000;
export const NEIGHBORHOOD_EXPLORER_GRACE_MS_MIN = 2000;
export const NEIGHBORHOOD_EXPLORER_GRACE_MS_MAX = 15000;
