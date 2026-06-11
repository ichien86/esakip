import { NextResponse } from 'next/server';
import { checkPlanningLock } from '@/lib/lock-check';
import CascadingAnnualService from '@/services/CascadingAnnualService';

export async function GET() {
  try {
    const data = await CascadingAnnualService.getCascadingAnnualData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const lockResponse = await checkPlanningLock(request);
    if (lockResponse) return lockResponse;

    const body = await request.json();
    const item = await CascadingAnnualService.saveCascadingAnnualData(body);

    return NextResponse.json({ message: 'Cascading berhasil disimpan', data: item });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

