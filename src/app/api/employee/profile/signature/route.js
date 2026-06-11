import { NextResponse } from 'next/server';
import EmployeeService from '@/services/EmployeeService';

export async function POST(request) {
  try {
    const requesterId = request.headers.get('x-requester-id') || '';
    const { signatureUrl, hasDigitalSignature } = await request.json();

    const employee = await EmployeeService.updateSignature({
      requesterId,
      signatureUrl,
      hasDigitalSignature
    });

    return NextResponse.json({
      message: 'Profil tanda tangan berhasil diperbarui',
      employee: {
        id: employee.id,
        nama: employee.nama,
        signatureUrl: employee.signatureUrl,
        hasDigitalSignature: employee.hasDigitalSignature
      }
    });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
