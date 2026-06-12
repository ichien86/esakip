import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';
import Indicator5Years from '@/models/Indicator5Years';

export async function GET() {
  try {
    await dbConnect();

    const tujuans = await Cascading5Years.find({ level: 'tujuan' });
    const sasarans = await Cascading5Years.find({ level: 'sasaran' });
    const indicators = await Indicator5Years.find({
      nodeId: { $in: [...tujuans.map(t => t.id), ...sasarans.map(s => s.id), '5y_tuj_1', '5y_tuj_2', '5y_tuj_3', '5y_sas_4', '5y_sas_5'] }
    });

    return NextResponse.json({
      tujuansCount: tujuans.length,
      tujuans: tujuans.map(t => ({ id: t.id, text: t.text })),
      sasaransCount: sasarans.length,
      sasarans: sasarans.map(s => ({ id: s.id, text: s.text, parentId: s.parentId })),
      indicatorsCount: indicators.length,
      indicators: indicators.map(i => ({
        id: i.id,
        nodeId: i.nodeId,
        indikator: i.indikator,
        definisiOperasional: i.definisiOperasional || 'KOSONG'
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
