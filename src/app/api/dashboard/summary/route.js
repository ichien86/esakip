import { NextResponse } from 'next/server';
import DashboardService from '@/services/DashboardService';

export async function GET(request) {
  try {
    const requestYear = request.headers.get('x-requester-year') || '2026';
    const yearNum = parseInt(requestYear);

    const summary = await DashboardService.getSummary(yearNum);

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
