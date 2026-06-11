import { NextResponse } from 'next/server';
import RenjaService from '@/services/RenjaService';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type harus multipart/form-data.' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const tahun = formData.get('tahun');

    if (!file) {
      return NextResponse.json({ error: 'File Excel tidak ditemukan.' }, { status: 400 });
    }
    if (!tahun) {
      return NextResponse.json({ error: 'Tahun tidak ditentukan.' }, { status: 400 });
    }

    const yearNum = parseInt(tahun);
    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    const updatedCount = await RenjaService.importDPA(fileBuffer, yearNum);

    return NextResponse.json({ 
      message: 'Impor Anggaran DPA berhasil diaplikasikan', 
      updatedCount 
    });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
