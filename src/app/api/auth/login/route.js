import { NextResponse } from 'next/server';
import AuthService from '@/services/AuthService';

export async function POST(request) {
  try {
    const body = await request.json();
    const user = await AuthService.login(body);

    return NextResponse.json({
      message: 'Login berhasil',
      user
    });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
