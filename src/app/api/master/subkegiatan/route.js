import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import MasterSubkegiatan from '@/models/MasterSubkegiatan';

export async function GET() {
  await dbConnect();
  const data = await MasterSubkegiatan.find({}).sort({ id: 1 });
  return NextResponse.json(data);
}

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const id = body.id || `msk_${Date.now()}`;
    const { kegiatanId, nama, indikator, satuan } = body;
    
    let item = await MasterSubkegiatan.findOne({ id });
    if (item) {
      item.kegiatanId = kegiatanId;
      item.nama = nama;
      item.indikator = indikator;
      item.satuan = satuan;
      await item.save();
    } else {
      item = new MasterSubkegiatan({ id, kegiatanId, nama, indikator, satuan });
      await item.save();
    }
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
