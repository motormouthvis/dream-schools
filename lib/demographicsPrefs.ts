/**
 * Demographics display preference for the public website (not embed/popup).
 *
 *   limited  — Fair Housing Compliant: diversity index only, no race/gender bars
 *   full     — race & gender breakdowns; requires an "I agree" acknowledgment
 *
 * Stored in a first-party cookie with the agreement timestamp. Full mode expires
 * after FULL_TTL_DAYS so we re-prompt periodically.
 */

export type DemographicsMode = "limited" | "full";

export interface DemographicsPrefs {
  mode: DemographicsMode;
  /** Unix ms when the user checked "I agree" for Full data; null if never. */
  agreedAt: number | null;
}

const COOKIE = "dn_demo_prefs";
const FULL_TTL_DAYS = 180;

export const FAIR_HOUSING_WARNING =
  "Full demographics include race and gender enrollment data. Using that information to steer buyers toward or away from neighborhoods is illegal under the Fair Housing Act. You must comply with all applicable fair housing and anti-discrimination laws.";

export function defaultDemographicsPrefs(): DemographicsPrefs {
  return { mode: "limited", agreedAt: null };
}

function readRaw(): DemographicsPrefs {
  if (typeof document === "undefined") return defaultDemographicsPrefs();
  try {
    const m = document.cookie.match(/(?:^|;\s*)dn_demo_prefs=([^;]*)/);
    if (!m) return defaultDemographicsPrefs();
    const parsed = JSON.parse(decodeURIComponent(m[1]));
    const mode: DemographicsMode = parsed?.mode === "full" ? "full" : "limited";
    const agreedAt =
      typeof parsed?.agreedAt === "number" && Number.isFinite(parsed.agreedAt)
        ? parsed.agreedAt
        : null;
    return { mode, agreedAt };
  } catch {
    return defaultDemographicsPrefs();
  }
}

function writeRaw(prefs: DemographicsPrefs): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; path=/; max-age=${
      60 * 60 * 24 * 400
    }; samesite=lax`;
  } catch {
    /* ignore */
  }
}

/** True when Full was agreed and the agreement has not expired. */
export function hasValidFullAgree(prefs: DemographicsPrefs = readRaw()): boolean {
  if (!prefs.agreedAt) return false;
  const ageMs = Date.now() - prefs.agreedAt;
  return ageMs >= 0 && ageMs < FULL_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Effective mode for the UI. If the cookie says "full" but agreement expired or
 * is missing, fall back to limited.
 */
export function getDemographicsPrefs(): DemographicsPrefs {
  const prefs = readRaw();
  if (prefs.mode === "full" && !hasValidFullAgree(prefs)) {
    const next = { mode: "limited" as const, agreedAt: prefs.agreedAt };
    writeRaw(next);
    return next;
  }
  return prefs;
}

export function setDemographicsLimited(): DemographicsPrefs {
  const cur = readRaw();
  const next: DemographicsPrefs = { mode: "limited", agreedAt: cur.agreedAt };
  writeRaw(next);
  return next;
}

/** Persist Full mode after the user checks I agree. */
export function setDemographicsFullAgreed(): DemographicsPrefs {
  const next: DemographicsPrefs = { mode: "full", agreedAt: Date.now() };
  writeRaw(next);
  return next;
}

/** Clear agreement and force Limited (e.g. user revokes). */
export function clearDemographicsAgree(): DemographicsPrefs {
  const next: DemographicsPrefs = { mode: "limited", agreedAt: null };
  writeRaw(next);
  return next;
}
