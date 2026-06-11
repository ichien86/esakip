import { NextResponse } from 'next/server';
import EmployeeService from '@/services/EmployeeService';

export async function POST(request) {
  try {
    const body = await request.json();
    await EmployeeService.changePassword(body);

    return NextResponse.json({ message: 'Password berhasil diubah' });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
