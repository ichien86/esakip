import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';
import Indicator5Years from '@/models/Indicator5Years';

export async function GET() {
  try {
    await dbConnect();

    // 1. Get all indicators in Indicator5Years collection
    const allIndicators = await Indicator5Years.find({});

    // 2. Get all nodes in Cascading5Years collection
    const allNodes = await Cascading5Years.find({});

    return NextResponse.json({
      totalIndicators: allIndicators.length,
      indicators: allIndicators.map(ind => ({
        id: ind.id,
        nodeId: ind.nodeId,
        indikator: ind.indikator,
        satuan: ind.satuan
      })),
      totalNodes: allNodes.length,
      nodes: allNodes.map(n => ({
        id: n.id,
        text: n.text,
        level: n.level,
        indikator: n.indikator
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
