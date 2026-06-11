import { NextResponse } from 'next/server';
import MasterService from '@/services/MasterService';

export async function GET() {
  try {
    const data = await MasterService.getKegiatans();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const item = await MasterService.saveKegiatan(body);
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
