import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CascadingAnnual from '@/models/CascadingAnnual';
import Cascading5Years from '@/models/Cascading5Years';

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { tahun } = body;

    if (!tahun) {
      return NextResponse.json({ error: 'Tahun tidak ditentukan' }, { status: 400 });
    }

    const yearNum = parseInt(tahun);
    const fiveYearNodes = await Cascading5Years.find({});

    // Delete existing nodes for this year
    await CascadingAnnual.deleteMany({ tahun: yearNum });

    // Map and clone
    const cAnnualToInsert = fiveYearNodes.map(c5 => {
      // Map indicators list
      const mappedIndicators = (c5.indicators || []).map(ind => ({
        id: ind.id || `ind_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        indikator: ind.indikator,
        satuan: ind.satuan,
        tipeTarget: ind.tipeTarget || 'Kondisi Akhir Naik',
        target: ind[`target${yearNum}`] || '0'
      }));

      return {
        id: `${c5.id}_${yearNum}`,
        level: c5.level,
        text: c5.text,
        indikator: c5.indikator || '-',
        target: c5[`target${yearNum}`] || '0',
        satuan: c5.satuan || '-',
        tipeTarget: c5.tipeTarget || 'Kondisi Akhir Naik',
        parentId: c5.parentId ? `${c5.parentId}_${yearNum}` : null,
        bidangPengampu: c5.bidangPengampu || [],
        crossCuttingType: c5.crossCuttingType || 'shared',
        splitTargets: c5.splitTargets || {},
        tahun: yearNum,
        masterId: c5.masterId || null,
        anggaran: (c5.level === 'subkegiatan' || c5.level === 'sasaran_subkegiatan') ? (parseFloat(c5[`anggaran${yearNum}`]) || 0) : 0,
        anggaranDpa: 0,
        sasaran: c5.sasaran || '',
        nomenklatur: c5.nomenklatur || '',
        indicators: mappedIndicators,
        sasaranSubkegiatan: c5.sasaranSubkegiatan || '',
        definisiOperasional: c5.definisiOperasional || '',
        metodePenghitungan: c5.metodePenghitungan || 'Jumlah',
        variabelJumlah: c5.variabelJumlah || '',
        variabelPembilang: c5.variabelPembilang || '',
        variabelPenyebut: c5.variabelPenyebut || ''
      };
    });

    if (cAnnualToInsert.length > 0) {
      await CascadingAnnual.insertMany(cAnnualToInsert);
    }

    return NextResponse.json({ 
      message: 'Sinkronisasi berhasil', 
      insertedCount: cAnnualToInsert.length 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
