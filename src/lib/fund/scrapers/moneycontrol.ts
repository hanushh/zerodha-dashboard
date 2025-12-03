/**
 * Moneycontrol.com scraper for fund holdings
 */

import * as cheerio from 'cheerio';
import { FundPortfolio, FundHolding, SectorAllocation } from '../types';
import { fetchWithTimeout } from '../utils';

/**
 * Scrape from Moneycontrol
 */
export async function scrapeMoneycontrol(isin: string, fundName: string): Promise<FundPortfolio | null> {
  try {
    const searchUrl = `https://www.moneycontrol.com/mc/widget/mfsearch?classic=true&query=${encodeURIComponent(fundName.substring(0, 40))}&type=1&format=json`;
    const searchResponse = await fetchWithTimeout(searchUrl, 10000);
    
    if (!searchResponse.ok) {
      return null;
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData?.result || searchData.result.length === 0) {
      return null;
    }
    
    const fund = searchData.result[0];
    const fundUrl = fund.link_src;
    
    if (!fundUrl) {
      return null;
    }
    
    // Get portfolio page URL
    const portfolioUrl = `https://www.moneycontrol.com${fundUrl.replace('/nav/', '/portfolio-holdings/')}`;
    const pageResponse = await fetchWithTimeout(portfolioUrl, 10000);
    
    if (!pageResponse.ok) {
      return null;
    }
    
    const html = await pageResponse.text();
    const $ = cheerio.load(html);
    
    const holdings: FundHolding[] = [];
    const sectorAllocation: SectorAllocation[] = [];
    
    // Try multiple selectors for holdings
    const selectors = [
      '#portfolio_equity tbody tr',
      '.port_table tbody tr',
      '.portfolio_table tbody tr',
      '.equity_holding tbody tr',
      'table[data-type="equity"] tbody tr',
    ];
    
    for (const selector of selectors) {
      $(selector).each((_, row) => {
        const cols = $(row).find('td');
        if (cols.length >= 2) {
          const nameEl = $(cols[0]).find('a').first();
          const name = nameEl.text().trim() || $(cols[0]).text().trim();
          const percentText = $(cols[cols.length - 1]).text().trim();
          const percentage = parseFloat(percentText.replace('%', '').replace(',', '')) || 0;
          
          if (name && percentage > 0 && !name.toLowerCase().includes('total')) {
            holdings.push({ name, percentage });
          }
        }
      });
      
      if (holdings.length > 0) break;
    }
    
    // Parse sector allocation
    $('#sector_wise tbody tr, .sector_table tbody tr').each((_, row) => {
      const cols = $(row).find('td');
      if (cols.length >= 2) {
        const sector = $(cols[0]).text().trim();
        const percentText = $(cols[1]).text().trim();
        const percentage = parseFloat(percentText.replace('%', '').replace(',', '')) || 0;
        
        if (sector && percentage > 0) {
          sectorAllocation.push({ sector, percentage });
        }
      }
    });
    
    if (holdings.length > 0) {
      return {
        fundName: fund.scheme_name || fundName,
        isin,
        holdings,
        sectorAllocation,
        assetAllocation: [],
        lastUpdated: new Date().toISOString(),
        source: 'Moneycontrol',
      };
    }
    
    return null;
  } catch {
    return null;
  }
}
