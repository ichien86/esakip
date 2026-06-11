import { NextResponse } from 'next/server';
import PerformanceService from '@/services/PerformanceService';

export async function POST(request) {
  try {
    const body = await request.json();
    const perf = await PerformanceService.evaluatePerformance(body);

    return NextResponse.json({ message: 'Evaluasi berhasil disimpan', data: perf });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
