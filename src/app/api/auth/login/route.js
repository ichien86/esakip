import { NextResponse } from 'next/server';
import AuthService from '@/services/AuthService';
import { signJwt } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const user = await AuthService.login(body);

    const token = await signJwt(user);

    const response = NextResponse.json({
      message: 'Login berhasil',
      user
    });

    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
