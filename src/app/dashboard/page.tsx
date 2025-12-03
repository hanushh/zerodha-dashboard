'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PortfolioCard } from '@/components/PortfolioCard';
import { HoldingsTable } from '@/components/HoldingsTable';
import { MFHoldingsTable } from '@/components/MFHoldingsTable';
import { TopHoldingsCard } from '@/components/TopHoldingsCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Holding, MFHolding, UserProfile, Margins } from '@/lib/kite';

interface PortfolioSummary {
  totalInvested: number;
  totalCurrent: number;
  totalPnL: number;
  totalPnLPercent: number;
  holdingsCount?: number;
  fundsCount?: number;
}

interface PortfolioData {
  profile: UserProfile | null;
  margins: Margins | null;
  holdings: Holding[];
  holdingsSummary: PortfolioSummary;
  positions: { net: unknown[]; day: unknown[] };
  mfHoldings: MFHolding[];
  mfSummary: PortfolioSummary;
}

interface CachedPortfolio {
  data: PortfolioData;
  timestamp: number;
}

const PORTFOLIO_CACHE_KEY = 'kite_portfolio_data';

// Get cached portfolio from localStorage
function getCachedPortfolio(): PortfolioData | null {
  try {
    const cached = localStorage.getItem(PORTFOLIO_CACHE_KEY);
    if (!cached) return null;
    const parsed: CachedPortfolio = JSON.parse(cached);
    return parsed.data;
  } catch {
    return null;
  }
}

// Save portfolio to localStorage
function cachePortfolio(data: PortfolioData): void {
  try {
    const entry: CachedPortfolio = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(PORTFOLIO_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable
  }
}

// Get cache timestamp
function getCacheTimestamp(): number | null {
  try {
    const cached = localStorage.getItem(PORTFOLIO_CACHE_KEY);
    if (!cached) return null;
    const parsed: CachedPortfolio = JSON.parse(cached);
    return parsed.timestamp;
  } catch {
    return null;
  }
}

// Format time ago
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Get user info from cookie
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    if (cookies.kite_user) {
      try {
        const user = JSON.parse(decodeURIComponent(cookies.kite_user));
        setUserName(user.user_name || user.user_id);
      } catch {
        // Ignore parse error
      }
    }

    // Check cache first
    const cached = getCachedPortfolio();
    const cacheTime = getCacheTimestamp();
    
    if (cached) {
      setPortfolio(cached);
      setLastUpdated(cacheTime);
      setIsLoading(false);
    } else {
      fetchPortfolio();
    }
  }, []);

  const fetchPortfolio = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      
      const response = await fetch('/api/portfolio');
      
      if (response.status === 401) {
        router.push('/');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch portfolio');
      }
      
      const data = await response.json();
      setPortfolio(data);
      
      // Cache the portfolio data
      cachePortfolio(data);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  const handleRefresh = () => {
    fetchPortfolio(true);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      document.cookie = 'kite_access_token=; Max-Age=0; path=/';
      document.cookie = 'kite_user=; Max-Age=0; path=/';
      
      // Clear cached portfolio data
      localStorage.removeItem(PORTFOLIO_CACHE_KEY);
      localStorage.removeItem('portfolio_top_holdings');
      
      router.push('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Calculate totals
  const totalInvested = (portfolio?.holdingsSummary?.totalInvested || 0) + (portfolio?.mfSummary?.totalInvested || 0);
  const totalCurrent = (portfolio?.holdingsSummary?.totalCurrent || 0) + (portfolio?.mfSummary?.totalCurrent || 0);
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
              <span className="text-xl font-bold text-white">Kite Portfolio</span>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-slate-400">Welcome, <span className="text-white font-medium">{userName}</span></span>
              
              {/* Last Updated */}
              {lastUpdated && (
                <span className="text-slate-500 text-sm hidden sm:inline">
                  Updated {formatTimeAgo(lastUpdated)}
                </span>
              )}
              
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-sm"
                title="Refresh portfolio data"
              >
                <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
            <p className="text-red-400 text-lg mb-4">{error}</p>
            <button
              onClick={() => fetchPortfolio()}
              className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Portfolio Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <PortfolioCard
                title="Total Invested"
                value={formatCurrency(totalInvested)}
                icon={<span className="text-2xl">💼</span>}
              />
              <PortfolioCard
                title="Current Value"
                value={formatCurrency(totalCurrent)}
                icon={<span className="text-2xl">📈</span>}
              />
              <PortfolioCard
                title="Total P&L"
                value={(totalPnL >= 0 ? '+' : '') + formatCurrency(totalPnL)}
                subtitle={`${totalPnL >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%`}
                trend={totalPnL >= 0 ? 'up' : 'down'}
                icon={<span className="text-2xl">{totalPnL >= 0 ? '🚀' : '📉'}</span>}
              />
              <PortfolioCard
                title="Available Margin"
                value={formatCurrency(portfolio?.margins?.equity?.available?.live_balance || 0)}
                icon={<span className="text-2xl">💰</span>}
              />
            </div>

            {/* Sub-summaries */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span>📈</span> Equity Summary
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-sm">Holdings</p>
                    <p className="text-white text-xl font-semibold">{portfolio?.holdings?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Invested</p>
                    <p className="text-white text-xl font-semibold">{formatCurrency(portfolio?.holdingsSummary?.totalInvested || 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Current</p>
                    <p className="text-white text-xl font-semibold">{formatCurrency(portfolio?.holdingsSummary?.totalCurrent || 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">P&L</p>
                    <p className={`text-xl font-semibold ${(portfolio?.holdingsSummary?.totalPnL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {((portfolio?.holdingsSummary?.totalPnL || 0) >= 0 ? '+' : '') + formatCurrency(portfolio?.holdingsSummary?.totalPnL || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span>📊</span> Mutual Fund Summary
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-sm">Funds</p>
                    <p className="text-white text-xl font-semibold">{portfolio?.mfHoldings?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Invested</p>
                    <p className="text-white text-xl font-semibold">{formatCurrency(portfolio?.mfSummary?.totalInvested || 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Current</p>
                    <p className="text-white text-xl font-semibold">{formatCurrency(portfolio?.mfSummary?.totalCurrent || 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">P&L</p>
                    <p className={`text-xl font-semibold ${(portfolio?.mfSummary?.totalPnL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {((portfolio?.mfSummary?.totalPnL || 0) >= 0 ? '+' : '') + formatCurrency(portfolio?.mfSummary?.totalPnL || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Holdings Tables */}
            <HoldingsTable holdings={portfolio?.holdings || []} />
            <MFHoldingsTable holdings={portfolio?.mfHoldings || []} />
            
            {/* Top Holdings Analysis */}
            {portfolio?.mfHoldings && portfolio.mfHoldings.length > 0 && (
              <TopHoldingsCard mfHoldings={portfolio.mfHoldings} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

