import { NextRequest, NextResponse } from 'next/server';
import { fetchFundPortfolio } from '@/lib/fund';
import { cookies } from 'next/headers';

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

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('kite_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { mfHoldings } = body as { 
      mfHoldings: { 
        tradingsymbol: string; 
        fund: string; 
        last_price: number; 
        quantity: number;
      }[] 
    };

    if (!mfHoldings || !Array.isArray(mfHoldings)) {
      return NextResponse.json({ error: 'MF holdings array required' }, { status: 400 });
    }

    // First, aggregate MF holdings by fund name (combine multiple folios)
    const consolidatedFunds = new Map<string, { 
      tradingsymbol: string; 
      fund: string; 
      totalValue: number;
    }>();
    let totalPortfolioValue = 0;

    for (const mf of mfHoldings) {
      const value = mf.last_price * mf.quantity;
      totalPortfolioValue += value;
      
      const key = mf.fund; // Use fund name as key
      if (consolidatedFunds.has(key)) {
        consolidatedFunds.get(key)!.totalValue += value;
      } else {
        consolidatedFunds.set(key, {
          tradingsymbol: mf.tradingsymbol,
          fund: mf.fund,
          totalValue: value,
        });
      }
    }

    // Now process each unique fund
    const holdingsMap = new Map<string, AggregatedHolding>();
    const uniqueFunds = Array.from(consolidatedFunds.values());

    for (const mf of uniqueFunds) {
      const fundValue = mf.totalValue;
      const fundWeight = totalPortfolioValue > 0 ? (fundValue / totalPortfolioValue) * 100 : 0;

      try {
        const portfolio = await fetchFundPortfolio(mf.tradingsymbol, mf.fund);
        
        if (portfolio.holdings && portfolio.holdings.length > 0) {
          for (const holding of portfolio.holdings) {
            // Calculate actual value and percentage in total portfolio
            const holdingValueInFund = (holding.percentage / 100) * fundValue;
            const holdingPercentageInPortfolio = (holding.percentage / 100) * fundWeight;

            const key = holding.name.toLowerCase().trim();
            
            if (holdingsMap.has(key)) {
              const existing = holdingsMap.get(key)!;
              existing.totalValue += holdingValueInFund;
              existing.totalPercentage += holdingPercentageInPortfolio;
              
              // Check if this fund is already in the funds array (avoid duplicates)
              const existingFundEntry = existing.funds.find(f => f.name === mf.fund);
              if (existingFundEntry) {
                // Fund already exists, add to its values
                existingFundEntry.percentage += holding.percentage;
                existingFundEntry.value += holdingValueInFund;
              } else {
                // New fund, add to array
                existing.funds.push({
                  name: mf.fund,
                  percentage: holding.percentage,
                  value: holdingValueInFund,
                });
              }
              
              // Update P/E if not set
              if (!existing.pe && holding.pe) existing.pe = holding.pe;
              if (!existing.marketCap && holding.marketCap) existing.marketCap = holding.marketCap;
              if (!existing.sector && holding.sector) existing.sector = holding.sector;
              if (!existing.symbol && holding.symbol) existing.symbol = holding.symbol;
            } else {
              holdingsMap.set(key, {
                name: holding.name,
                symbol: holding.symbol,
                totalValue: holdingValueInFund,
                totalPercentage: holdingPercentageInPortfolio,
                funds: [{
                  name: mf.fund,
                  percentage: holding.percentage,
                  value: holdingValueInFund,
                }],
                pe: holding.pe,
                marketCap: holding.marketCap,
                sector: holding.sector,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching portfolio for ${mf.fund}:`, error);
      }
    }

    // Sort by total percentage (return all holdings)
    const allHoldings = Array.from(holdingsMap.values())
      .sort((a, b) => b.totalPercentage - a.totalPercentage);

    return NextResponse.json({
      holdings: allHoldings,
      totalHoldings: allHoldings.length,
      totalPortfolioValue,
      totalFunds: uniqueFunds.length,
    });
  } catch (error) {
    console.error('Error calculating top holdings:', error);
    return NextResponse.json({ error: 'Failed to calculate top holdings' }, { status: 500 });
  }
}

