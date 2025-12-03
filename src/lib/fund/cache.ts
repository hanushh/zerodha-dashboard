/**
 * Server-side cache for fund portfolio data
 * Reduces 3rd party API calls (Groww, etc.)
 */

import { FundPortfolio } from './types';

interface CacheEntry {
  data: FundPortfolio;
  timestamp: number;
}

// Cache TTL - 24 hours
const CACHE_TTL = 24 * 60 * 60 * 1000;

// In-memory cache (persists as long as server is running)
const portfolioCache = new Map<string, CacheEntry>();

/**
 * Get cached portfolio data
 */
export function getCachedPortfolio(isin: string): FundPortfolio | null {
  const entry = portfolioCache.get(isin);
  
  if (!entry) {
    return null;
  }
  
  // Check expiry
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    portfolioCache.delete(isin);
    return null;
  }
  
  return entry.data;
}

/**
 * Cache portfolio data
 */
export function cachePortfolio(isin: string, data: FundPortfolio): void {
  portfolioCache.set(isin, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; entries: { isin: string; age: string }[] } {
  const entries = Array.from(portfolioCache.entries()).map(([isin, entry]) => ({
    isin,
    age: `${Math.round((Date.now() - entry.timestamp) / 60000)}m ago`,
  }));
  
  return {
    size: portfolioCache.size,
    entries,
  };
}

