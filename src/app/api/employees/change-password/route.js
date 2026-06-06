import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function POST(request) {
  try {
    await dbConnect();
    const { employeeId, oldPassword, newPassword } = await request.json();

    if (!employeeId || !oldPassword || !newPassword) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const employee = await Employee.findOne({ id: employeeId });
    if (!employee) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    if (employee.password !== oldPassword) {
      return NextResponse.json({ error: 'Password lama salah' }, { status: 401 });
    }

    employee.password = newPassword;
    await employee.save();

    return NextResponse.json({ message: 'Password berhasil diubah' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
