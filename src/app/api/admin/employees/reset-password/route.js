import { NextResponse } from 'next/server';
import EmployeeService from '@/services/EmployeeService';

export async function POST(request) {
  try {
    const { employeeId, requesterRole } = await request.json();

    await EmployeeService.resetPassword({ 
      id: employeeId, 
      newPassword: 'bpbd@boyolali', 
      requesterRole 
    });

    return NextResponse.json({ message: 'Password berhasil direset ke bpbd@boyolali' });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
