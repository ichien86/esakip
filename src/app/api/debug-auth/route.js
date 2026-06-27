import { NextResponse } from 'next/server';

// Debug endpoint: cek apakah cookie ada dari sudut pandang server
export async function GET(request) {
  const token = request.cookies.get('auth_token')?.value;
  const jwtSecret = process.env.JWT_SECRET;
  
  return NextResponse.json({
    hasCookie: !!token,
    tokenPreview: token ? token.substring(0, 30) + '...' : null,
    hasJwtSecret: !!jwtSecret,
    jwtSecretLength: jwtSecret?.length || 0,
    nodeEnv: process.env.NODE_ENV,
    allCookieNames: request.cookies.getAll().map(c => c.name),
  });
}
