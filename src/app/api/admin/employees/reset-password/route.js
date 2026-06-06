import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function POST(request) {
  try {
    await dbConnect();
    const { employeeId, requesterRole } = await request.json();

    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Hanya Administrator Sistem yang diperbolehkan mereset password.' }, { status: 403 });
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID wajib diisi' }, { status: 400 });
    }

    const employee = await Employee.findOne({ id: employeeId });
    if (!employee) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    employee.password = 'bpbd@boyolali';
    await employee.save();

    return NextResponse.json({ message: `Password ${employee.nama} berhasil direset ke bpbd@boyolali` });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
