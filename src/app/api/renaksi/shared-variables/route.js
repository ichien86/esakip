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

    // Ambil semua renaksi di tahun tersebut hingga bulan yang diminta
    const records = await RenaksiRepository.findAll();
    const targetBulan = parseInt(bulan || new Date().getMonth() + 1);
    const filteredRecords = records.filter(r => r.tahun === parseInt(tahun) && r.bulan <= targetBulan);

    // tempVars structure: { [varName]: { [indicatorId]: { currentMonthValue, ytdValue, buktiDukung } } }
    const tempVars = {};

    for (const record of filteredRecords) {
      const isCurrentMonth = record.bulan === targetBulan;

      // 1. Ekspor variabel input riil (variablesRealization)
      if (record.variablesRealization && Array.isArray(record.variablesRealization)) {
        for (const v of record.variablesRealization) {
          if (v.name && v.value !== '' && v.value !== null) {
            const val = parseFloat(v.value) || 0;
            
            if (!tempVars[v.name]) tempVars[v.name] = {};
            if (!tempVars[v.name][record.indicatorId]) {
              tempVars[v.name][record.indicatorId] = { currentMonthValue: 0, ytdValue: 0, buktiDukung: '[]' };
            }
            
            // Add to YTD sum
            tempVars[v.name][record.indicatorId].ytdValue += val;
            
            // Update current month value if it's the exact month requested
            if (isCurrentMonth) {
              tempVars[v.name][record.indicatorId].currentMonthValue = val;
              tempVars[v.name][record.indicatorId].buktiDukung = v.buktiDukung || '[]';
            } else if (tempVars[v.name][record.indicatorId].buktiDukung === '[]') {
              // Fallback: carry over previous month's buktiDukung if current is empty
              tempVars[v.name][record.indicatorId].buktiDukung = v.buktiDukung || '[]';
            }
          }
        }
      }

      // 2. Ekspor hasil akhir (realisasiBulanan) jika memiliki Output Variable Alias
      if (record.snapshotOutputVariableAlias && record.realisasiBulanan !== null && record.realisasiBulanan !== undefined) {
        const alias = record.snapshotOutputVariableAlias.trim();
        if (alias) {
          const val = parseFloat(record.realisasiBulanan) || 0;
          
          if (!tempVars[alias]) tempVars[alias] = {};
          if (!tempVars[alias][record.indicatorId]) {
            tempVars[alias][record.indicatorId] = { currentMonthValue: 0, ytdValue: 0, buktiDukung: '[]' };
          }
          
          tempVars[alias][record.indicatorId].ytdValue += val;
          
          if (isCurrentMonth) {
            tempVars[alias][record.indicatorId].currentMonthValue = val;
            tempVars[alias][record.indicatorId].buktiDukung = record.buktiDukung || '[]';
          }
        }
      }
    }

    const sharedVariables = {};
    for (const varName in tempVars) {
      sharedVariables[varName] = Object.keys(tempVars[varName]).map(indId => {
        const data = tempVars[varName][indId];
        return {
          indicatorId: indId,
          currentMonthValue: data.currentMonthValue,
          ytdValue: data.ytdValue,
          value: data.currentMonthValue, // Fallback for backward compatibility
          buktiDukung: data.buktiDukung
        };
      });
    }

    return NextResponse.json(sharedVariables);
  } catch (error) {
    console.error('API Error /api/renaksi/shared-variables:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
