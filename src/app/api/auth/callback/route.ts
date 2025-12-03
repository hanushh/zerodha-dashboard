import { NextRequest, NextResponse } from 'next/server';
import { generateSession } from '@/lib/kite';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const requestToken = searchParams.get('request_token');
  const status = searchParams.get('status');

  if (status !== 'success' || !requestToken) {
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }

  try {
    const session = await generateSession(requestToken);
    
    // Create response with redirect
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    
    // Set access token in cookie (httpOnly for security)
    response.cookies.set('kite_access_token', session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    // Set user info in a separate cookie (readable by client)
    response.cookies.set('kite_user', JSON.stringify({
      user_id: session.user_id,
      user_name: session.user_name,
      email: session.email,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error generating session:', error);
    return NextResponse.redirect(new URL('/?error=session_failed', request.url));
  }
}

