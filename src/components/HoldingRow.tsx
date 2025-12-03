'use client';

import { useEffect, useRef } from 'react';
import { FundHolding } from '@/lib/fundScraper';

interface HoldingRowProps {
  holding: FundHolding;
  index: number;
  onVisible: (index: number) => void;
  isLoading: boolean;
  isPEEnabled: boolean;
}

export function HoldingRow({ holding, index, onVisible, isLoading, isPEEnabled }: HoldingRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Skip if P/E not enabled, already has P/E data, or currently loading
    if (!isPEEnabled || holding.pe || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          // Notify parent that this row is visible and needs P/E
          onVisible(index);
        }
      },
      { threshold: 0, rootMargin: '100px' }
    );

    if (rowRef.current) {
      observer.observe(rowRef.current);
    }

    return () => observer.disconnect();
  }, [holding.pe, isLoading, isPEEnabled, index, onVisible]);

  return (
    <div
      ref={rowRef}
      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white font-medium truncate">{holding.name}</p>
          {holding.symbol && (
            <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-400 font-mono">
              {holding.symbol}
            </span>
          )}
        </div>
        {holding.sector && (
          <p className="text-slate-400 text-xs">{holding.sector}</p>
        )}
      </div>
      
      {/* P/E Ratio */}
      <div className="w-20 text-center">
        {isLoading ? (
          <div className="w-4 h-4 mx-auto border-2 border-slate-600 border-t-emerald-500 rounded-full animate-spin"></div>
        ) : holding.pe ? (
          <span className={`font-semibold ${
            holding.pe < 20 ? 'text-emerald-400' : 
            holding.pe < 35 ? 'text-amber-400' : 
            'text-red-400'
          }`}>
            {holding.pe.toFixed(1)}x
          </span>
        ) : isPEEnabled ? (
          <span className="text-slate-600 text-xs">pending</span>
        ) : (
          <span className="text-slate-500">-</span>
        )}
      </div>
      
      {/* Market Cap */}
      <div className="w-24 text-center">
        {holding.marketCap ? (
          <span className="text-slate-300 text-xs">{holding.marketCap}</span>
        ) : (
          <span className="text-slate-500">-</span>
        )}
      </div>
      
      {/* Weight */}
      <div className="w-16 text-right">
        <span className="text-emerald-400 font-semibold">
          {holding.percentage.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
