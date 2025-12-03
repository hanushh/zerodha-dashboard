/**
 * Tickertape.in scraper for fund holdings
 */

import { FundPortfolio, FundHolding } from '../types';
import { fetchWithTimeout } from '../utils';

/**
 * Scrape holdings from Tickertape
 */
export async function scrapeTickertape(isin: string, fundName: string): Promise<FundPortfolio | null> {
  try {
    // Search for the fund
    const searchUrl = `https://api.tickertape.in/search?text=${encodeURIComponent(fundName.substring(0, 30))}&types=mf`;
    const searchResponse = await fetchWithTimeout(searchUrl, 10000, { 'Accept': 'application/json' });
    
    if (!searchResponse.ok) {
      return null;
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData?.data || searchData.data.length === 0) {
      return null;
    }
    
    const fund = searchData.data.find((f: { isin?: string }) => f.isin === isin) || searchData.data[0];
    const slug = fund.slug || fund.sid;
    
    if (!slug) {
      return null;
    }
    
    // Fetch holdings
    const holdingsUrl = `https://api.tickertape.in/mutualfunds/view/${slug}?pageId=holdings`;
    const holdingsResponse = await fetchWithTimeout(holdingsUrl, 10000, { 'Accept': 'application/json' });
    
    if (!holdingsResponse.ok) {
      return null;
    }
    
    const holdingsData = await holdingsResponse.json();
    
    const rawHoldings = holdingsData?.data?.holdings?.equity || 
                        holdingsData?.data?.holdings?.debt || 
                        holdingsData?.data?.holdings || [];
    
    const holdings: FundHolding[] = rawHoldings.map((h: {
      name?: string;
      stock?: string;
      percentage?: number;
      weight?: number;
      sector?: string;
    }) => ({
      name: h.name || h.stock || 'Unknown',
      percentage: h.percentage || h.weight || 0,
      sector: h.sector,
    })).filter((h: FundHolding) => h.percentage > 0);
    
    if (holdings.length > 0) {
      return {
        fundName: fund.name || fundName,
        isin,
        holdings,
        sectorAllocation: [],
        assetAllocation: [],
        lastUpdated: new Date().toISOString(),
        source: 'Tickertape',
      };
    }
    
    return null;
  } catch {
    return null;
  }
}
