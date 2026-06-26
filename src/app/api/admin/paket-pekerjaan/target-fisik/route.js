import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PaketPekerjaan from '@/models/PaketPekerjaan';

// POST: Simpan target fisik per paket (dari UI Spreadsheet)
export async function POST(request) {
  try {
    await dbConnect();
    const { items } = await request.json();
    // items = [{ id, targetFisik: { jan, feb, ... } }]

    const ops = items.map(item => ({
      updateOne: {
        filter: { id: item.id },
        update: { $set: { targetFisik: item.targetFisik } }
      }
    }));

    await PaketPekerjaan.bulkWrite(ops);
    return NextResponse.json({ message: 'Target fisik berhasil disimpan' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
