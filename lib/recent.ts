// Recent address searches (last 5).
//
// Stored in localStorage, which persists inside the embed/popup iframe (a
// third-party context on partner sites) where a SameSite cookie would be
// rejected. A first-party cookie is also written as a harmless fallback so the
// main website keeps working even if localStorage is unavailable.

export interface RecentSearch {
  label: string;
  lat?: number;
  lon?: number;
  zip?: string;
}

const KEY = "dn_recent";
const MAX = 5;

function readCookie(): RecentSearch[] {
  if (typeof document === "undefined") return [];
  try {
    const m = document.cookie.match(/(?:^|;\s*)dn_recent=([^;]*)/);
    if (!m) return [];
    const arr = JSON.parse(decodeURIComponent(m[1]));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeCookie(next: RecentSearch[]): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${KEY}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${
      60 * 60 * 24 * 180
    }; samesite=lax`;
  } catch {
    /* ignore */
  }
}

export function getRecent(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.slice(0, MAX);
    }
  } catch {
    /* localStorage blocked — fall through to cookie */
  }
  return readCookie().slice(0, MAX);
}

function persist(next: RecentSearch[]): RecentSearch[] {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore — cookie fallback below */
  }
  writeCookie(next);
  return next;
}

export function addRecent(entry: RecentSearch): RecentSearch[] {
  if (typeof window === "undefined" || !entry.label) return getRecent();
  const cur = getRecent().filter(
    (x) => x.label.toLowerCase().trim() !== entry.label.toLowerCase().trim()
  );
  return persist([entry, ...cur].slice(0, MAX));
}

export function removeRecent(label: string): RecentSearch[] {
  if (typeof window === "undefined") return [];
  const next = getRecent().filter(
    (x) => x.label.toLowerCase().trim() !== label.toLowerCase().trim()
  );
  return persist(next);
}

export function clearRecent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${KEY}=; path=/; max-age=0`;
  } catch {
    /* ignore */
  }
}
