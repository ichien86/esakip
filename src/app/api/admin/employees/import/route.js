import { NextResponse } from 'next/server';
import EmployeeService from '@/services/EmployeeService';
import { getValidatedUser } from '@/lib/api-auth';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type harus multipart/form-data.' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const { role: requesterRole } = getValidatedUser(request, request.headers.get('x-requester-role'));


    if (!file) {
      return NextResponse.json({ error: 'File Excel tidak ditemukan.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    const { createdCount, updatedCount } = await EmployeeService.importEmployees({ fileBuffer, requesterRole });

    return NextResponse.json({
      message: 'Impor pegawai berhasil diselesaikan',
      createdCount,
      updatedCount
    });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
