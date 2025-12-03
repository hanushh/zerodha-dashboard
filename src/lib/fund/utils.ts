/**
 * Utility functions for fund scraping
 */

// User agent to mimic browser
export const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetch with timeout and headers
 */
export async function fetchWithTimeout(
  url: string, 
  timeout = 15000, 
  headers?: Record<string, string>
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const requestHeaders = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
    ...headers,
  };
  
  try {
    const response = await fetch(url, {
      headers: requestHeaders,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Format market cap value
 */
export function formatMarketCap(value: number): string {
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L Cr`;
  } else if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K Cr`;
  }
  return `₹${value.toFixed(0)} Cr`;
}

/**
 * Check if it's a debt instrument
 */
export function isDebtInstrument(name: string): boolean {
  const debtKeywords = [
    'government', 'g-sec', 'gsec', 'treasury', 't-bill', 'ncd', 
    'debenture', 'bond', 'cp', 'cd', 'certificate', 'deposit', 
    'repo', 'cblo', '%', 'sovereign'
  ];
  const lowerName = name.toLowerCase();
  return debtKeywords.some(keyword => lowerName.includes(keyword));
}

/**
 * Determine fund type from name
 */
export function getFundType(fundName: string): 'debt' | 'equity' | 'hybrid' {
  const lowerName = fundName.toLowerCase();
  
  if (lowerName.includes('debt') || lowerName.includes('bond') || 
      lowerName.includes('liquid') || lowerName.includes('credit') || 
      lowerName.includes('gilt') || lowerName.includes('overnight') ||
      lowerName.includes('money market') || lowerName.includes('short term') || 
      lowerName.includes('duration')) {
    return 'debt';
  }
  
  if (lowerName.includes('hybrid') || lowerName.includes('balanced') || 
      lowerName.includes('advantage') || lowerName.includes('arbitrage')) {
    return 'hybrid';
  }
  
  return 'equity';
}

/**
 * Clean company name for search
 */
export function cleanCompanyName(name: string): string {
  return name
    .replace(/\s+Ltd\.?$/i, '')
    .replace(/\s+Limited$/i, '')
    .replace(/\s+Private$/i, '')
    .replace(/\s+Pvt\.?$/i, '')
    .trim();
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

