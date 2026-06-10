import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CascadingAnnual from '@/models/CascadingAnnual';
import Cascading5Years from '@/models/Cascading5Years';
import { resolveTreePICs } from '@/lib/pic-resolver';

export async function GET(request, { params }) {
  try {
    await dbConnect();
    const { tahun } = await params;
    const yearNum = parseInt(tahun);

    const annualNodes = await CascadingAnnual.find({ tahun: yearNum });
    const resolvedNodes = resolveTreePICs(annualNodes);
    const fiveYearNodes = await Cascading5Years.find({});

    const enrichedData = resolvedNodes.map(node => {
      const fiveYearMatch = fiveYearNodes.find(c5 => {
        if (node.level === 'tujuan' || node.level === 'sasaran') {
          return c5.level === node.level && c5.text === node.text;
        }
        return c5.level === node.level && c5.masterId === node.masterId;
      });

      return {
        ...node.toObject(),
        target5Tahun: fiveYearMatch ? fiveYearMatch[`target${tahun}`] : null,
        targetAkhir5Tahun: fiveYearMatch ? fiveYearMatch.targetAkhir : null,
        anggaran5Tahun: fiveYearMatch ? fiveYearMatch[`anggaran${tahun}`] : null,
        anggaranAkhir5Tahun: fiveYearMatch ? fiveYearMatch.anggaranAkhir : null
      };
    });

    return NextResponse.json(enrichedData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
