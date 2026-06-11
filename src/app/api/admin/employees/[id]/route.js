import { NextResponse } from 'next/server';
import EmployeeService from '@/services/EmployeeService';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const requesterRole = body.requesterRole;
    const requestYear = request.headers.get('x-requester-year') || '2026';
    const yearNum = parseInt(requestYear);

    const emp = await EmployeeService.updateEmployee({ id, body, requesterRole, yearNum });

    return NextResponse.json({ message: 'Data pegawai berhasil diubah', employee: emp });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const requesterRole = request.headers.get('x-requester-role') || '';

    await EmployeeService.deleteEmployee({ id, requesterRole });

    return NextResponse.json({ message: 'Pegawai berhasil dinonaktifkan' });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
