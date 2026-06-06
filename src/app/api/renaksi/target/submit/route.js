import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';

export async function POST(request) {
  try {
    await dbConnect();
    const { employeeId } = await request.json();

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId wajib diisi' }, { status: 400 });
    }

    // Update all Draft records for employee in 2026 to Target_Diajukan
    const result = await Renaksi.updateMany(
      { employeeId, tahun: 2026, status: 'Draft' },
      { $set: { status: 'Target_Diajukan' } }
    );

    return NextResponse.json({
      message: 'Rencana target renaksi berhasil diajukan untuk disetujui',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
