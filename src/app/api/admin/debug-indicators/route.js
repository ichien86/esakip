import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';
import Indicator5Years from '@/models/Indicator5Years';
import Cascading5YearsService from '@/services/Cascading5YearsService';

export async function GET() {
  try {
    await dbConnect();

    // 1. Get raw node
    const rawNode = await Cascading5Years.findOne({ id: '5y_tuj_1' });
    
    // 2. Get raw indicators from collection
    const rawIndicators = await Indicator5Years.find({ nodeId: '5y_tuj_1' });

    // 3. Get mapped node from service
    const mappedData = await Cascading5YearsService.getCascading5YearsData();
    const mappedNode = mappedData.find(n => n.id === '5y_tuj_1');

    return NextResponse.json({
      rawNode: rawNode ? {
        id: rawNode.id,
        text: rawNode.text,
        level: rawNode.level,
        indikator: rawNode.indikator,
        satuan: rawNode.satuan,
        indicators: rawNode.indicators
      } : null,
      rawIndicatorsCount: rawIndicators.length,
      rawIndicators: rawIndicators.map(ind => ({
        id: ind.id,
        nodeId: ind.nodeId,
        indikator: ind.indikator,
        satuan: ind.satuan
      })),
      mappedNode: mappedNode ? {
        id: mappedNode.id,
        text: mappedNode.text,
        level: mappedNode.level,
        indicatorsCount: mappedNode.indicators ? mappedNode.indicators.length : 0,
        indicators: mappedNode.indicators
      } : null
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
