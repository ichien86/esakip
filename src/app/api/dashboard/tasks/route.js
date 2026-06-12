import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import DashboardService from '@/services/DashboardService';

export async function GET(request) {
  try {
    await dbConnect();
    const requesterId = request.headers.get('x-requester-id') || '';
    const requesterRole = request.headers.get('x-requester-role') || '';
    const requestYear = request.headers.get('x-requester-year') || '2026';
    const yearNum = parseInt(requestYear);

    if (!requesterId) {
      return NextResponse.json({ tasks: [], activeMonthTargets: [] });
    }

    const data = await DashboardService.getPendingTasksAndActiveTargets(requesterId, requesterRole, yearNum);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
