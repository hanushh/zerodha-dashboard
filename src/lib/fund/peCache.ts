/**
 * Server-side cache for P/E data
 * Reduces Screener.in API calls
 */

interface PECacheEntry {
  pe?: number;
  marketCap?: string;
  symbol?: string;
  timestamp: number;
}

// Cache TTL - 24 hours
const PE_CACHE_TTL = 24 * 60 * 60 * 1000;

// In-memory cache
const peCache = new Map<string, PECacheEntry>();

/**
 * Get cached P/E data for a stock
 */
export function getCachedPE(stockName: string): PECacheEntry | null {
  const key = stockName.toLowerCase().trim();
  const entry = peCache.get(key);
  
  if (!entry) {
    return null;
  }
  
  // Check expiry
  if (Date.now() - entry.timestamp > PE_CACHE_TTL) {
    peCache.delete(key);
    return null;
  }
  
  return entry;
}

/**
 * Cache P/E data for a stock
 */
export function cachePE(stockName: string, data: { pe?: number; marketCap?: string; symbol?: string }): void {
  const key = stockName.toLowerCase().trim();
  peCache.set(key, {
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * Get multiple cached P/E entries
 */
export function getCachedPEBatch(stockNames: string[]): Map<string, PECacheEntry | null> {
  const results = new Map<string, PECacheEntry | null>();
  
  for (const name of stockNames) {
    results.set(name, getCachedPE(name));
  }
  
  return results;
}

