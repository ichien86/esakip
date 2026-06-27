import { NextResponse } from 'next/server';
import EmployeeService from '@/services/EmployeeService';
import { getValidatedUser } from '@/lib/api-auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { role: requesterRole } = getValidatedUser(request, body.requesterRole);
    const newEmp = await EmployeeService.createEmployee({ body, requesterRole });

    return NextResponse.json({ message: 'Pegawai berhasil ditambahkan', employee: newEmp });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
