import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function PUT(request) {
  try {
    await dbConnect();
    const requesterId = request.headers.get('x-requester-id') || '';
    
    if (!requesterId) {
      return NextResponse.json({ error: 'Akses ditolak. Silakan login kembali.' }, { status: 401 });
    }

    const { bidang } = await request.json();
    if (!bidang) {
      return NextResponse.json({ error: 'Unit kerja wajib dipilih.' }, { status: 400 });
    }

    const employee = await Employee.findOne({ id: requesterId });
    if (!employee) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan.' }, { status: 404 });
    }

    // Verify supervisor relationship
    if (!employee.parentId) {
      return NextResponse.json({ error: 'Anda tidak memiliki atasan langsung untuk merujuk unit kerja.' }, { status: 400 });
    }

    const supervisor = await Employee.findOne({ id: employee.parentId });
    if (!supervisor) {
      return NextResponse.json({ error: 'Atasan langsung tidak ditemukan.' }, { status: 400 });
    }

    // Check if supervisor is indeed a Plt with multiple units
    if (supervisor.bidangs.length <= 1) {
      return NextResponse.json({ error: 'Pilihan unit kerja dikunci karena atasan Anda tidak merangkap jabatan (bukan Plt).' }, { status: 400 });
    }

    // Check if the selected unit is led by the supervisor
    if (!supervisor.bidangs.includes(bidang)) {
      return NextResponse.json({ error: 'Unit kerja tidak valid. Atasan Anda tidak memimpin unit kerja ini.' }, { status: 400 });
    }

    // Update employee's unit kerja in the database
    employee.bidangs = [bidang];
    await employee.save();

    return NextResponse.json({
      message: 'Unit kerja berhasil diubah',
      employee
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
