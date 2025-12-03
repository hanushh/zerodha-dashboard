/**
 * Value Research Online scraper for fund holdings
 */

import * as cheerio from 'cheerio';
import { FundPortfolio, FundHolding } from '../types';
import { fetchWithTimeout } from '../utils';

/**
 * Scrape from Value Research
 */
export async function scrapeValueResearch(isin: string, fundName: string): Promise<FundPortfolio | null> {
  try {
    // Search for the fund
    const searchUrl = `https://www.valueresearchonline.com/api/mutualfund/search?q=${encodeURIComponent(fundName.substring(0, 30))}`;
    const searchResponse = await fetchWithTimeout(searchUrl, 10000);
    
    if (!searchResponse.ok) {
      return null;
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData || searchData.length === 0) {
      return null;
    }
    
    const fund = searchData.find((f: { isin?: string }) => f.isin === isin) || searchData[0];
    const fundId = fund.id || fund.fundId;
    
    if (!fundId) {
      return null;
    }
    
    // Fetch portfolio page
    const portfolioUrl = `https://www.valueresearchonline.com/funds/${fundId}/portfolio/`;
    const pageResponse = await fetchWithTimeout(portfolioUrl, 10000);
    
    if (!pageResponse.ok) {
      return null;
    }
    
    const html = await pageResponse.text();
    const $ = cheerio.load(html);
    
    const holdings: FundHolding[] = [];
    
    // Parse holdings table
    $('table.holding-table tbody tr, table.portfolio-table tbody tr').each((_, row) => {
      const cols = $(row).find('td');
      if (cols.length >= 2) {
        const name = $(cols[0]).text().trim();
        const percentText = $(cols[cols.length - 1]).text().trim();
        const percentage = parseFloat(percentText.replace('%', '').replace(',', '')) || 0;
        
        if (name && percentage > 0 && name !== 'Total') {
          holdings.push({ name, percentage });
        }
      }
    });
    
    if (holdings.length > 0) {
      return {
        fundName: fund.name || fundName,
        isin,
        holdings,
        sectorAllocation: [],
        assetAllocation: [],
        lastUpdated: new Date().toISOString(),
        source: 'Value Research',
      };
    }
    
    return null;
  } catch {
    return null;
  }
}
