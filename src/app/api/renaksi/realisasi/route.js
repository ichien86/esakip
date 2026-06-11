import { NextResponse } from 'next/server';
import RenaksiService from '@/services/RenaksiService';

export async function POST(request) {
  try {
    const body = await request.json();
    const record = await RenaksiService.saveRealisasi(body);
    
    return NextResponse.json({ message: 'Realisasi bulanan berhasil disimpan', data: record });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
