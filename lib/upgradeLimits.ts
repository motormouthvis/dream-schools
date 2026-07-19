/**
 * Single source of truth for the allowed ranges of the upgrade-prompt settings
 * that admins (global defaults) and partners (per-account override) can set.
 *
 * Kept dependency-free so it can be imported by both server code
 * (lib/upgradePrompt.ts, lib/auth.ts, API routes) and the client Account
 * Settings UI without pulling server-only modules into the browser bundle.
 *
 * Maxima are intentionally tight so the upgrade prompt reaches homebuyers at
 * least roughly once per month: ≤ 30 days between prompts, ≤ 15 views to
 * trigger, ≤ 10 idle seconds before showing.
 */
export const UPGRADE_PROMPT_LIMITS = {
  viewsToTrigger: { min: 1, max: 15 },
  minDaysBetween: { min: 0, max: 30 },
  idleSeconds: { min: 3, max: 10 },
} as const;

export type UpgradePromptLimitKey = keyof typeof UPGRADE_PROMPT_LIMITS;

/** Clamp a numeric value to a setting's allowed range, or return `fallback` when invalid. */
export function clampUpgradeValue(
  key: UpgradePromptLimitKey,
  value: number,
  fallback: number
): number {
  const { min, max } = UPGRADE_PROMPT_LIMITS[key];
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
