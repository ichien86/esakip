import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';
import { getValidatedUser } from '@/lib/api-auth';

export async function POST(request) {
  try {
    await dbConnect();
    const { employeeId, indicatorId, catatanAdmin } = await request.json();

    if (!employeeId || !indicatorId || !catatanAdmin) {
      return NextResponse.json({ error: 'employeeId, indicatorId, dan catatanAdmin wajib diisi' }, { status: 400 });
    }

    const requestYear = request.headers.get('x-requester-year') || '2026';
    const yearNum = parseInt(requestYear);
    const { role: requesterRole } = getValidatedUser(request, request.headers.get('x-requester-role'));

    const Employee = (await import('@/models/Employee')).default;
    const emp = await Employee.findOne({ id: employeeId });
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    if (emp.jenisJabatan === 'Pimpinan Tinggi') {
      if (requesterRole !== 'perencana') {
        return NextResponse.json({ error: 'Hanya Admin Perencana yang dapat menolak target Pimpinan Tinggi.' }, { status: 403 });
      }
    } else if (emp.jenisJabatan === 'Administrator') {
      if (requesterRole !== 'perencana') {
        return NextResponse.json({ error: 'Hanya Admin Perencana yang dapat menolak target Administrator.' }, { status: 403 });
      }
    } else { // Pengawas & Fungsional
      if (requesterRole !== 'admin_bidang') {
        return NextResponse.json({ error: 'Hanya Admin Unit Kerja yang dapat menolak target Pengawas/Fungsional.' }, { status: 403 });
      }
    }

    // Update status to 'Target_Ditolak' and save the rejection note
    const result = await Renaksi.updateMany(
      { employeeId, indicatorId, tahun: yearNum, status: 'Target_Diajukan' },
      { 
        $set: { 
          status: 'Target_Ditolak',
          catatanAdmin: catatanAdmin,
          isCrossCuttingSelected: false
        } 
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({
        error: 'Tidak ada target berstatus "Target_Diajukan" untuk ditolak.'
      }, { status: 400 });
    }

    return NextResponse.json({
      message: `Rencana target renaksi berhasil ditolak dengan catatan.`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
