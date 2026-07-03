import { NextResponse } from 'next/server';
import RenaksiService from '@/services/RenaksiService';

export async function POST(request) {
  try {
    const { employeeId } = await request.json();
    const requestYear = request.headers.get('x-requester-year') || '2026';

    const modifiedCount = await RenaksiService.revisiTargets(employeeId, requestYear);

    return NextResponse.json({
      message: 'Target berhasil dikembalikan ke status Draft untuk direvisi',
      modifiedCount
    });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
