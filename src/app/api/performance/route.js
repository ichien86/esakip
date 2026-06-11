import { NextResponse } from 'next/server';
import PerformanceService from '@/services/PerformanceService';

export async function POST(request) {
  try {
    const body = await request.json();
    const perf = await PerformanceService.updatePerformance(body);

    return NextResponse.json({ message: 'Kinerja berhasil disimpan', data: perf });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
