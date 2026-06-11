import { NextResponse } from 'next/server';
import RenaksiService from '@/services/RenaksiService';

export async function POST(request) {
  try {
    const { employeeId } = await request.json();
    const requestYear = request.headers.get('x-requester-year') || '2026';

    const modifiedCount = await RenaksiService.submitTargets(employeeId, requestYear);

    return NextResponse.json({
      message: 'Rencana target renaksi berhasil diajukan untuk disetujui',
      modifiedCount
    });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
