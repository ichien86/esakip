import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

// API paths that are always public (no token needed)
const publicApiPaths = ['/api/auth/login', '/api/auth/logout', '/api/debug-auth'];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // 1. Skip all Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // 2. Only enforce auth on API routes — page routes are protected client-side
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 3. Allow public API paths through without a token
  const isPublicApi = publicApiPaths.some(p => pathname.startsWith(p));
  if (isPublicApi) {
    return NextResponse.next();
  }

  // 4. For all other API routes, verify the token
  const token = request.cookies.get('auth_token')?.value;
  let verifiedToken = null;

  if (token) {
    verifiedToken = await verifyAuth(token);
  }

  if (!verifiedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 5. Attach user data to request headers for downstream API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-data', JSON.stringify(verifiedToken));

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  // Only run middleware on API routes and pages (not _next internals)
  matcher: ['/((?!_next|static|favicon.ico).*)'],
};
