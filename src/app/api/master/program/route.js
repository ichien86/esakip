import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import MasterProgram from '@/models/MasterProgram';

export async function GET() {
  await dbConnect();
  const data = await MasterProgram.find({}).sort({ id: 1 });
  return NextResponse.json(data);
}

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const id = body.id || `mp_${Date.now()}`;
    const { nama } = body;
    
    let item = await MasterProgram.findOne({ id });
    if (item) {
      item.nama = nama;
      await item.save();
    } else {
      item = new MasterProgram({ id, nama });
      await item.save();
    }
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
