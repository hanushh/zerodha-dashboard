'use client';

import { Holding } from '@/lib/kite';

interface HoldingsTableProps {
  holdings: Holding[];
}

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

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  if (!holdings || holdings.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 text-center">
        <p className="text-slate-400">No equity holdings found</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-slate-700/50">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">📈</span> Equity Holdings
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-900/50">
              <th className="text-left p-4 text-slate-400 font-medium text-sm">Symbol</th>
              <th className="text-right p-4 text-slate-400 font-medium text-sm">Qty</th>
              <th className="text-right p-4 text-slate-400 font-medium text-sm">Avg Price</th>
              <th className="text-right p-4 text-slate-400 font-medium text-sm">LTP</th>
              <th className="text-right p-4 text-slate-400 font-medium text-sm">Invested</th>
              <th className="text-right p-4 text-slate-400 font-medium text-sm">Current</th>
              <th className="text-right p-4 text-slate-400 font-medium text-sm">P&L</th>
              <th className="text-right p-4 text-slate-400 font-medium text-sm">Returns</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding, index) => {
              const invested = holding.average_price * holding.quantity;
              const current = holding.last_price * holding.quantity;
              const pnl = current - invested;
              const pnlPercent = (pnl / invested) * 100;
              const isProfit = pnl >= 0;

              return (
                <tr 
                  key={`${holding.tradingsymbol}-${index}`}
                  className="border-t border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                >
                  <td className="p-4">
                    <div className="font-medium text-white">{holding.tradingsymbol}</div>
                    <div className="text-xs text-slate-500">{holding.exchange}</div>
                  </td>
                  <td className="p-4 text-right text-slate-300">{holding.quantity}</td>
                  <td className="p-4 text-right text-slate-300">{formatCurrency(holding.average_price)}</td>
                  <td className="p-4 text-right text-slate-300">{formatCurrency(holding.last_price)}</td>
                  <td className="p-4 text-right text-slate-300">{formatCurrency(invested)}</td>
                  <td className="p-4 text-right text-slate-300">{formatCurrency(current)}</td>
                  <td className={`p-4 text-right font-medium ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isProfit ? '+' : ''}{formatCurrency(pnl)}
                  </td>
                  <td className={`p-4 text-right font-medium ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPercent(pnlPercent)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

