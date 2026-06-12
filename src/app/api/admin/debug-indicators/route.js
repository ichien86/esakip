import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';

export async function GET() {
  try {
    await dbConnect();

    const tujuans = await Cascading5Years.find({ level: 'tujuan' });

    return NextResponse.json({
      tujuansCount: tujuans.length,
      tujuans: tujuans.map(t => ({
        id: t.id,
        text: t.text,
        textHex: Buffer.from(t.text || '').toString('hex'),
        level: t.level,
        parentId: t.parentId,
        parentIdType: typeof t.parentId,
        indikator: t.indikator
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
