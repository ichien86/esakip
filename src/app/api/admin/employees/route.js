import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { nama, nip, jabatan, roles, parentId, bidangs, requesterRole } = body;

    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Administrator Sistem yang dapat mengelola manajemen user.' }, { status: 403 });
    }

    const finalRoles = Array.isArray(roles) ? roles : (body.role ? [body.role] : []);
    const finalBidangs = Array.isArray(bidangs) ? bidangs : (body.bidang ? [body.bidang] : []);

    if (!nama || !nip || !jabatan || finalRoles.length === 0 || finalBidangs.length === 0) {
      return NextResponse.json({ error: 'Field nama, nip, jabatan, role, dan bidang wajib diisi' }, { status: 400 });
    }

    const newEmp = new Employee({
      id: 'emp_' + Date.now(),
      nama,
      nip,
      jabatan,
      roles: finalRoles,
      parentId: parentId || null,
      bidangs: finalBidangs
    });

    await newEmp.save();
    return NextResponse.json({ message: 'Pegawai berhasil ditambahkan', employee: newEmp });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
