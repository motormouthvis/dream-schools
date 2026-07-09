// Tiny in-memory TTL + LRU cache. It lives at module scope, so on a long-running
// Node process (a Heroku web dyno) it persists across requests — but not across
// restarts or between dynos. That's fine for short-lived response caching where a
// miss simply behaves like today (recompute) and a hit is instant + free.

export class TtlCache<V> {
  private map = new Map<string, { value: V; expires: number }>();

  constructor(private maxEntries = 1000, private ttlMs = 5 * 60 * 1000) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expires) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency (move to newest position).
    this.map.delete(key);
    this.map.set(key, e);
    return e.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}
