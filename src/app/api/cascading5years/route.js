import { NextResponse } from 'next/server';
import { checkPlanningLock } from '@/lib/lock-check';
import Cascading5YearsService from '@/services/Cascading5YearsService';

export async function GET() {
  try {
    const data = await Cascading5YearsService.getCascading5YearsData();
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
    const item = await Cascading5YearsService.saveCascading5YearsData(body);

    return NextResponse.json({ message: 'Cascading 5 Tahunan berhasil disimpan', data: item });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

