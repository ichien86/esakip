import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';

export async function POST(request) {
  try {
    await dbConnect();
    const { id } = await request.json();

    const record = await Renaksi.findOne({ id });
    if (!record) {
      return NextResponse.json({ error: 'Data renaksi tidak ditemukan' }, { status: 404 });
    }

    record.status = 'Disetujui';
    await record.save();

    return NextResponse.json({ message: 'Realisasi disetujui', data: record });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
