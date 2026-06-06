import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function PUT(request, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();
    const { nama, nip, jabatan, roles, parentId, bidangs, requesterRole, isActive } = body;

    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Administrator Sistem yang dapat melakukan manajemen user.' }, { status: 403 });
    }

    const finalRoles = Array.isArray(roles) ? roles : (body.role ? [body.role] : []);
    const finalBidangs = Array.isArray(bidangs) ? bidangs : (body.bidang ? [body.bidang] : []);

    const emp = await Employee.findOne({ id });
    if (!emp) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    emp.nama = nama;
    emp.nip = nip;
    emp.jabatan = jabatan;
    emp.roles = finalRoles;
    emp.parentId = parentId || null;
    emp.bidangs = finalBidangs;
    if (isActive !== undefined) {
      emp.isActive = isActive;
    }

    await emp.save();
    return NextResponse.json({ message: 'Data pegawai berhasil diubah', employee: emp });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const requesterRole = request.headers.get('x-requester-role') || '';

    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Administrator Sistem yang dapat melakukan manajemen user.' }, { status: 403 });
    }

    const emp = await Employee.findOne({ id });
    if (!emp) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    // Set active flag to false (deactivation) instead of hard delete
    emp.isActive = false;
    await emp.save();
    return NextResponse.json({ message: 'Pegawai berhasil dinonaktifkan' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
