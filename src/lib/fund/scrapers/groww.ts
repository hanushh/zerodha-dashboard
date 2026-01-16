/**
 * Groww.in scraper for fund holdings
 * Uses HTML page scraping to extract __NEXT_DATA__ JSON
 */

import { FundPortfolio, FundHolding, SectorAllocation } from '../types';
import { fetchWithTimeout } from '../utils';

interface GrowwHolding {
  company_name?: string;
  companyName?: string;
  instrument_name?: string;
  instrumentName?: string;
  corp_name?: string;
  corpName?: string;
  name?: string;
  corpus_per?: number;
  holding_perc?: number;
  holdingPerc?: number;
  percentage?: number;
  sector_name?: string;
  sector?: string;
  stock_search_id?: string;
}

interface GrowwSector {
  sector?: string;
  sector_name?: string;
  holdingPerc?: number;
  holding_perc?: number;
  percentage?: number;
  corpus_per?: number;
}

/**
 * Extract JSON from __NEXT_DATA__ script tag
 */
function extractNextData(html: string): Record<string, unknown> | null {
  try {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (match && match[1]) {
      return JSON.parse(match[1]);
    }
  } catch {
    // Silent fail
  }
  return null;
}

/**
 * Search for fund on Groww
 */
async function searchGrowwFund(query: string): Promise<{ searchId: string; title: string } | null> {
  try {
    const searchUrl = `https://groww.in/v1/api/search/v1/entity?app=true&entity_type=scheme&q=${encodeURIComponent(query)}&size=5`;
    const response = await fetchWithTimeout(searchUrl, 10000, { 'Accept': 'application/json' });
    
    if (response.ok) {
      const data = await response.json();
      if (data?.content && data.content.length > 0) {
        return {
          searchId: data.content[0].search_id || data.content[0].id,
          title: data.content[0].title,
        };
      }
    }
  } catch {
    // Silent fail
  }
  return null;
}

/**
 * Scrape from Groww by fetching the fund page HTML
 */
export async function scrapeGroww(isin: string, fundName: string): Promise<FundPortfolio | null> {
  try {
    // Search to get fund slug
    let searchResult = await searchGrowwFund(fundName.substring(0, 30));
    if (!searchResult) {
      searchResult = await searchGrowwFund(isin);
    }
    
    if (!searchResult?.searchId) {
      return null;
    }
    
    // Fetch fund page HTML
    const pageUrl = `https://groww.in/mutual-funds/${searchResult.searchId}`;
    const pageResponse = await fetchWithTimeout(pageUrl, 15000, {
      'Accept': 'text/html,application/xhtml+xml',
    });
    
    if (!pageResponse.ok) {
      return null;
    }
    
    const html = await pageResponse.text();
    const nextData = extractNextData(html);
    
    if (!nextData) {
      return null;
    }
    
    // Navigate to mf data (Groww uses mfServerSideData or mf depending on version)
    const props = nextData.props as Record<string, unknown> | undefined;
    const pageProps = props?.pageProps as Record<string, unknown> | undefined;
    const mfData = (pageProps?.mfServerSideData || pageProps?.mf) as Record<string, unknown> | undefined;
    
    if (!mfData) {
      return null;
    }
    
    // Extract holdings
    const rawHoldings = (mfData.holdings || []) as GrowwHolding[];
    
    const holdings: FundHolding[] = rawHoldings.map((h: GrowwHolding) => ({
      name: h.company_name || h.companyName || h.instrument_name || 
            h.instrumentName || h.corp_name || h.corpName || h.name || 'Unknown',
      percentage: h.corpus_per || h.holding_perc || h.holdingPerc || h.percentage || 0,
      sector: h.sector_name || h.sector,
      symbol: h.stock_search_id,
    })).filter((h: FundHolding) => h.percentage > 0);
    
    // Extract sector allocation
    const rawSectors = (mfData.sectors || mfData.sector_allocation || []) as GrowwSector[];
    const sectorAllocation: SectorAllocation[] = rawSectors.map((s: GrowwSector) => ({
      sector: s.sector || s.sector_name || 'Other',
      percentage: s.holdingPerc || s.holding_perc || s.percentage || s.corpus_per || 0,
    })).filter((s: SectorAllocation) => s.percentage > 0);
    
    if (holdings.length > 0) {
      // NAV can be a number directly or nested in an object
      const navValue = typeof mfData.nav === 'number' 
        ? mfData.nav 
        : (mfData.nav as Record<string, unknown> | undefined)?.nav as number | undefined;
      
      return {
        fundName: (mfData.scheme_name as string) || (mfData.fund_name as string) || fundName,
        isin: (mfData.isin as string) || isin,
        category: (mfData.sub_category as string) || (mfData.category as string),
        fundHouse: (mfData.amc as string) || (mfData.fund_house as string),
        nav: navValue,
        holdings,
        sectorAllocation,
        assetAllocation: [],
        lastUpdated: new Date().toISOString(),
        source: 'Groww',
      };
    }
    
    return null;
  } catch {
    return null;
  }
}
