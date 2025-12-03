import { NextRequest, NextResponse } from 'next/server';
import { fetchStockPE } from '@/lib/fund/peEnricher';
import { getCachedPE, cachePE } from '@/lib/fund/peCache';

interface PEResult {
  name: string;
  pe?: number;
  marketCap?: string;
  symbol?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stocks } = body as { stocks: string[] };
    
    if (!stocks || !Array.isArray(stocks)) {
      return NextResponse.json({ error: 'Stocks array is required' }, { status: 400 });
    }
    
    // Limit batch size to 10
    const batch = stocks.slice(0, 10);
    const results: PEResult[] = [];
    
    // Process in parallel
    const promises = batch.map(async (stockName) => {
      // Check cache first
      const cached = getCachedPE(stockName);
      if (cached) {
        console.log(`📦 PE cache hit: ${stockName}`);
        return {
          name: stockName,
          pe: cached.pe,
          marketCap: cached.marketCap,
          symbol: cached.symbol,
        };
      }
      
      // Fetch from API
      try {
        const peData = await fetchStockPE(stockName);
        
        // Cache the result
        cachePE(stockName, peData);
        console.log(`💾 PE cached: ${stockName}`);
        
        return {
          name: stockName,
          pe: peData.pe,
          marketCap: peData.marketCap,
          symbol: peData.symbol,
        };
      } catch {
        return { name: stockName };
      }
    });
    
    const resolvedResults = await Promise.all(promises);
    results.push(...resolvedResults);
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error fetching P/E batch:', error);
    return NextResponse.json({ error: 'Failed to fetch P/E data' }, { status: 500 });
  }
}

