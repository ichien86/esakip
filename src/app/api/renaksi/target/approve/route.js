import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';
import CascadingAnnual from '@/models/CascadingAnnual';

export async function POST(request) {
  try {
    await dbConnect();
    const { employeeId, indicatorId } = await request.json();

    if (!employeeId || !indicatorId) {
      return NextResponse.json({ error: 'employeeId dan indicatorId wajib diisi' }, { status: 400 });
    }

    const node = await CascadingAnnual.findOne({ id: indicatorId });
    if (node && node.crossCuttingType === 'split') {
      const allRecords = await Renaksi.find({ indicatorId, tahun: 2026 });
      const totalTargetAll = allRecords.reduce((sum, r) => sum + (r.targetBulanan || 0), 0);
      const expectedTarget = parseFloat(node.target) || 0;

      if (Math.abs(totalTargetAll - expectedTarget) > 0.05) {
        return NextResponse.json({
          error: `Persetujuan ditolak. Indikator ini bertipe 'Split' (Dipecah). Total target dari seluruh pengampu (${totalTargetAll}) harus sama dengan target tahunan indikator (${expectedTarget}). Silakan sesuaikan target bulanan bawahan terlebih dahulu.`
        }, { status: 400 });
      }
    }

    // Set the status of all monthly records of this employee for this indicator for 2026 to Target_Disetujui
    const result = await Renaksi.updateMany(
      { employeeId, indicatorId, tahun: 2026, status: 'Target_Diajukan' },
      { $set: { status: 'Target_Disetujui' } }
    );

    return NextResponse.json({
      message: 'Rencana target renaksi berhasil disetujui',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
