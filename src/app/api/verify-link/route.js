import { NextResponse } from 'next/server';
import LinkVerificationService from '@/services/LinkVerificationService';

export async function POST(request) {
  try {
    const { url } = await request.json();
    const result = await LinkVerificationService.verify(url);
    
    return NextResponse.json(result);
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
