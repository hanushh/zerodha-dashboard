/**
 * ET Money scraper for fund holdings
 */

import { FundPortfolio, FundHolding } from '../types';
import { fetchWithTimeout } from '../utils';

/**
 * Scrape from ET Money
 */
export async function scrapeETMoney(isin: string, fundName: string): Promise<FundPortfolio | null> {
  try {
    const searchUrl = `https://www.etmoney.com/api/v2/mf/search?q=${encodeURIComponent(fundName.substring(0, 30))}`;
    const searchResponse = await fetchWithTimeout(searchUrl, 10000, { 'Accept': 'application/json' });
    
    if (!searchResponse.ok) {
      return null;
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData?.data || searchData.data.length === 0) {
      return null;
    }
    
    const fund = searchData.data.find((f: { isin?: string }) => f.isin === isin) || searchData.data[0];
    const fundSlug = fund.slug || fund.id;
    
    if (!fundSlug) {
      return null;
    }
    
    const detailsUrl = `https://www.etmoney.com/api/v2/mf/fund/${fundSlug}/portfolio`;
    const detailsResponse = await fetchWithTimeout(detailsUrl, 10000, { 'Accept': 'application/json' });
    
    if (!detailsResponse.ok) {
      return null;
    }
    
    const detailsData = await detailsResponse.json();
    
    const rawHoldings = detailsData?.data?.holdings || [];
    const holdings: FundHolding[] = rawHoldings.map((h: {
      name?: string;
      company_name?: string;
      percentage?: number;
      weight?: number;
      sector?: string;
    }) => ({
      name: h.name || h.company_name || 'Unknown',
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
        source: 'ET Money',
      };
    }
    
    return null;
  } catch {
    return null;
  }
}
