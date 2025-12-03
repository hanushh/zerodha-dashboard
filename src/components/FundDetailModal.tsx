'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MFHolding } from '@/lib/kite';
import { FundPortfolio, FundHolding, SectorAllocation, FundMetrics } from '@/lib/fundScraper';
import { HoldingRow } from './HoldingRow';

interface FundDetailModalProps {
  fund: MFHolding;
  onClose: () => void;
}

// Cache TTL - 24 hours
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface CacheEntry {
  data: FundPortfolio;
  timestamp: number;
}

interface PECacheEntry {
  pe?: number;
  marketCap?: string;
  symbol?: string;
  timestamp: number;
}

// Get cached portfolio from localStorage
function getCachedPortfolio(isin: string): FundPortfolio | null {
  try {
    const key = `fund_portfolio_${isin}`;
    const cached = localStorage.getItem(key);
    
    if (!cached) return null;
    
    const entry: CacheEntry = JSON.parse(cached);
    
    // Check expiry
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    
    return entry.data;
  } catch {
    return null;
  }
}

// Cache portfolio to localStorage
function cachePortfolio(isin: string, data: FundPortfolio): void {
  try {
    const key = `fund_portfolio_${isin}`;
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable - ignore
  }
}

// Get cached P/E data from localStorage
function getCachedPE(stockName: string): PECacheEntry | null {
  try {
    const key = `pe_${stockName.toLowerCase().trim()}`;
    const cached = localStorage.getItem(key);
    
    if (!cached) return null;
    
    const entry: PECacheEntry = JSON.parse(cached);
    
    // Check expiry (24 hours)
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    
    return entry;
  } catch {
    return null;
  }
}

// Cache P/E data to localStorage
function cachePE(stockName: string, data: { pe?: number; marketCap?: string; symbol?: string }): void {
  try {
    const key = `pe_${stockName.toLowerCase().trim()}`;
    const entry: PECacheEntry = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable - ignore
  }
}

