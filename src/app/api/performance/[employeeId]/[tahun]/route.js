import { NextResponse } from 'next/server';
import PerformanceService from '@/services/PerformanceService';

export async function GET(request, { params }) {
  try {
    const { employeeId, tahun } = await params;
    const yearNum = parseInt(tahun);

    const perf = await PerformanceService.getPerformance(employeeId, yearNum);

    return NextResponse.json(perf);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
