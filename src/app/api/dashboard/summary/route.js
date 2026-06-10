import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';
import Performance from '@/models/Performance';

export async function GET(request) {
  try {
    await dbConnect();
    const requestYear = request.headers.get('x-requester-year') || '2026';
    const yearNum = parseInt(requestYear);

    const employees = await Employee.find({ isActive: { $ne: false } });
    const performances = await Performance.find({ tahun: yearNum });

    const summary = employees.map(emp => {
      const perf = performances.find(p => p.employeeId === emp.id);
      return {
        id: emp.id,
        nama: emp.nama,
        jabatan: emp.jabatan,
        roles: emp.roles,
        parentId: emp.parentId,
        status: perf ? perf.status : 'Belum Mengisi',
        skorAKIP: perf && perf.evaluasiAtasan ? perf.evaluasiAtasan.skorAKIP : null,
        predikat: perf && perf.evaluasiAtasan ? perf.evaluasiAtasan.predikat : null
      };
    });

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
