'use client';

import { useState, useEffect, useMemo } from 'react';
import { MFHolding } from '@/lib/kite';

interface AggregatedHolding {
  name: string;
  symbol?: string;
  totalValue: number;
  totalPercentage: number;
  funds: { name: string; percentage: number; value: number }[];
  pe?: number;
  marketCap?: string;
  sector?: string;
}

interface HoldingsData {
  holdings: AggregatedHolding[];
  totalHoldings: number;
  totalPortfolioValue: number;
  totalFunds: number;
  timestamp: number;
}

interface TopHoldingsCardProps {
  mfHoldings: MFHolding[];
}

const CACHE_KEY = 'portfolio_top_holdings';
const LIST_HEIGHT = 500;

// Get cached data from localStorage
function getCachedHoldings(): HoldingsData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    
    // Handle old cache format (topHoldings) vs new format (holdings)
    if (parsed.topHoldings && !parsed.holdings) {
      parsed.holdings = parsed.topHoldings;
      parsed.totalHoldings = parsed.topHoldings.length;
    }
    
    // Ensure holdings array exists
    if (!parsed.holdings || !Array.isArray(parsed.holdings)) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return parsed;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

// Save data to localStorage
function cacheHoldings(data: HoldingsData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable
  }
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// Holding Row Component
interface HoldingRowProps {
  holding: AggregatedHolding;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function HoldingRowItem({ holding, rank, isExpanded, onToggle }: HoldingRowProps) {
  return (
    <div className="bg-slate-900/50 rounded-lg overflow-hidden">
      <div
        className="flex items-center p-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={onToggle}
      >
        {/* Rank */}
        <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold text-white mr-3 flex-shrink-0 ${
          rank <= 3 ? 'bg-emerald-600' : 
          rank <= 10 ? 'bg-slate-600' : 
          'bg-slate-700'
        }`}>
          {rank}
        </div>
        
        {/* Name & Sector */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-medium truncate">{holding.name}</p>
            {holding.symbol && (
              <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-400 font-mono flex-shrink-0">
                {holding.symbol}
              </span>
            )}
          </div>
          {holding.sector && (
            <p className="text-slate-500 text-xs truncate">{holding.sector}</p>
          )}
        </div>
        
        {/* P/E */}
        <div className="w-16 text-center hidden sm:block flex-shrink-0">
          {holding.pe ? (
            <span className={`text-sm font-semibold ${
              holding.pe < 20 ? 'text-emerald-400' : 
              holding.pe < 35 ? 'text-amber-400' : 
              'text-red-400'
            }`}>
              {holding.pe.toFixed(1)}x
            </span>
          ) : (
            <span className="text-slate-500 text-sm">-</span>
          )}
        </div>
        
        {/* Value */}
        <div className="w-24 text-right flex-shrink-0">
          <p className="text-white font-semibold text-sm">{formatCurrency(holding.totalValue)}</p>
          <p className="text-emerald-400 text-xs">{holding.totalPercentage.toFixed(2)}%</p>
        </div>
        
        {/* Expand icon */}
        <div className="ml-2 text-slate-400 flex-shrink-0">
          <svg 
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {/* Expanded view - funds breakdown */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/50">
          <p className="text-slate-400 text-xs mb-2">Present in {holding.funds.length} fund(s):</p>
          <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
            {holding.funds
              .sort((a, b) => b.value - a.value)
              .map((fund, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-2 px-3 bg-slate-800/50 rounded">
                <span className="text-slate-300 truncate flex-1">{fund.name}</span>
                <span className="text-slate-400 ml-2 w-16 text-right">{fund.percentage.toFixed(2)}%</span>
                <span className="text-emerald-400 ml-2 w-20 text-right">{formatCurrency(fund.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TopHoldingsCard({ mfHoldings }: TopHoldingsCardProps) {
  const [allHoldings, setAllHoldings] = useState<AggregatedHolding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [expandedHolding, setExpandedHolding] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load cached data on mount
  useEffect(() => {
    const cached = getCachedHoldings();
    if (cached) {
      setAllHoldings(cached.holdings);
      setTotalValue(cached.totalPortfolioValue);
      setLastUpdated(cached.timestamp);
      setIsLoaded(true);
    }
  }, []);

  // Filter holdings based on search
  const filteredHoldings = useMemo(() => {
    if (!allHoldings || allHoldings.length === 0) return [];
    if (!searchQuery.trim()) return allHoldings;
    const query = searchQuery.toLowerCase();
    return allHoldings.filter(h => 
      h.name.toLowerCase().includes(query) ||
      h.symbol?.toLowerCase().includes(query) ||
      h.sector?.toLowerCase().includes(query)
    );
  }, [allHoldings, searchQuery]);

  async function loadHoldings() {
    if (isLoading || mfHoldings.length === 0) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/portfolio/top-holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfHoldings }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const timestamp = Date.now();
        
        setAllHoldings(data.holdings);
        setTotalValue(data.totalPortfolioValue);
        setLastUpdated(timestamp);
        setIsLoaded(true);
        setExpandedHolding(null);
        
        // Cache the data
        cacheHoldings({
          holdings: data.holdings,
          totalHoldings: data.totalHoldings,
          totalPortfolioValue: data.totalPortfolioValue,
          totalFunds: data.totalFunds,
          timestamp,
        });
      }
    } catch (error) {
      console.error('Error loading holdings:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const toggleExpand = (name: string) => {
    setExpandedHolding(prev => prev === name ? null : name);
  };

  if (!isLoaded) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Portfolio Holdings Analysis</h3>
            <p className="text-slate-400 text-sm">Aggregate stock exposure across all mutual funds</p>
          </div>
          <button
            onClick={loadHoldings}
            disabled={isLoading}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Analyzing...
              </>
            ) : (
              <>📊 Analyze Holdings</>
            )}
          </button>
        </div>
        <p className="text-slate-500 text-sm">
          Click to analyze your portfolio and find stock exposure across all your mutual funds.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Portfolio Holdings Analysis</h3>
          <p className="text-slate-400 text-sm">
            {allHoldings.length} unique holdings • Total: {formatCurrency(totalValue)}
            {lastUpdated && (
              <span className="text-slate-500 ml-2">• Updated {formatTimeAgo(lastUpdated)}</span>
            )}
          </p>
        </div>
        <button
          onClick={loadHoldings}
          disabled={isLoading}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
        >
          {isLoading ? (
            <>
              <div className="w-3 h-3 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin"></div>
              Refreshing...
            </>
          ) : (
            <>↻ Refresh</>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, symbol, or sector..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
        />
      </div>

      {/* Scrollable Holdings List */}
      <div 
        className="overflow-y-auto scrollbar-thin" 
        style={{ maxHeight: `${LIST_HEIGHT}px` }}
      >
        {filteredHoldings.length > 0 ? (
          <div className="space-y-2 pr-1">
            {filteredHoldings.map((holding) => {
              const rank = allHoldings.indexOf(holding) + 1;
              return (
                <HoldingRowItem
                  key={holding.name}
                  holding={holding}
                  rank={rank}
                  isExpanded={expandedHolding === holding.name}
                  onToggle={() => toggleExpand(holding.name)}
                />
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500">
            No holdings found matching &quot;{searchQuery}&quot;
          </div>
        )}
      </div>

      {/* Search Results Info */}
      {searchQuery && filteredHoldings.length > 0 && (
        <p className="mt-3 text-center text-slate-500 text-sm">
          Showing {filteredHoldings.length} holdings matching &quot;{searchQuery}&quot;
        </p>
      )}
      
      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-700 flex flex-wrap items-center gap-4 text-xs">
        <span className="text-slate-400">P/E Guide:</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-slate-400">&lt;20 Value</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span className="text-slate-400">20-35 Fair</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400"></span>
          <span className="text-slate-400">&gt;35 Expensive</span>
        </span>
      </div>
    </div>
  );
}
