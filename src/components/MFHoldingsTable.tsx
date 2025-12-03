'use client';

import { useState, useMemo } from 'react';
import { MFHolding } from '@/lib/kite';
import { FundDetailModal } from './FundDetailModal';

interface MFHoldingsTableProps {
  holdings: MFHolding[];
}

type SortField = 'name' | 'invested' | 'current' | 'pnl' | 'returns';
type SortOrder = 'asc' | 'desc';
type FilterType = 'all' | 'profit' | 'loss';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

// Extract fund category from name
function getFundCategory(name: string): string {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('liquid') || lowerName.includes('money market') || lowerName.includes('overnight')) {
    return 'Liquid';
  }
  if (lowerName.includes('debt') || lowerName.includes('bond') || lowerName.includes('gilt') || 
      lowerName.includes('credit') || lowerName.includes('duration')) {
    return 'Debt';
  }
  if (lowerName.includes('gold') || lowerName.includes('silver') || lowerName.includes('commodity')) {
    return 'Commodity';
  }
  if (lowerName.includes('hybrid') || lowerName.includes('balanced') || lowerName.includes('advantage') ||
      lowerName.includes('arbitrage')) {
    return 'Hybrid';
  }
  if (lowerName.includes('index') || lowerName.includes('nifty') || lowerName.includes('sensex')) {
    return 'Index';
  }
  if (lowerName.includes('small') || lowerName.includes('micro')) {
    return 'Small Cap';
  }
  if (lowerName.includes('mid')) {
    return 'Mid Cap';
  }
  if (lowerName.includes('large') || lowerName.includes('bluechip')) {
    return 'Large Cap';
  }
  if (lowerName.includes('flexi') || lowerName.includes('multi')) {
    return 'Flexi/Multi';
  }
  return 'Equity';
}

