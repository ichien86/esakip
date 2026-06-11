import { NextResponse } from 'next/server';
import RenjaService from '@/services/RenjaService';

export async function POST(request) {
  try {
    const body = await request.json();
    const { tahun } = body;

    if (!tahun) {
      return NextResponse.json({ error: 'Tahun tidak ditentukan' }, { status: 400 });
    }

    const yearNum = parseInt(tahun);
    const insertedCount = await RenjaService.sync(yearNum);

    return NextResponse.json({ 
      message: 'Sinkronisasi berhasil', 
      insertedCount 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
