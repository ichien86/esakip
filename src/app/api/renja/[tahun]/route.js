import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CascadingAnnual from '@/models/CascadingAnnual';
import Cascading5Years from '@/models/Cascading5Years';

export async function GET(request, { params }) {
  try {
    await dbConnect();
    const { tahun } = await params;
    const yearNum = parseInt(tahun);

    const annualNodes = await CascadingAnnual.find({ tahun: yearNum });
    const fiveYearNodes = await Cascading5Years.find({});

    const enrichedData = annualNodes.map(node => {
      const fiveYearMatch = fiveYearNodes.find(c5 =>
        c5.indikator === node.indikator &&
        c5.bidangPengampu.some(b => node.bidangPengampu.includes(b))
      );
      
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
