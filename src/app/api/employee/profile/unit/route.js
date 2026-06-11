import { NextResponse } from 'next/server';
import EmployeeService from '@/services/EmployeeService';

export async function PUT(request) {
  try {
    const requesterId = request.headers.get('x-requester-id') || '';
    const { bidang } = await request.json();

    const employee = await EmployeeService.changeUnit({ requesterId, bidang });

    return NextResponse.json({
      message: 'Unit kerja berhasil diubah',
      employee
    });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
