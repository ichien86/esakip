import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';
import { getValidatedUser } from '@/lib/api-auth';

export async function POST(request) {
  try {
    await dbConnect();
    const { id } = await request.json();
    const { role: requesterRole } = getValidatedUser(request, request.headers.get('x-requester-role'));

    const record = await Renaksi.findOne({ id });
    if (!record) {
      return NextResponse.json({ error: 'Data renaksi tidak ditemukan' }, { status: 404 });
    }

    const Employee = (await import('@/models/Employee')).default;
    const emp = await Employee.findOne({ id: record.employeeId });
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // Validate Status State
    if (record.status !== 'Diajukan' && record.status !== 'Ditolak Admin' && record.status !== 'ACC_Admin') {
      return NextResponse.json({ error: `Realisasi dengan status ${record.status} tidak dapat diproses.` }, { status: 400 });
    }

    let nextStatus = 'Disetujui';

    if (emp.jenisJabatan === 'Pimpinan Tinggi') {
      if (requesterRole === 'perencana') {
        if (record.status !== 'Diajukan' && record.status !== 'Ditolak Admin') return NextResponse.json({ error: 'Realisasi belum diajukan.' }, { status: 400 });
        nextStatus = 'Disetujui';
      } else {
        return NextResponse.json({ error: 'Realisasi Pimpinan Tinggi hanya dapat disetujui oleh Admin Perencana.' }, { status: 403 });
      }
    } else if (emp.jenisJabatan === 'Administrator') {
      if (requesterRole === 'perencana') {
        if (record.status !== 'Diajukan' && record.status !== 'Ditolak Admin') return NextResponse.json({ error: 'Realisasi belum diajukan.' }, { status: 400 });
        nextStatus = 'ACC_Admin';
      } else if (requesterRole === 'pemimpin') {
        if (record.status !== 'ACC_Admin') return NextResponse.json({ error: 'Realisasi harus di-ACC Admin Perencana sebelum divalidasi Pimpinan Tinggi.' }, { status: 400 });
        nextStatus = 'Disetujui';
      } else {
        return NextResponse.json({ error: 'Realisasi Administrator diverifikasi oleh Admin Perencana dan disetujui Pimpinan Tinggi.' }, { status: 403 });
      }
    } else { // Pengawas & Fungsional
      if (requesterRole === 'admin_bidang') {
        if (record.status !== 'Diajukan' && record.status !== 'Ditolak Admin') return NextResponse.json({ error: 'Realisasi belum diajukan.' }, { status: 400 });
        nextStatus = 'ACC_Admin';
      } else if (requesterRole === 'pemimpin') {
        if (record.status !== 'ACC_Admin') return NextResponse.json({ error: 'Realisasi harus di-ACC Admin Unit sebelum divalidasi Administrator.' }, { status: 400 });
        nextStatus = 'Disetujui';
      } else {
        return NextResponse.json({ error: 'Realisasi Pengawas/Fungsional diverifikasi oleh Admin Unit dan disetujui Administrator.' }, { status: 403 });
      }
    }

    record.status = nextStatus;
    record.catatanAdmin = ''; // Clear notes when approved
    record.isCrossCuttingSelected = true;
    await record.save();

    // Set other employees' records in the same criteria to isCrossCuttingSelected = false if applicable
    if (requesterRole === 'admin_bidang' || requesterRole === 'perencana') {
       let query = {
          id: { $ne: record.id },
          indicatorId: record.indicatorId,
          tahun: record.tahun,
          bulan: record.bulan
       };
       if (requesterRole === 'admin_bidang') query.bidang = record.bidang; // limit to bidang

       await Renaksi.updateMany(query, { $set: { isCrossCuttingSelected: false } });
    }

    return NextResponse.json({ message: `Realisasi disetujui dengan status ${record.status}`, data: record });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
