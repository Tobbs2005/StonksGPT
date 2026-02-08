/**
 * Client-side chart data cache with prefetching.
 *
 * - In-memory Map keyed by "SYMBOL:timeframe"
 * - TTL matching server-side cache so we don't serve stale data
 * - Deduplicates in-flight requests (no double-fetch)
 * - Prefetches adjacent timeframes on idle
 */

import { chatApi } from './api';

interface CacheEntry {
  data: any; // ChartData from backend
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();

function key(symbol: string, timeframe: string): string {
  return `${symbol.toUpperCase()}:${timeframe}`;
}

function getTTL(timeframe: string): number {
  const ttls: Record<string, number> = {
    '1d': 30_000,
    '5d': 60_000,
    '1mo': 300_000,
    '6mo': 300_000,
    '1y': 900_000,
    '5y': 900_000,
  };
  return ttls[timeframe] || 300_000;
}

/**
 * Fetch chart data, serving from cache when fresh.
 * Deduplicates concurrent requests for the same key.
 */
export async function getChartDataCached(symbol: string, timeframe: string): Promise<any> {
  const k = key(symbol, timeframe);

  // Cache hit
  const entry = cache.get(k);
  if (entry && Date.now() - entry.timestamp < getTTL(timeframe)) {
    if (import.meta.env.DEV) {
      console.log(`[chart-cache] HIT ${k}`);
    }
    return entry.data;
  }

  // Deduplicate in-flight requests
  const existing = inflight.get(k);
  if (existing) return existing;

  const t0 = performance.now();
  const promise = chatApi
    .getChartData(symbol, timeframe)
    .then((data) => {
      cache.set(k, { data, timestamp: Date.now() });
      inflight.delete(k);
      if (import.meta.env.DEV) {
        console.log(`[chart-cache] MISS ${k} — ${Math.round(performance.now() - t0)}ms`);
      }
      return data;
    })
    .catch((err) => {
      inflight.delete(k);
      throw err;
    });

  inflight.set(k, promise);
  return promise;
}

// ── Prefetching ──────────────────────────────────────────────────────

const ADJACENT: Record<string, string[]> = {
  '1d': ['5d', '1mo'],
  '5d': ['1d', '1mo'],
  '1mo': ['6mo', '5d'],
  '6mo': ['1mo', '1y'],
  '1y': ['6mo', '5y'],
  '5y': ['1y', '6mo'],
};

/**
 * Prefetch the most-likely-next timeframes for a symbol.
 * Runs on idle to avoid blocking the UI.
 */
export function prefetchAdjacentTimeframes(symbol: string, currentTimeframe: string): void {
  const adjacent = ADJACENT[currentTimeframe] || [];
  if (adjacent.length === 0) return;

  const doPrefetch = () => {
    for (const tf of adjacent) {
      const k = key(symbol, tf);
      // Skip if already cached and fresh
      const entry = cache.get(k);
      if (entry && Date.now() - entry.timestamp < getTTL(tf)) continue;
      // Skip if already in flight
      if (inflight.has(k)) continue;
      // Fire-and-forget
      getChartDataCached(symbol, tf).catch(() => {
        /* silently ignore prefetch failures */
      });
    }
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(doPrefetch);
  } else {
    setTimeout(doPrefetch, 200);
  }
}

/**
 * Invalidate a single cache entry (e.g. on forced refresh).
 */
export function invalidateChart(symbol: string, timeframe: string): void {
  cache.delete(key(symbol, timeframe));
}

/**
 * Clear the entire chart cache.
 */
export function clearChartCache(): void {
  cache.clear();
}