export function MFHoldingsTable({ holdings }: MFHoldingsTableProps) {
  const [selectedFund, setSelectedFund] = useState<MFHolding | null>(null);
  const [sortField, setSortField] = useState<SortField>('current');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(holdings.map(h => getFundCategory(h.fund)));
    return ['all', ...Array.from(cats).sort()];
  }, [holdings]);

  // Filter and sort holdings
  const filteredAndSortedHoldings = useMemo(() => {
    let result = [...holdings];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(h => 
        h.fund.toLowerCase().includes(query) ||
        h.folio.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      result = result.filter(h => getFundCategory(h.fund) === categoryFilter);
    }

    // Apply profit/loss filter
    if (filterType !== 'all') {
      result = result.filter(h => {
        const invested = h.average_price * h.quantity;
        const current = h.last_price * h.quantity;
        const pnl = current - invested;
        return filterType === 'profit' ? pnl >= 0 : pnl < 0;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      const aInvested = a.average_price * a.quantity;
      const aCurrent = a.last_price * a.quantity;
      const aPnl = aCurrent - aInvested;
      const aReturns = aInvested > 0 ? (aPnl / aInvested) * 100 : 0;

      const bInvested = b.average_price * b.quantity;
      const bCurrent = b.last_price * b.quantity;
      const bPnl = bCurrent - bInvested;
      const bReturns = bInvested > 0 ? (bPnl / bInvested) * 100 : 0;

      switch (sortField) {
        case 'name':
          aValue = a.fund.toLowerCase();
          bValue = b.fund.toLowerCase();
          break;
        case 'invested':
          aValue = aInvested;
          bValue = bInvested;
          break;
        case 'current':
          aValue = aCurrent;
          bValue = bCurrent;
          break;
        case 'pnl':
          aValue = aPnl;
          bValue = bPnl;
          break;
        case 'returns':
          aValue = aReturns;
          bValue = bReturns;
          break;
        default:
          aValue = aCurrent;
          bValue = bCurrent;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }

      return sortOrder === 'asc' 
        ? (aValue as number) - (bValue as number) 
        : (bValue as number) - (aValue as number);
    });

    return result;
  }, [holdings, sortField, sortOrder, filterType, searchQuery, categoryFilter]);

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Sort icon
  const SortIcon = ({ field }: { field: SortField }) => (
    <span className={`ml-1 ${sortField === field ? 'text-emerald-400' : 'text-slate-600'}`}>
      {sortField === field ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  if (!holdings || holdings.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 text-center">
        <p className="text-slate-400">No mutual fund holdings found</p>
      </div>
    );
  }

  // Calculate summary stats for filtered holdings
  const summary = useMemo(() => {
    let totalInvested = 0;
    let totalCurrent = 0;
    let profitCount = 0;
    let lossCount = 0;

    filteredAndSortedHoldings.forEach(h => {
      const invested = h.average_price * h.quantity;
      const current = h.last_price * h.quantity;
      totalInvested += invested;
      totalCurrent += current;
      if (current >= invested) profitCount++;
      else lossCount++;
    });

    return {
      totalInvested,
      totalCurrent,
      totalPnl: totalCurrent - totalInvested,
      profitCount,
      lossCount,
    };
  }, [filteredAndSortedHoldings]);

  return (
    <>
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <span className="text-2xl">📊</span> Mutual Fund Holdings
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Showing {filteredAndSortedHoldings.length} of {holdings.length} funds
              </p>
            </div>
            
            {/* Quick Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-emerald-400">●</span>
                <span className="text-slate-400">{summary.profitCount} in profit</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-red-400">●</span>
                <span className="text-slate-400">{summary.lossCount} in loss</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 bg-slate-900/30 border-b border-slate-700/50">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search funds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            {/* Profit/Loss Filter */}
            <div className="flex rounded-lg overflow-hidden border border-slate-700">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filterType === 'all' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('profit')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filterType === 'profit' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Profit
              </button>
              <button
                onClick={() => setFilterType('loss')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filterType === 'loss' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Loss
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50">
                <th 
                  className="text-left p-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('name')}
                >
                  Fund Name <SortIcon field="name" />
                </th>
                <th className="text-right p-4 text-slate-400 font-medium text-sm">Units</th>
                <th className="text-right p-4 text-slate-400 font-medium text-sm">Avg NAV</th>
                <th className="text-right p-4 text-slate-400 font-medium text-sm">Current NAV</th>
                <th 
                  className="text-right p-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('invested')}
                >
                  Invested <SortIcon field="invested" />
                </th>
                <th 
                  className="text-right p-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('current')}
                >
                  Current <SortIcon field="current" />
                </th>
                <th 
                  className="text-right p-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('pnl')}
                >
                  P&L <SortIcon field="pnl" />
                </th>
                <th 
                  className="text-right p-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('returns')}
                >
                  Returns <SortIcon field="returns" />
                </th>
                <th className="text-center p-4 text-slate-400 font-medium text-sm">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedHoldings.map((holding, index) => {
                const invested = holding.average_price * holding.quantity;
                const current = holding.last_price * holding.quantity;
                const pnl = current - invested;
                const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
                const isProfit = pnl >= 0;
                const category = getFundCategory(holding.fund);

                // Truncate fund name
                const displayName = holding.fund.length > 40 
                  ? holding.fund.substring(0, 37) + '...' 
                  : holding.fund;

                return (
                  <tr 
                    key={`${holding.folio}-${holding.tradingsymbol}-${index}`}
                    className="border-t border-slate-700/30 hover:bg-slate-700/20 transition-colors cursor-pointer"
                    onClick={() => setSelectedFund(holding)}
                  >
                    <td className="p-4">
                      <div className="font-medium text-white" title={holding.fund}>
                        {displayName}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">Folio: {holding.folio}</span>
                        <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
                          {category}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right text-slate-300">{holding.quantity.toFixed(3)}</td>
                    <td className="p-4 text-right text-slate-300">₹{holding.average_price.toFixed(2)}</td>
                    <td className="p-4 text-right text-slate-300">₹{holding.last_price.toFixed(4)}</td>
                    <td className="p-4 text-right text-slate-300">{formatCurrency(invested)}</td>
                    <td className="p-4 text-right text-slate-300">{formatCurrency(current)}</td>
                    <td className={`p-4 text-right font-medium ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isProfit ? '+' : ''}{formatCurrency(pnl)}
                    </td>
                    <td className={`p-4 text-right font-medium ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPercent(pnlPercent)}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFund(holding);
                        }}
                        className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="View fund details"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        {filteredAndSortedHoldings.length > 0 && (
          <div className="p-4 bg-slate-900/30 border-t border-slate-700/50">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-slate-400">Total Invested: </span>
                  <span className="text-white font-semibold">{formatCurrency(summary.totalInvested)}</span>
                </div>
                <div>
                  <span className="text-slate-400">Current Value: </span>
                  <span className="text-white font-semibold">{formatCurrency(summary.totalCurrent)}</span>
                </div>
                <div>
                  <span className="text-slate-400">Total P&L: </span>
                  <span className={`font-semibold ${summary.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {summary.totalPnl >= 0 ? '+' : ''}{formatCurrency(summary.totalPnl)}
                  </span>
                </div>
              </div>
              {(searchQuery || categoryFilter !== 'all' || filterType !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                    setFilterType('all');
                  }}
                  className="text-slate-400 hover:text-white text-xs underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* No results message */}
        {filteredAndSortedHoldings.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-slate-400">No funds match your filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setFilterType('all');
              }}
              className="mt-2 text-emerald-400 hover:text-emerald-300 text-sm"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Fund Detail Modal */}
      {selectedFund && (
        <FundDetailModal
          fund={selectedFund}
          onClose={() => setSelectedFund(null)}
        />
      )}
    </>
  );
}
