import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

// Paths that don't require authentication
const publicPaths = ['/login', '/api/auth/login', '/favicon.ico'];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Skip static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg)$/)
  ) {
    return NextResponse.next();
  }

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // Get the token from cookies
  const token = request.cookies.get('auth_token')?.value;
  let verifiedToken = null;

  if (token) {
    verifiedToken = await verifyAuth(token);
  }

  // Redirect to login if path is protected and token is invalid or missing
  if (!isPublicPath && !verifiedToken) {
    const loginUrl = new URL('/login', request.url);
    // Optionally save the requested URL to redirect back after login
    // loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if trying to access login page while already authenticated
  if (pathname.startsWith('/login') && verifiedToken) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If token is valid, you can optionally pass user data in headers
  const response = NextResponse.next();
  if (verifiedToken) {
    // Stringify the payload to pass it safely in headers
    response.headers.set('x-user-data', JSON.stringify(verifiedToken));
  }

  return response;
}

export const config = {
  // Apply middleware to all routes except static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
