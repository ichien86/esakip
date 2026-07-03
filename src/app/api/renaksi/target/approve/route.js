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
    
    const Employee = (await import('@/models/Employee')).default;
    const emp = await Employee.findOne({ id: employeeId });
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    const userBidang = emp.bidangs[0] || '';

    let targetStatusFilter = 'Target_Diajukan';
    let nextStatus = 'Target_Disetujui';

    if (emp.jenisJabatan === 'Pimpinan Tinggi') {
      if (requesterRole === 'perencana') {
        targetStatusFilter = 'Target_Diajukan';
        nextStatus = 'Target_Disetujui'; // Admin perencana acts as both verifier and validator
      } else {
        return NextResponse.json({ error: 'Target Pimpinan Tinggi hanya dapat disetujui oleh Admin Perencana.' }, { status: 403 });
      }
    } else if (emp.jenisJabatan === 'Administrator') {
      if (requesterRole === 'perencana') {
        targetStatusFilter = 'Target_Diajukan';
        nextStatus = 'Target_ACC_Admin';
      } else if (requesterRole === 'pemimpin') {
        targetStatusFilter = 'Target_ACC_Admin';
        nextStatus = 'Target_Disetujui';
      } else {
        return NextResponse.json({ error: 'Target Administrator diverifikasi oleh Admin Perencana dan disetujui Pimpinan Tinggi.' }, { status: 403 });
      }
    } else { // Pengawas & Fungsional
      if (requesterRole === 'admin_bidang') {
        targetStatusFilter = 'Target_Diajukan';
        nextStatus = 'Target_ACC_Admin';
      } else if (requesterRole === 'pemimpin') {
        targetStatusFilter = 'Target_ACC_Admin';
        nextStatus = 'Target_Disetujui';
      } else {
        return NextResponse.json({ error: 'Target Pengawas/Fungsional diverifikasi oleh Admin Unit dan disetujui Administrator.' }, { status: 403 });
      }
    }

    // Set the status of all monthly records of this employee for this indicator for the selected year
    const result = await Renaksi.updateMany(
      { employeeId, indicatorId, tahun: yearNum, status: targetStatusFilter },
      { $set: { status: nextStatus, isCrossCuttingSelected: true } }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({
        error: requesterRole === 'pemimpin'
          ? 'Tidak ada target yang berstatus ACC Admin untuk divalidasi.'
          : 'Tidak ada target yang diajukan untuk di-ACC.'
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
