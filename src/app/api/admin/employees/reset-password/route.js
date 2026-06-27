import { NextResponse } from 'next/server';
import EmployeeService from '@/services/EmployeeService';
import { getValidatedUser } from '@/lib/api-auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { employeeId } = body;
    const { role: requesterRole } = getValidatedUser(request, body.requesterRole);

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
