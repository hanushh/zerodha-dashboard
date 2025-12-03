import { NextResponse } from 'next/server';
import { logout } from '@/lib/kite';

export async function POST() {
  try {
    logout();
    
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

