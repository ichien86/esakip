import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';
import { getValidatedUser } from '@/lib/api-auth';

export async function POST(request) {
  try {
    await dbConnect();
    const { id, catatanAdmin } = await request.json();
    const { role: requesterRole } = getValidatedUser(request, request.headers.get('x-requester-role'));

    const record = await Renaksi.findOne({ id });
    if (!record) {
      return NextResponse.json({ error: 'Data renaksi tidak ditemukan' }, { status: 404 });
    }

    const Employee = (await import('@/models/Employee')).default;
    const emp = await Employee.findOne({ id: record.employeeId });
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    if (emp.jenisJabatan === 'Pimpinan Tinggi') {
      if (requesterRole !== 'perencana') {
        return NextResponse.json({ error: 'Hanya Admin Perencana yang dapat menolak realisasi Pimpinan Tinggi.' }, { status: 403 });
      }
    } else if (emp.jenisJabatan === 'Administrator') {
      if (requesterRole !== 'perencana') {
        return NextResponse.json({ error: 'Hanya Admin Perencana yang dapat menolak realisasi Administrator.' }, { status: 403 });
      }
    } else { // Pengawas & Fungsional
      if (requesterRole !== 'admin_bidang') {
        return NextResponse.json({ error: 'Hanya Admin Unit Kerja yang dapat menolak realisasi Pengawas/Fungsional.' }, { status: 403 });
      }
    }

    if (!catatanAdmin || catatanAdmin.trim() === '') {
      return NextResponse.json({ error: 'Catatan penolakan wajib diisi' }, { status: 400 });
    }

    if (record.status !== 'Diajukan') {
      return NextResponse.json({ error: 'Hanya realisasi yang berstatus Diajukan yang dapat ditolak' }, { status: 400 });
    }

    record.status = 'Ditolak Admin';
    record.catatanAdmin = catatanAdmin;
    await record.save();

    return NextResponse.json({ message: 'Realisasi berhasil dikembalikan ke pegawai untuk direvisi', data: record });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
