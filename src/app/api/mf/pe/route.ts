import { NextRequest, NextResponse } from 'next/server';
import { fetchHoldingsPE, FundHolding } from '@/lib/fund';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { holdings } = body as { holdings: FundHolding[] };
    
    if (!holdings || !Array.isArray(holdings)) {
      return NextResponse.json(
        { error: 'Holdings array is required' },
        { status: 400 }
      );
    }
    
    const enrichedHoldings = await fetchHoldingsPE(holdings);
    
    return NextResponse.json({ holdings: enrichedHoldings });
  } catch (error) {
    console.error('Error fetching P/E ratios:', error);
    return NextResponse.json(
      { error: 'Failed to fetch P/E ratios' },
      { status: 500 }
    );
  }
}

