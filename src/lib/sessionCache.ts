/**
 * Module-level in-memory cache with TTL.
 * Lives for the lifetime of the browser tab (cleared on full refresh).
 * Fast — no serialization overhead. Use for API response data.
 */

interface Entry<T> {
  data: T;
  ts: number;
  ttl: number;
}

const STORE = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string): T | null {
  const e = STORE.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > e.ttl) {
    STORE.delete(key);
    return null;
  }
  return e.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
  STORE.set(key, { data, ts: Date.now(), ttl: ttlMs });
}

export function invalidateCache(key: string): void {
  STORE.delete(key);
}

export function invalidateCacheByPrefix(prefix: string): void {
  for (const k of STORE.keys()) {
    if (k.startsWith(prefix)) STORE.delete(k);
  }
}