// Get multiple P/E from cache
function getCachedPEBatch(stockNames: string[]): Map<string, PECacheEntry | null> {
  const results = new Map<string, PECacheEntry | null>();
  for (const name of stockNames) {
    results.set(name, getCachedPE(name));
  }
  return results;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Calculate weighted average P/E
function calculateWeightedPE(holdings: FundHolding[]): string {
  const holdingsWithPE = holdings.filter(h => h.pe && h.percentage);
  
  if (holdingsWithPE.length === 0) return 'N/A';
  
  const totalWeight = holdingsWithPE.reduce((sum, h) => sum + h.percentage, 0);
  const weightedSum = holdingsWithPE.reduce((sum, h) => sum + (h.pe! * h.percentage), 0);
  
  return (weightedSum / totalWeight).toFixed(1);
}

// Metric Card Component
function MetricCard({ 
  label, 
  value, 
  description, 
  color 
}: { 
  label: string; 
  value: string; 
  description: string; 
  color: 'amber' | 'blue' | 'emerald' | 'purple' | 'red' | 'cyan';
}) {
  const colorClasses = {
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorClasses[color].split(' ')[2]}`}>{value}</p>
      <p className="text-slate-500 text-xs mt-1">{description}</p>
    </div>
  );
}

export function FundDetailModal({ fund, onClose }: FundDetailModalProps) {
  const [fundData, setFundData] = useState<FundPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPEEnabled, setIsPEEnabled] = useState(false);
  const [loadingIndices, setLoadingIndices] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'holdings' | 'sectors' | 'metrics' | 'info'>('holdings');
  
  // Queue for batching P/E requests
  const pendingIndices = useRef<Set<number>>(new Set());
  const fetchedIndices = useRef<Set<number>>(new Set());
  const batchTimeout = useRef<NodeJS.Timeout | null>(null);
  const isFetching = useRef(false);
  const abortController = useRef<AbortController | null>(null);

  const invested = fund.average_price * fund.quantity;
  const current = fund.last_price * fund.quantity;
  const pnl = current - invested;
  const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
  const isProfit = pnl >= 0;

  useEffect(() => {
    async function fetchFundData() {
      setIsLoading(true);
      setIsPEEnabled(false);
      
      // Check localStorage cache first
      const cached = getCachedPortfolio(fund.tradingsymbol);
      if (cached) {
        console.log('📦 Cache hit:', fund.fund);
        setFundData(cached);
        // Check if cached data already has P/E info
        if (cached.holdings?.some(h => h.pe)) {
          setIsPEEnabled(true);
        }
        setIsLoading(false);
        return;
      }
      
      // Fetch from API
      try {
        console.log('📊 Fetching:', fund.fund);
        const encodedName = encodeURIComponent(fund.fund);
        const response = await fetch(`/api/mf/${fund.tradingsymbol}?name=${encodedName}`);
        const data = await response.json();
        setFundData(data);
        
        // Cache if we got holdings
        if (data.holdings && data.holdings.length > 0) {
          cachePortfolio(fund.tradingsymbol, data);
        }
      } catch (error) {
        console.error('Error fetching fund data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFundData();
  }, [fund.tradingsymbol, fund.fund]);

  // Process pending indices in batches
  const processBatch = useCallback(async () => {
    if (!fundData?.holdings || isFetching.current) return;
    
    // Get indices that need fetching (not already fetched, not loading)
    const indicesToFetch = Array.from(pendingIndices.current)
      .filter(i => !fetchedIndices.current.has(i) && !loadingIndices.has(i))
      .slice(0, 10);
    
    if (indicesToFetch.length === 0) return;
    
    // Get stock names
    const stocks = indicesToFetch
      .filter(i => fundData.holdings[i] && !fundData.holdings[i].pe)
      .map(i => fundData.holdings[i].name);
    
    if (stocks.length === 0) {
      // Mark as fetched even if no stocks needed
      indicesToFetch.forEach(i => fetchedIndices.current.add(i));
      return;
    }
    
    isFetching.current = true;
    
    // Mark as loading
    setLoadingIndices(prev => new Set([...prev, ...indicesToFetch]));
    
    // Mark as fetched so we don't try again
    indicesToFetch.forEach(i => {
      fetchedIndices.current.add(i);
      pendingIndices.current.delete(i);
    });
    
    try {
      // Create new abort controller for this request
      abortController.current = new AbortController();
      
      const response = await fetch('/api/mf/pe/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stocks }),
        signal: abortController.current.signal,
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update holdings with P/E data
        setFundData(prev => {
          if (!prev) return prev;
          
          const updatedHoldings = [...prev.holdings];
          
          for (const result of data.results) {
            const idx = updatedHoldings.findIndex(h => h.name === result.name);
            if (idx !== -1) {
              updatedHoldings[idx] = {
                ...updatedHoldings[idx],
                pe: result.pe || updatedHoldings[idx].pe,
                marketCap: result.marketCap || updatedHoldings[idx].marketCap,
                symbol: result.symbol || updatedHoldings[idx].symbol,
              };
            }
          }
          
          const updatedData = { ...prev, holdings: updatedHoldings };
          
          // Update localStorage cache
          cachePortfolio(fund.tradingsymbol, updatedData);
          
          return updatedData;
        });
      }
    } catch (error) {
      // Ignore abort errors (modal closed)
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching P/E batch:', error);
      // Remove from fetched so it can retry
      indicesToFetch.forEach(i => fetchedIndices.current.delete(i));
    } finally {
      setLoadingIndices(prev => {
        const next = new Set(prev);
        indicesToFetch.forEach(i => next.delete(i));
        return next;
      });
      isFetching.current = false;
      abortController.current = null;
      
      // Check if there are more pending items (only if not aborted)
      if (pendingIndices.current.size > 0) {
        setTimeout(processBatch, 100);
      }
    }
  }, [fundData, fund.tradingsymbol, loadingIndices]);

  // Handle when a holding becomes visible - queue for batch fetch
  const handleHoldingVisible = useCallback((index: number) => {
    if (!isPEEnabled) return;
    if (fetchedIndices.current.has(index)) return;
    if (fundData?.holdings[index]?.pe) return;
    
    pendingIndices.current.add(index);
    
    // Debounce: collect visible items for 200ms, then process
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
    
    batchTimeout.current = setTimeout(processBatch, 200);
  }, [isPEEnabled, fundData, processBatch]);

  // Enable P/E lazy loading
  function enablePELoading() {
    // Reset tracking sets
    pendingIndices.current.clear();
    fetchedIndices.current.clear();
    setIsPEEnabled(true);
  }
  
  // Cleanup on unmount - cancel pending requests and timeouts
  useEffect(() => {
    return () => {
      // Clear batch timeout
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }
      
      // Abort any in-flight fetch requests
      if (abortController.current) {
        abortController.current.abort();
      }
      
      // Clear pending queues
      pendingIndices.current.clear();
      isFetching.current = false;
    };
  }, []);

  // Color palette for sector chart
  const sectorColors = [
    'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
    'bg-teal-500', 'bg-rose-500'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-semibold text-white">{fund.fund}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                  ISIN: {fund.tradingsymbol}
                </span>
                <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                  Folio: {fund.folio}
                </span>
                {fundData?.category && (
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                    {fundData.category}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Investment Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-slate-800 rounded-xl p-3">
              <p className="text-slate-400 text-xs">Invested</p>
              <p className="text-white text-lg font-semibold">{formatCurrency(invested)}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <p className="text-slate-400 text-xs">Current Value</p>
              <p className="text-white text-lg font-semibold">{formatCurrency(current)}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <p className="text-slate-400 text-xs">P&L</p>
              <p className={`text-lg font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                {isProfit ? '+' : ''}{formatCurrency(pnl)}
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <p className="text-slate-400 text-xs">Returns</p>
              <p className={`text-lg font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics Bar (for equity funds) */}
        {fundData?.metrics && (fundData.metrics.peRatio || fundData.metrics.pbRatio) && (
          <div className="px-6 py-3 bg-gradient-to-r from-slate-800 to-slate-800/50 border-b border-slate-700">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {fundData.metrics.peRatio && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">P/E Ratio:</span>
                  <span className="text-amber-400 font-semibold">{fundData.metrics.peRatio}x</span>
                </div>
              )}
              {fundData.metrics.pbRatio && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">P/B Ratio:</span>
                  <span className="text-blue-400 font-semibold">{fundData.metrics.pbRatio}x</span>
                </div>
              )}
              {fundData.metrics.dividendYield && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Div Yield:</span>
                  <span className="text-emerald-400 font-semibold">{fundData.metrics.dividendYield}%</span>
                </div>
              )}
              {fundData.metrics.avgMarketCap && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Market Cap:</span>
                  <span className="text-purple-400 font-semibold">{fundData.metrics.avgMarketCap}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('holdings')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'holdings'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Holdings ({fundData?.holdings?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('sectors')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'sectors'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🎯 Sectors
          </button>
          {fundData?.metrics && (
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'metrics'
                  ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📈 Metrics
            </button>
          )}
          <button
            onClick={() => setActiveTab('info')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'info'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ℹ️ Info
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-350px)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-3 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
              <p className="text-slate-400 mt-4">Fetching fund portfolio...</p>
            </div>
          ) : (
            <>
              {/* Holdings Tab */}
              {activeTab === 'holdings' && (
                <div>
                  {fundData?.holdings && fundData.holdings.length > 0 ? (
                    <div className="space-y-2">
                      {/* P/E Enable Button */}
                      {!isPEEnabled && (
                        <div className="flex items-center justify-between mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                          <div>
                            <p className="text-slate-300 text-sm">Want to see P/E ratios?</p>
                            <p className="text-slate-500 text-xs">Loads as you scroll through holdings</p>
                          </div>
                          <button
                            onClick={enablePELoading}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            📊 Enable P/E Ratios
                          </button>
                        </div>
                      )}
                      
                      {isPEEnabled && (
                        <div className="mb-4 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                          <p className="text-emerald-400 text-xs text-center">
                            ✓ P/E ratios load automatically as you scroll
                          </p>
                        </div>
                      )}
                      
                      {/* Header Row */}
                      <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-400 border-b border-slate-700">
                        <div className="flex-1">Stock</div>
                        <div className="w-20 text-center">P/E</div>
                        <div className="w-24 text-center">Market Cap</div>
                        <div className="w-16 text-right">Weight</div>
                      </div>
                      
                      {fundData.holdings.map((holding: FundHolding, index: number) => (
                        <HoldingRow
                          key={`${holding.name}-${index}`}
                          holding={holding}
                          index={index}
                          onVisible={handleHoldingVisible}
                          isLoading={loadingIndices.has(index)}
                          isPEEnabled={isPEEnabled}
                        />
                      ))}
                      
                      {/* Weighted Average P/E */}
                      {fundData.holdings.some(h => h.pe) && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 rounded-xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-amber-400 font-semibold">Weighted Avg P/E</p>
                              <p className="text-slate-400 text-xs">Based on top holdings with P/E data</p>
                            </div>
                            <div className="text-2xl font-bold text-amber-400">
                              {calculateWeightedPE(fundData.holdings)}x
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* P/E Legend */}
                      <div className="mt-3 flex items-center gap-4 text-xs">
                        <span className="text-slate-400">P/E Guide:</span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span className="text-slate-400">&lt;20 (Value)</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          <span className="text-slate-400">20-35 (Fair)</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-400"></span>
                          <span className="text-slate-400">&gt;35 (Expensive)</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-400">No holdings data available</p>
                    </div>
                  )}
                  
                  {/* Data Source */}
                  {fundData?.source && (
                    <div className="mt-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                      <p className="text-slate-400 text-xs">
                        📡 Data source: <span className="text-slate-300">{fundData.source}</span>
                        {fundData.lastUpdated && (
                          <span className="ml-2">
                            • Updated: {new Date(fundData.lastUpdated).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Sectors Tab */}
              {activeTab === 'sectors' && (
                <div>
                  {fundData?.sectorAllocation && fundData.sectorAllocation.length > 0 ? (
                    <div className="space-y-4">
                      {/* Sector Bar Chart */}
                      <div className="space-y-3">
                        {fundData.sectorAllocation.map((sector: SectorAllocation, index: number) => (
                          <div key={sector.sector} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-white">{sector.sector}</span>
                              <span className="text-slate-400">{sector.percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-3">
                              <div
                                className={`${sectorColors[index % sectorColors.length]} h-3 rounded-full transition-all duration-500`}
                                style={{ width: `${sector.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Asset Allocation */}
                      {fundData.assetAllocation && fundData.assetAllocation.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-700">
                          <h3 className="text-white font-semibold mb-4">Asset Allocation</h3>
                          <div className="flex gap-4">
                            {fundData.assetAllocation.map((asset, index) => (
                              <div
                                key={asset.type}
                                className="flex-1 p-4 bg-slate-800 rounded-xl text-center"
                              >
                                <div className={`w-12 h-12 mx-auto mb-2 rounded-full ${sectorColors[index]} flex items-center justify-center`}>
                                  <span className="text-white font-bold">{asset.percentage}%</span>
                                </div>
                                <p className="text-white font-medium">{asset.type}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-400">No sector allocation data available</p>
                    </div>
                  )}
                </div>
              )}

              {/* Metrics Tab */}
              {activeTab === 'metrics' && fundData?.metrics && (
                <div className="space-y-6">
                  {/* Valuation Metrics */}
                  {(fundData.metrics.peRatio || fundData.metrics.pbRatio) && (
                    <div>
                      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <span>💰</span> Valuation Metrics
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {fundData.metrics.peRatio && (
                          <MetricCard
                            label="P/E Ratio"
                            value={`${fundData.metrics.peRatio}x`}
                            description="Price to Earnings"
                            color="amber"
                          />
                        )}
                        {fundData.metrics.pbRatio && (
                          <MetricCard
                            label="P/B Ratio"
                            value={`${fundData.metrics.pbRatio}x`}
                            description="Price to Book"
                            color="blue"
                          />
                        )}
                        {fundData.metrics.dividendYield && (
                          <MetricCard
                            label="Dividend Yield"
                            value={`${fundData.metrics.dividendYield}%`}
                            description="Annual dividend"
                            color="emerald"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Portfolio Characteristics */}
                  {(fundData.metrics.avgMarketCap || fundData.metrics.turnoverRatio) && (
                    <div>
                      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <span>📊</span> Portfolio Characteristics
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {fundData.metrics.avgMarketCap && (
                          <div className="p-4 bg-slate-800/50 rounded-xl">
                            <p className="text-slate-400 text-xs mb-1">Average Market Cap</p>
                            <p className="text-white font-semibold">{fundData.metrics.avgMarketCap}</p>
                          </div>
                        )}
                        {fundData.metrics.turnoverRatio && (
                          <div className="p-4 bg-slate-800/50 rounded-xl">
                            <p className="text-slate-400 text-xs mb-1">Portfolio Turnover</p>
                            <p className="text-white font-semibold">{fundData.metrics.turnoverRatio}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Risk Metrics */}
                  {(fundData.metrics.standardDeviation || fundData.metrics.sharpeRatio || fundData.metrics.beta) && (
                    <div>
                      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <span>⚡</span> Risk & Return Metrics
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {fundData.metrics.standardDeviation && (
                          <MetricCard
                            label="Std Deviation"
                            value={`${fundData.metrics.standardDeviation}%`}
                            description="Volatility measure"
                            color="red"
                          />
                        )}
                        {fundData.metrics.sharpeRatio && (
                          <MetricCard
                            label="Sharpe Ratio"
                            value={fundData.metrics.sharpeRatio.toString()}
                            description="Risk-adjusted return"
                            color="purple"
                          />
                        )}
                        {fundData.metrics.beta && (
                          <MetricCard
                            label="Beta"
                            value={fundData.metrics.beta.toString()}
                            description="Market sensitivity"
                            color="cyan"
                          />
                        )}
                        {fundData.metrics.alpha && (
                          <MetricCard
                            label="Alpha"
                            value={`${fundData.metrics.alpha > 0 ? '+' : ''}${fundData.metrics.alpha}%`}
                            description="Excess return"
                            color={fundData.metrics.alpha >= 0 ? 'emerald' : 'red'}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metrics Explanation */}
                  <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                    <h4 className="text-white font-medium mb-2">📖 What do these metrics mean?</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
                      <p><strong className="text-slate-300">P/E Ratio:</strong> Lower = potentially undervalued. Nifty avg ~22x</p>
                      <p><strong className="text-slate-300">P/B Ratio:</strong> Price relative to book value. Lower = cheaper</p>
                      <p><strong className="text-slate-300">Sharpe Ratio:</strong> Higher is better. &gt;1 is good, &gt;2 is excellent</p>
                      <p><strong className="text-slate-300">Beta:</strong> &lt;1 = less volatile than market, &gt;1 = more volatile</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info Tab */}
              {activeTab === 'info' && (
                <div className="space-y-4">
                  {/* Fund Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/50 rounded-xl">
                      <p className="text-slate-400 text-xs mb-1">Units Held</p>
                      <p className="text-white text-lg font-semibold">{fund.quantity.toFixed(3)}</p>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-xl">
                      <p className="text-slate-400 text-xs mb-1">Average NAV</p>
                      <p className="text-white text-lg font-semibold">₹{fund.average_price.toFixed(2)}</p>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-xl">
                      <p className="text-slate-400 text-xs mb-1">Current NAV</p>
                      <p className="text-white text-lg font-semibold">₹{fund.last_price.toFixed(4)}</p>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-xl">
                      <p className="text-slate-400 text-xs mb-1">NAV Date</p>
                      <p className="text-white text-lg font-semibold">{fundData?.navDate || '-'}</p>
                    </div>
                    {fundData?.fundHouse && (
                      <div className="p-4 bg-slate-800/50 rounded-xl col-span-2">
                        <p className="text-slate-400 text-xs mb-1">Fund House</p>
                        <p className="text-white text-lg font-semibold">{fundData.fundHouse}</p>
                      </div>
                    )}
                  </div>

                  {/* External Links */}
                  <div className="mt-6 pt-6 border-t border-slate-700">
                    <h3 className="text-white font-semibold mb-4">🔗 External Research</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <a
                        href={`https://www.valueresearchonline.com/funds/selector/primary-attribute/?search=${encodeURIComponent(fund.fund)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 transition-colors"
                      >
                        <span>📊</span>
                        <span>Value Research</span>
                        <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <a
                        href={`https://www.morningstar.in/funds/security-details.aspx?isin=${fund.tradingsymbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 transition-colors"
                      >
                        <span>⭐</span>
                        <span>Morningstar</span>
                        <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <a
                        href={`https://www.moneycontrol.com/mutual-funds/nav/${fund.tradingsymbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 transition-colors"
                      >
                        <span>💰</span>
                        <span>Moneycontrol</span>
                        <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <a
                        href={`https://groww.in/mutual-funds/${fund.tradingsymbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-400 transition-colors"
                      >
                        <span>📈</span>
                        <span>Groww</span>
                        <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
