import { NextRequest, NextResponse } from 'next/server';
import { fetchFundPortfolio } from '@/lib/fundScraper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ isin: string }> }
) {
  try {
    const { isin } = await params;
    
    if (!isin) {
      return NextResponse.json(
        { error: 'ISIN is required' },
        { status: 400 }
      );
    }

    // Get fund name from query params (optional)
    const fundName = request.nextUrl.searchParams.get('name') || isin;

    // Fetch portfolio using web scraping
    const portfolio = await fetchFundPortfolio(isin, fundName);
    
    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('Error fetching fund portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fund portfolio' },
      { status: 500 }
    );
  }
}
