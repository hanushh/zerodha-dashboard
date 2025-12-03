/**
 * Fund Portfolio Scraper - Main Entry Point
 */

import { FundPortfolio, FundHolding } from './types';
import { enrichHoldingsWithPE, calculatePortfolioMetrics } from './peEnricher';
import { getCachedPortfolio, cachePortfolio, getCacheStats } from './cache';
import {
  fetchFromMFAPI,
  scrapeGroww,
  scrapeTickertape,
  scrapeMoneycontrol,
  scrapeValueResearch,
  scrapeETMoney,
} from './scrapers';

// Re-export types and utilities
export * from './types';
export { enrichHoldingsWithPE, calculatePortfolioMetrics };
export { getCacheStats };

// Scraper sources in priority order
const SCRAPERS = [
  { name: 'Groww', fn: scrapeGroww },
  { name: 'Tickertape', fn: scrapeTickertape },
  { name: 'Moneycontrol', fn: scrapeMoneycontrol },
  { name: 'ValueResearch', fn: scrapeValueResearch },
  { name: 'ETMoney', fn: scrapeETMoney },
];

/**
 * Main function to fetch fund portfolio (with server-side caching)
 */
export async function fetchFundPortfolio(isin: string, fundName: string): Promise<FundPortfolio> {
  // Check server cache first
  const cached = getCachedPortfolio(isin);
  if (cached) {
    console.log(`📦 Server cache hit: ${fundName}`);
    return cached;
  }
  
  console.log(`📊 Fetching from API: ${fundName} (${isin})`);
  
  // Fetch basic info from MFAPI
  const mfapiData = await fetchFromMFAPI(isin);
  
  // Try each scraper until one succeeds
  let portfolio: FundPortfolio | null = null;
  
  for (const scraper of SCRAPERS) {
    try {
      const result = await scraper.fn(isin, fundName);
      
      if (result && result.holdings.length > 0) {
        console.log(`✓ ${scraper.name}: ${result.holdings.length} holdings`);
        portfolio = result;
        break;
      }
    } catch {
      // Continue to next scraper
    }
  }
  
  // Build final result
  let result: FundPortfolio;
  
  if (portfolio && portfolio.holdings.length > 0) {
    result = {
      ...portfolio,
      fundName: mfapiData?.fundName || portfolio.fundName || fundName,
      category: mfapiData?.category || portfolio.category,
      fundHouse: mfapiData?.fundHouse,
      nav: mfapiData?.nav || portfolio.nav,
      navDate: mfapiData?.navDate,
    };
    
    // Cache successful result on server
    cachePortfolio(isin, result);
    console.log(`💾 Cached: ${fundName}`);
  } else {
    // All scrapers failed
    console.log(`✗ No holdings found for ${fundName}`);
    result = {
      fundName: mfapiData?.fundName || fundName,
      isin,
      category: mfapiData?.category,
      fundHouse: mfapiData?.fundHouse,
      nav: mfapiData?.nav,
      navDate: mfapiData?.navDate,
      holdings: [],
      sectorAllocation: [],
      assetAllocation: [],
      lastUpdated: new Date().toISOString(),
      source: 'No data available',
      error: 'Failed to fetch holdings from all sources',
    };
  }
  
  return result;
}

/**
 * Fetch P/E ratios for holdings (call separately when requested)
 */
export async function fetchHoldingsPE(holdings: FundHolding[]): Promise<FundHolding[]> {
  console.log(`📈 Fetching P/E ratios for ${holdings.length} holdings...`);
  const enrichedHoldings = await enrichHoldingsWithPE(holdings);
  console.log(`✓ P/E enrichment complete`);
  
  return enrichedHoldings;
}
