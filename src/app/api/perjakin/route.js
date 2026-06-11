import { NextResponse } from 'next/server';
import PerjakinService from '@/services/PerjakinService';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const tahun = searchParams.get('tahun');

    if (!employeeId || !tahun) {
      return NextResponse.json({ error: 'Parameter employeeId dan tahun wajib disertakan' }, { status: 400 });
    }

    const data = await PerjakinService.getPerjakinData(employeeId, tahun);
    return NextResponse.json({ message: 'Data Perjakin berhasil dimuat', data });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
