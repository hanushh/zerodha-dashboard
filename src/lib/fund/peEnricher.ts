/**
 * P/E Ratio enrichment for stock holdings
 */

import * as cheerio from 'cheerio';
import { FundHolding, FundMetrics } from './types';
import { fetchWithTimeout, isDebtInstrument, cleanCompanyName, sleep } from './utils';

// Cache for stock P/E data
const peCache: Map<string, { pe: number; marketCap?: string; timestamp: number }> = new Map();
const symbolCache: Map<string, { symbol: string; timestamp: number }> = new Map();
const PE_CACHE_TTL = 3600000; // 1 hour
const SYMBOL_CACHE_TTL = 86400000; // 24 hours

/**
 * Search for NSE symbol
 */
async function searchNSESymbol(companyName: string): Promise<string | null> {
  try {
    const cacheKey = companyName.toLowerCase().trim();
    const cached = symbolCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SYMBOL_CACHE_TTL) {
      return cached.symbol;
    }
    
    const searchQuery = cleanCompanyName(companyName);
    const url = `https://www.nseindia.com/api/search/autocomplete?q=${encodeURIComponent(searchQuery)}`;
    
    const response = await fetchWithTimeout(url, 8000, {
      'Accept': 'application/json',
      'Referer': 'https://www.nseindia.com/',
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data?.symbols && data.symbols.length > 0) {
        const equitySymbol = data.symbols.find((s: { symbol_info?: string }) => 
          s.symbol_info?.includes('EQ') || s.symbol_info?.includes('equity')
        ) || data.symbols[0];
        
        if (equitySymbol?.symbol) {
          symbolCache.set(cacheKey, { symbol: equitySymbol.symbol, timestamp: Date.now() });
          return equitySymbol.symbol;
        }
      }
    }
  } catch {
    // Silent fail
  }
  return null;
}

/**
 * Fetch P/E from Screener.in
 */
async function fetchPEFromScreener(companyName: string): Promise<{ pe?: number; marketCap?: string; symbol?: string } | null> {
  try {
    const cacheKey = companyName.toLowerCase().trim();
    const cached = peCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PE_CACHE_TTL) {
      return { pe: cached.pe, marketCap: cached.marketCap };
    }
    
    const searchQuery = cleanCompanyName(companyName);
    const url = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(searchQuery)}`;
    
    const response = await fetchWithTimeout(url, 10000);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data && data.length > 0) {
        const company = data[0];
        const companyUrl = `https://www.screener.in${company.url}`;
        const symbolMatch = company.url?.match(/\/company\/([^\/]+)\//);
        const symbol = symbolMatch ? symbolMatch[1] : undefined;
        
        const pageResponse = await fetchWithTimeout(companyUrl, 10000);
        
        if (pageResponse.ok) {
          const html = await pageResponse.text();
          const $ = cheerio.load(html);
          
          let pe: number | undefined;
          let marketCap: string | undefined;
          
          $('li, .company-ratios span, #top-ratios li').each((_, el) => {
            const text = $(el).text();
            if (text.includes('Stock P/E') || text.includes('P/E')) {
              const match = text.match(/[\d,.]+/);
              if (match) {
                pe = parseFloat(match[0].replace(/,/g, ''));
              }
            }
            if (text.includes('Market Cap')) {
              const match = text.match(/₹?\s*([\d,.]+)\s*(Cr|Lakh Cr|L Cr)?/i);
              if (match) {
                marketCap = `₹${match[1]} ${match[2] || 'Cr'}`;
              }
            }
          });
          
          if (pe) {
            peCache.set(cacheKey, { pe, marketCap, timestamp: Date.now() });
            return { pe, marketCap, symbol };
          }
        }
      }
    }
  } catch {
    // Silent fail
  }
  return null;
}

/**
 * Fetch stock P/E from available sources
 */
export async function fetchStockPE(stockName: string): Promise<{ pe?: number; marketCap?: string; symbol?: string }> {
  const screenerData = await fetchPEFromScreener(stockName);
  if (screenerData?.pe) {
    return screenerData;
  }
  
  const symbol = await searchNSESymbol(stockName);
  if (symbol) {
    return { symbol };
  }
  
  return {};
}

/**
 * Enrich holdings with P/E ratios
 */
export async function enrichHoldingsWithPE(holdings: FundHolding[]): Promise<FundHolding[]> {
  const batchSize = 5;
  const enrichedHoldings: FundHolding[] = [];
  
  // Process all holdings
  for (let i = 0; i < holdings.length; i += batchSize) {
    const batch = holdings.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (holding) => {
        if (isDebtInstrument(holding.name)) {
          return holding;
        }
        
        try {
          const peData = await fetchStockPE(holding.name);
          return {
            ...holding,
            symbol: peData.symbol || holding.symbol,
            pe: peData.pe || holding.pe,
            marketCap: peData.marketCap || holding.marketCap,
          };
        } catch {
          return holding;
        }
      })
    );
    
    enrichedHoldings.push(...batchResults);
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < holdings.length) {
      await sleep(200);
    }
  }
  
  return enrichedHoldings;
}

/**
 * Calculate portfolio metrics from holdings
 */
export function calculatePortfolioMetrics(holdings: FundHolding[]): FundMetrics {
  const holdingsWithPE = holdings.filter(h => h.pe && h.percentage);
  
  if (holdingsWithPE.length === 0) {
    return {};
  }
  
  const totalWeight = holdingsWithPE.reduce((sum, h) => sum + h.percentage, 0);
  const weightedPE = holdingsWithPE.reduce((sum, h) => sum + (h.pe! * h.percentage), 0) / totalWeight;
  
  return {
    peRatio: parseFloat(weightedPE.toFixed(2)),
  };
}
