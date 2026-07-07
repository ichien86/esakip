import { NextResponse } from 'next/server';
import RenaksiRepository from '@/repositories/RenaksiRepository';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const bulan = searchParams.get('bulan');

    if (!tahun) {
      return NextResponse.json({ error: 'Parameter tahun diperlukan' }, { status: 400 });
    }

    // Ambil semua renaksi di tahun/bulan tersebut
    const records = await RenaksiRepository.findAll();
    let filteredRecords = records.filter(r => r.tahun === parseInt(tahun));
    
    if (bulan) {
      filteredRecords = filteredRecords.filter(r => r.bulan === parseInt(bulan));
    }

    const sharedVariables = {};

    for (const record of filteredRecords) {
      // 1. Ekspor variabel input riil (variablesRealization)
      if (record.variablesRealization && Array.isArray(record.variablesRealization)) {
        for (const v of record.variablesRealization) {
          if (v.name && v.value !== '' && v.value !== null) {
            if (!sharedVariables[v.name]) sharedVariables[v.name] = [];
            sharedVariables[v.name].push({
              value: v.value,
              buktiDukung: v.buktiDukung || '[]',
              indicatorId: record.indicatorId
            });
          }
        }
      }

      // 2. Ekspor hasil akhir (realisasiBulanan) jika memiliki Output Variable Alias
      if (record.snapshotOutputVariableAlias && record.realisasiBulanan !== null && record.realisasiBulanan !== undefined) {
        const alias = record.snapshotOutputVariableAlias.trim();
        if (alias) {
          if (!sharedVariables[alias]) sharedVariables[alias] = [];
          sharedVariables[alias].push({
            value: record.realisasiBulanan,
            buktiDukung: record.buktiDukung || '[]',
            indicatorId: record.indicatorId
          });
        }
      }
    }

    return NextResponse.json(sharedVariables);
  } catch (error) {
    console.error('API Error /api/renaksi/shared-variables:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
