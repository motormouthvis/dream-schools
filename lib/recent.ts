// Recent address searches, persisted in a cookie (last 5).

export interface RecentSearch {
  label: string;
  lat?: number;
  lon?: number;
  zip?: string;
}

const COOKIE = "dn_recent";
const MAX = 5;

export function getRecent(): RecentSearch[] {
  if (typeof document === "undefined") return [];
  try {
    const m = document.cookie.match(/(?:^|;\s*)dn_recent=([^;]*)/);
    if (!m) return [];
    const arr = JSON.parse(decodeURIComponent(m[1]));
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function addRecent(entry: RecentSearch): RecentSearch[] {
  if (typeof document === "undefined" || !entry.label) return getRecent();
  const cur = getRecent().filter(
    (x) => x.label.toLowerCase().trim() !== entry.label.toLowerCase().trim()
  );
  const next = [entry, ...cur].slice(0, MAX);
  // ~180 days
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${
    60 * 60 * 24 * 180
  }; samesite=lax`;
  return next;
}

export function clearRecent(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}
