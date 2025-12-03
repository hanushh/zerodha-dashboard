/**
 * Fund Portfolio Scraper - Re-export from modular structure
 * 
 * This file maintains backward compatibility while the actual implementation
 * is split across multiple files in the ./fund/ directory.
 */

export * from './fund';
export { fetchFundPortfolio } from './fund';
