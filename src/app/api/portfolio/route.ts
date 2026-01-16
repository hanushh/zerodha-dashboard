import { NextRequest, NextResponse } from 'next/server';
import {
  getProfile,
  getMargins,
  getHoldings,
  getPositions,
  getMFHoldings,
  createKiteInstance
} from '@/lib/kite';

export async function GET(request: NextRequest) {
  try {
    // Get access token from cookie
    const accessToken = request.cookies.get('kite_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Create a new Kite instance for this request
    const kite = createKiteInstance(accessToken);

    // Fetch all portfolio data in parallel
    const [profile, margins, holdings, positions, mfHoldings] = await Promise.all([
      getProfile(kite).catch(() => null),
      getMargins(kite).catch(() => null),
      getHoldings(kite).catch(() => []),
      getPositions(kite).catch(() => ({ net: [], day: [] })),
      getMFHoldings(kite).catch(() => []),
    ]);

    // Calculate holdings summary
    const holdingsSummary = calculateHoldingsSummary(holdings);
    const mfSummary = calculateMFSummary(mfHoldings);

    return NextResponse.json({
      profile,
      margins,
      holdings,
      holdingsSummary,
      positions,
      mfHoldings,
      mfSummary,
    });
  } catch (error: unknown) {
    console.error('Error fetching portfolio:', error);

    // Check if it's a token error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('Token') || errorMessage.includes('Invalid')) {
      return NextResponse.json(
        { error: 'Session expired. Please login again.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}

interface HoldingItem {
  average_price: number;
  quantity: number;
  last_price: number;
}

function calculateHoldingsSummary(holdings: HoldingItem[]) {
  if (!holdings || holdings.length === 0) {
    return {
      totalInvested: 0,
      totalCurrent: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
      holdingsCount: 0,
    };
  }

  let totalInvested = 0;
  let totalCurrent = 0;

  holdings.forEach((holding) => {
    const invested = holding.average_price * holding.quantity;
    const current = holding.last_price * holding.quantity;
    totalInvested += invested;
    totalCurrent += current;
  });

  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return {
    totalInvested,
    totalCurrent,
    totalPnL,
    totalPnLPercent,
    holdingsCount: holdings.length,
  };
}

function calculateMFSummary(mfHoldings: HoldingItem[]) {
  if (!mfHoldings || mfHoldings.length === 0) {
    return {
      totalInvested: 0,
      totalCurrent: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
      fundsCount: 0,
    };
  }

  let totalInvested = 0;
  let totalCurrent = 0;

  mfHoldings.forEach((holding) => {
    const invested = holding.average_price * holding.quantity;
    const current = holding.last_price * holding.quantity;
    totalInvested += invested;
    totalCurrent += current;
  });

  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return {
    totalInvested,
    totalCurrent,
    totalPnL,
    totalPnLPercent,
    fundsCount: mfHoldings.length,
  };
}

