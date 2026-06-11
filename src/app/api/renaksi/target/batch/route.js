import { NextResponse } from 'next/server';
import RenaksiService from '@/services/RenaksiService';

export async function POST(request) {
  try {
    const { employeeId, targets } = await request.json();
    const requestYear = request.headers.get('x-requester-year') || '2026';

    await RenaksiService.saveBatchTargets(employeeId, targets, requestYear);

    return NextResponse.json({ message: 'Target bulanan spreadsheet berhasil disimpan' });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
