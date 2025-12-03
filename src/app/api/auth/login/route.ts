import { NextResponse } from 'next/server';
import { getLoginUrl } from '@/lib/kite';

export async function GET() {
  try {
    const loginUrl = getLoginUrl();
    return NextResponse.json({ loginUrl });
  } catch (error) {
    console.error('Error getting login URL:', error);
    return NextResponse.json(
      { error: 'Failed to get login URL' },
      { status: 500 }
    );
  }
}

