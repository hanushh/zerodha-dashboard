/**
 * Type definitions for Fund Portfolio
 */

export interface FundHolding {
  name: string;
  symbol?: string;
  sector?: string;
  percentage: number;
  value?: number;
  quantity?: number;
  pe?: number;
  marketCap?: string;
  priceChange?: number;
}

export interface SectorAllocation {
  sector: string;
  percentage: number;
}

export interface AssetAllocation {
  type: string;
  percentage: number;
}

export interface FundMetrics {
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;
  avgMarketCap?: string;
  turnoverRatio?: number;
  standardDeviation?: number;
  sharpeRatio?: number;
  beta?: number;
  alpha?: number;
}

export interface FundPortfolio {
  fundName: string;
  isin: string;
  schemeCode?: string;
  category?: string;
  fundHouse?: string;
  aum?: string;
  expenseRatio?: string;
  nav?: number;
  navDate?: string;
  holdings: FundHolding[];
  sectorAllocation: SectorAllocation[];
  assetAllocation: AssetAllocation[];
  metrics?: FundMetrics;
  lastUpdated: string;
  source: string;
  error?: string;
}

export type FundType = 'debt' | 'equity' | 'hybrid';

