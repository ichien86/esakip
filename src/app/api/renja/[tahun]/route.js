import { NextResponse } from 'next/server';
import RenjaService from '@/services/RenjaService';

export async function GET(request, { params }) {
  try {
    const { tahun } = await params;
    const yearNum = parseInt(tahun);

    const enrichedData = await RenjaService.getRenja(yearNum);

    return NextResponse.json(enrichedData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
