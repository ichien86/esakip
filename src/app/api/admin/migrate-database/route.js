import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CascadingAnnual from '@/models/CascadingAnnual';
import Cascading5Years from '@/models/Cascading5Years';

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    await dbConnect();
    
    // Run the newest indicator separation auto-migration (Opsi A)
    const { runAutoMigration } = await import('@/lib/auto-migrate');
    await runAutoMigration();
    
    // 1. Migrate CascadingAnnual (Renja)
    const annualNodes = await CascadingAnnual.find({});
    let annualUpdatedCount = 0;
    const bulkOpsAnnual = [];
    
    for (const node of annualNodes) {
      let needsSave = false;
      const updates = {};

      // Migrate level names
      let currentLvl = node.level;
      let newLvl = currentLvl;
      if (currentLvl === 'program') {
        newLvl = 'sasaran_program';
        updates.level = newLvl;
        needsSave = true;
      } else if (currentLvl === 'kegiatan') {
        newLvl = 'sasaran_kegiatan';
        updates.level = newLvl;
        needsSave = true;
      } else if (currentLvl === 'subkegiatan') {
        newLvl = 'sasaran_subkegiatan';
        updates.level = newLvl;
        needsSave = true;
      } else if (currentLvl === 'aktivitas') {
        newLvl = 'sasaran_aktivitas';
        updates.level = newLvl;
        needsSave = true;
      }

      // Migrate indicator to array
      if ((!node.indicators || node.indicators.length === 0) && node.indikator && node.indikator !== '-') {
        updates.indicators = [{
          id: `ind_mig_${node.id}`,
          indikator: node.indikator,
          satuan: node.satuan || '-',
          tipeTarget: node.tipeTarget || 'Kondisi Akhir Naik',
          target: node.target || '0'
        }];
        needsSave = true;
      }

      // Migrate sasaran & nomenklatur fallbacks
      if (!node.sasaran && (node.sasaranSubkegiatan || node.text)) {
        updates.sasaran = node.sasaranSubkegiatan || '';
        needsSave = true;
      }
      if (!node.nomenklatur && ['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan', 'program', 'kegiatan', 'subkegiatan'].includes(newLvl)) {
        updates.nomenklatur = node.text;
        needsSave = true;
      }

      if (needsSave) {
        bulkOpsAnnual.push({
          updateOne: {
            filter: { _id: node._id },
            update: { $set: updates }
          }
        });
        annualUpdatedCount++;
      }
    }

    if (bulkOpsAnnual.length > 0) {
      await CascadingAnnual.bulkWrite(bulkOpsAnnual);
    }

    // 2. Migrate Cascading5Years (Renstra)
    const fiveYearNodes = await Cascading5Years.find({});
    let fiveYearsUpdatedCount = 0;
    const bulkOpsFiveYears = [];

    for (const node of fiveYearNodes) {
      let needsSave = false;
      const updates = {};

      // Migrate level names
      let currentLvl = node.level;
      let newLvl = currentLvl;
      if (currentLvl === 'program') {
        newLvl = 'sasaran_program';
        updates.level = newLvl;
        needsSave = true;
      } else if (currentLvl === 'kegiatan') {
        newLvl = 'sasaran_kegiatan';
        updates.level = newLvl;
        needsSave = true;
      } else if (currentLvl === 'subkegiatan') {
        newLvl = 'sasaran_subkegiatan';
        updates.level = newLvl;
        needsSave = true;
      } else if (currentLvl === 'aktivitas') {
        newLvl = 'sasaran_aktivitas';
        updates.level = newLvl;
        needsSave = true;
      }

      // Migrate indicator to array
      if ((!node.indicators || node.indicators.length === 0) && node.indikator && node.indikator !== '-') {
        updates.indicators = [{
          id: `ind_mig_${node.id}`,
          indikator: node.indikator,
          satuan: node.satuan || '-',
          tipeTarget: node.tipeTarget || 'Kondisi Akhir Naik',
          target2025: node.target2025 || '0',
          target2026: node.target2026 || '0',
          target2027: node.target2027 || '0',
          target2028: node.target2028 || '0',
          target2029: node.target2029 || '0',
          target2030: node.target2030 || '0',
          targetAkhir: node.targetAkhir || '0'
        }];
        needsSave = true;
      }

      // Migrate sasaran & nomenklatur fallbacks
      if (!node.sasaran && (node.sasaranSubkegiatan || node.text)) {
        updates.sasaran = node.sasaranSubkegiatan || '';
        needsSave = true;
      }
      if (!node.nomenklatur && ['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan', 'program', 'kegiatan', 'subkegiatan'].includes(newLvl)) {
        updates.nomenklatur = node.text;
        needsSave = true;
      }

      if (needsSave) {
        bulkOpsFiveYears.push({
          updateOne: {
            filter: { _id: node._id },
            update: { $set: updates }
          }
        });
        fiveYearsUpdatedCount++;
      }
    }

    if (bulkOpsFiveYears.length > 0) {
      await Cascading5Years.bulkWrite(bulkOpsFiveYears);
    }

    return NextResponse.json({
      message: 'Migrasi database berhasil diselesaikan.',
      annualUpdatedCount,
      fiveYearsUpdatedCount
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
