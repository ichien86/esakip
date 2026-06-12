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

    const mergeResult = await mergeDuplicateNodes();

    return NextResponse.json({
      message: 'Migrasi database berhasil diselesaikan.',
      annualUpdatedCount,
      fiveYearsUpdatedCount,
      merged5YNodesCount: mergeResult.merged5YNodesCount,
      mergedAnnualNodesCount: mergeResult.mergedAnnualNodesCount
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function mergeDuplicateNodes() {
  const Cascading5Years = (await import('@/models/Cascading5Years')).default;
  const Indicator5Years = (await import('@/models/Indicator5Years')).default;
  const CascadingAnnual = (await import('@/models/CascadingAnnual')).default;
  const IndicatorAnnual = (await import('@/models/IndicatorAnnual')).default;

  const Selection = (await import('@/models/Selection')).default;
  const Renaksi = (await import('@/models/Renaksi')).default;
  const Performance = (await import('@/models/Performance')).default;

  function robustNormalizeText(str) {
    if (!str) return '';
    return str
      .replace(/[\u00a0\s\r\n\t]+/g, ' ')
      .replace(/[^\w\s]/gi, '')
      .trim()
      .toLowerCase();
  }

  function normalizeParentId(parentId) {
    if (parentId === null || parentId === undefined || String(parentId).trim() === '' || String(parentId).trim() === 'null') {
      return 'ROOT';
    }
    return String(parentId).trim();
  }

  const levels = ['tujuan', 'sasaran', 'sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan', 'sasaran_aktivitas'];

  // --- 1. Merge Cascading5Years duplicates top-down sequentially ---
  let merged5YNodesCount = 0;
  for (const lvl of levels) {
    const nodesAtLevel = await Cascading5Years.find({ level: lvl });
    const groups = {};
    for (const node of nodesAtLevel) {
      const textNorm = robustNormalizeText(node.text);
      const parentKey = normalizeParentId(node.parentId);
      const key = `${textNorm}_${parentKey}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(node);
    }

    for (const key of Object.keys(groups)) {
      const group = groups[key];
      if (group.length > 1) {
        group.sort((a, b) => a.id.localeCompare(b.id));
        const survivor = group[0];
        const duplicates = group.slice(1);
        const duplicateIds = duplicates.map(d => d.id);

        // Move indicators from duplicates to survivor
        await Indicator5Years.updateMany(
          { nodeId: { $in: duplicateIds } },
          { $set: { nodeId: survivor.id } }
        );

        // Update children parentId to survivor id
        await Cascading5Years.updateMany(
          { parentId: { $in: duplicateIds } },
          { $set: { parentId: survivor.id } }
        );

        // Delete duplicate nodes
        await Cascading5Years.deleteMany({ id: { $in: duplicateIds } });
        merged5YNodesCount += duplicateIds.length;
      }
    }
  }

  // --- 2. Merge CascadingAnnual duplicates top-down sequentially ---
  let mergedAnnualNodesCount = 0;
  for (const lvl of levels) {
    const nodesAtLevel = await CascadingAnnual.find({ level: lvl });
    const groups = {};
    for (const node of nodesAtLevel) {
      const textNorm = robustNormalizeText(node.text);
      const parentKey = normalizeParentId(node.parentId);
      const year = node.tahun || 2026;
      const key = `${textNorm}_${parentKey}_${year}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(node);
    }

    for (const key of Object.keys(groups)) {
      const group = groups[key];
      if (group.length > 1) {
        group.sort((a, b) => a.id.localeCompare(b.id));
        const survivor = group[0];
        const duplicates = group.slice(1);
        const duplicateIds = duplicates.map(d => d.id);

        // Move indicators to survivor
        await IndicatorAnnual.updateMany(
          { nodeId: { $in: duplicateIds } },
          { $set: { nodeId: survivor.id } }
        );

        // Update children parentId to survivor id
        await CascadingAnnual.updateMany(
          { parentId: { $in: duplicateIds } },
          { $set: { parentId: survivor.id } }
        );

        // Update selections in Selection collection
        for (const dupId of duplicateIds) {
          await Selection.updateMany(
            { selectedIndicators: dupId },
            { $set: { "selectedIndicators.$": survivor.id } }
          );
        }

        // Update Renaksi target indicatorId
        for (const dupId of duplicateIds) {
          await Renaksi.updateMany(
            { indicatorId: dupId },
            { $set: { indicatorId: survivor.id } }
          );
        }

        // Update Performance targetIKU
        for (const dupId of duplicateIds) {
          await Performance.updateMany(
            { targetIKU: dupId },
            { $set: { "targetIKU.$": survivor.id } }
          );
        }

        // Delete duplicate nodes
        await CascadingAnnual.deleteMany({ id: { $in: duplicateIds } });
        mergedAnnualNodesCount += duplicateIds.length;
      }
    }
  }

  return { merged5YNodesCount, mergedAnnualNodesCount };
}
