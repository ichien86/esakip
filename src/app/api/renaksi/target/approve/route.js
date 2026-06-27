import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';
import CascadingAnnual from '@/models/CascadingAnnual';
import { getValidatedUser } from '@/lib/api-auth';

export async function POST(request) {
  try {
    await dbConnect();
    const { employeeId, indicatorId } = await request.json();

    if (!employeeId || !indicatorId) {
      return NextResponse.json({ error: 'employeeId dan indicatorId wajib diisi' }, { status: 400 });
    }

    const requestYear = request.headers.get('x-requester-year') || '2026';
    const yearNum = parseInt(requestYear);

    const node = await CascadingAnnual.findOne({ id: indicatorId, tahun: yearNum });
    if (node && node.crossCuttingType === 'split') {
      const allRecords = await Renaksi.find({ indicatorId, tahun: yearNum });
      const totalTargetAll = allRecords.reduce((sum, r) => sum + (r.targetBulanan || 0), 0);
      const expectedTarget = parseFloat(node.target) || 0;

      if (Math.abs(totalTargetAll - expectedTarget) > 0.05) {
        return NextResponse.json({
          error: `Persetujuan ditolak. Indikator ini bertipe 'Split' (Dipecah). Total target dari seluruh pengampu (${totalTargetAll}) harus sama dengan target tahunan indikator (${expectedTarget}). Silakan sesuaikan target bulanan bawahan terlebih dahulu.`
        }, { status: 400 });
      }
    }

    const { role: requesterRole } = getValidatedUser(request, request.headers.get('x-requester-role'));
    let targetStatusFilter = 'Target_Diajukan';
    let nextStatus = 'Target_Disetujui';

    if (requesterRole === 'admin_bidang') {
      targetStatusFilter = 'Target_Diajukan';
      nextStatus = 'Target_ACC_Admin';
    } else if (requesterRole === 'pemimpin') {
      targetStatusFilter = 'Target_ACC_Admin';
      nextStatus = 'Target_Disetujui';
    } else {
      // Admin, perencana
      targetStatusFilter = { $in: ['Target_ACC_Admin', 'Target_Diajukan'] };
      nextStatus = 'Target_Disetujui';
    }

    // Set the status of all monthly records of this employee for this indicator for the selected year
    const result = await Renaksi.updateMany(
      { employeeId, indicatorId, tahun: yearNum, status: targetStatusFilter },
      { $set: { status: nextStatus, isCrossCuttingSelected: true } }
    );

    if (result.modifiedCount === 0 && (requesterRole === 'pemimpin' || requesterRole === 'admin_bidang')) {
      return NextResponse.json({
        error: requesterRole === 'pemimpin'
          ? 'Tidak ada target yang berstatus ACC Admin Bidang untuk divalidasi.'
          : 'Tidak ada target diajukan staf untuk di-ACC.'
      }, { status: 400 });
    }

    if (requesterRole === 'admin_bidang') {
      // Find the employee's bidang to restrict cross-cutting selection within the bidang
      const Employee = (await import('@/models/Employee')).default;
      const emp = await Employee.findOne({ id: employeeId });
      const userBidang = emp ? (emp.bidangs[0] || '') : '';

      if (userBidang) {
        // Set other employees' records in the same bidang for this indicator to isCrossCuttingSelected = false
        await Renaksi.updateMany(
          {
            employeeId: { $ne: employeeId },
            indicatorId,
            tahun: yearNum,
            bidang: userBidang
          },
          { $set: { isCrossCuttingSelected: false } }
        );
      }
    } else if (requesterRole === 'perencana') {
      // Admin Perencana chooses this employee's target as the official cross-cutting one across the entire agency!
      await Renaksi.updateMany(
        {
          employeeId: { $ne: employeeId },
          indicatorId,
          tahun: yearNum
        },
        { $set: { isCrossCuttingSelected: false } }
      );
    }

    return NextResponse.json({
      message: `Rencana target renaksi berhasil diupdate ke status ${nextStatus}`,
      modifiedCount: result.modifiedCount,
      nextStatus
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
