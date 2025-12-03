/**
 * MFAPI.in - Basic fund information
 */

import { FundPortfolio } from '../types';
import { fetchWithTimeout } from '../utils';

/**
 * Get scheme code from MFAPI
 */
async function getSchemeCode(isin: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(`https://api.mfapi.in/mf/search?q=${isin}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        return data[0].schemeCode?.toString();
      }
    }
  } catch {
    // Silent fail
  }
  return null;
}

/**
 * Fetch fund info from MFAPI
 */
export async function fetchFromMFAPI(isin: string): Promise<Partial<FundPortfolio> | null> {
  try {
    const schemeCode = await getSchemeCode(isin);
    if (!schemeCode) {
      return null;
    }
    
    const response = await fetchWithTimeout(`https://api.mfapi.in/mf/${schemeCode}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      fundName: data.meta?.scheme_name || '',
      isin,
      schemeCode,
      category: data.meta?.scheme_category || '',
      fundHouse: data.meta?.fund_house || '',
      nav: data.data?.[0]?.nav ? parseFloat(data.data[0].nav) : undefined,
      navDate: data.data?.[0]?.date || '',
      source: 'MFAPI',
    };
  } catch {
    return null;
  }
}
