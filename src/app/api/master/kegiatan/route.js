import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import MasterKegiatan from '@/models/MasterKegiatan';

export async function GET() {
  await dbConnect();
  const data = await MasterKegiatan.find({}).sort({ id: 1 });
  return NextResponse.json(data);
}

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const id = body.id || `mk_${Date.now()}`;
    const { programId, nama } = body;
    
    let item = await MasterKegiatan.findOne({ id });
    if (item) {
      item.programId = programId;
      item.nama = nama;
      await item.save();
    } else {
      item = new MasterKegiatan({ id, programId, nama });
      await item.save();
    }
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
