import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // No need to clear server-side state as we are stateless

    const response = NextResponse.json({ success: true });

    // Clear cookies
    response.cookies.delete('kite_access_token');
    response.cookies.delete('kite_user');

    return response;
  } catch (error) {
    console.error('Error logging out:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}

