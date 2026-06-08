import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';
import CascadingAnnual from '@/models/CascadingAnnual';
import Renaksi from '@/models/Renaksi';

export async function GET() {
  try {
    await dbConnect();
    const items = await Cascading5Years.find({});
    const annualNodes = await CascadingAnnual.find({});
    const renaksis = await Renaksi.find({});

    const monitoringData = items.map(item => {
      const targetAkhir = parseFloat(item.targetAkhir) || 0;
      let totalRealisasi = 0;
      const yearlyData = {};

      for (let year = 2025; year <= 2030; year++) {
        const yearTarget = parseFloat(item[`target${year}`]) || 0;

        // Find matching annual nodes that share indicators and fields (bidang)
        const matchingAnnualNodes = annualNodes.filter(c =>
          c.indikator === item.indikator &&
          c.bidangPengampu.some(b => item.bidangPengampu.includes(b))
        );
        const matchingIds = matchingAnnualNodes.map(n => n.id);

        // Filter monthly achievements for those indicators in the given year
        const yearRenaksi = renaksis.filter(r =>
          r.tahun === year &&
          matchingIds.includes(r.indicatorId) &&
          r.realisasiBulanan !== null &&
          r.isCrossCuttingSelected !== false
        );

        let yearRealisasi = 0;
        if (item.tipeTarget === 'Akumulatif') {
          yearRealisasi = yearRenaksi.reduce((sum, r) => sum + (parseFloat(r.realisasiBulanan) || 0), 0);
        } else {
          // Kondisi Akhir: take the latest non-null realization of that year
          const sorted = [...yearRenaksi].sort((a, b) => b.bulan - a.bulan);
          yearRealisasi = sorted.length > 0 ? (parseFloat(sorted[0].realisasiBulanan) || 0) : 0;
        }

        totalRealisasi += yearRealisasi;
        yearlyData[year] = { target: yearTarget, realisasi: yearRealisasi };
      }

      let progres = 0;
      if (targetAkhir > 0) {
        if (item.tipeTarget === 'Kondisi Akhir Menurun') {
          if (totalRealisasi === 0) progres = 0;
          else if (totalRealisasi <= targetAkhir) progres = 100;
          else progres = Math.min(100, (targetAkhir / totalRealisasi) * 100);
        } else {
          progres = Math.min(100, (totalRealisasi / targetAkhir) * 100);
        }
      }

      return {
        ...item.toObject(),
        totalRealisasi: Math.round(totalRealisasi * 100) / 100,
        progres: Math.round(progres * 100) / 100,
        yearlyData
      };
    });

    return NextResponse.json(monitoringData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
