import Cascading5Years from '@/models/Cascading5Years';
import CascadingAnnual from '@/models/CascadingAnnual';
import Indicator5Years from '@/models/Indicator5Years';
import IndicatorAnnual from '@/models/IndicatorAnnual';

export async function runAutoMigration() {
  try {
    // 1. Periksa apakah masih ada dokumen dengan array indicators atau singular indikator yang belum dipindahkan
    const hasOld5Y = await Cascading5Years.findOne({ "indicators.0": { $exists: true } });
    const hasOldAnn = await CascadingAnnual.findOne({ "indicators.0": { $exists: true } });
    
    const hasSingular5Y = await Cascading5Years.findOne({
      level: { $in: ['tujuan', 'sasaran', 'sasaran_subkegiatan', 'subkegiatan'] },
      indikator: { $ne: '-' }
    });
    
    const hasSingularAnn = await CascadingAnnual.findOne({
      level: { $in: ['tujuan', 'sasaran', 'sasaran_subkegiatan', 'subkegiatan'] },
      indikator: { $ne: '-' }
    });

    if (!hasOld5Y && !hasOldAnn && !hasSingular5Y && !hasSingularAnn) {
      // Data sudah dimigrasikan sepenuhnya
      return;
    }

    console.log('[Auto-Migration] Terdeteksi data indikator berformat lama. Memulai migrasi Opsi A...');

    // 2. Migrasikan Indikator Renstra 5 Tahunan
    const nodes5Y = await Cascading5Years.find({});
    let migrated5YCount = 0;
    
    for (const node of nodes5Y) {
      let inds = node.indicators || [];
      
      // Gunakan fallback jika array kosong tapi field singular di root ada isinya
      if (inds.length === 0 && node.indikator && node.indikator !== '-') {
        inds = [{
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
          targetAkhir: node.targetAkhir || '0',
          definisiOperasional: node.definisiOperasional || '',
          metodePenghitungan: node.metodePenghitungan || 'Jumlah',
          variabelJumlah: node.variabelJumlah || '',
          variabelPembilang: node.variabelPembilang || '',
          variabelPenyebut: node.variabelPenyebut || ''
        }];
      }

      if (inds.length > 0) {
        for (const ind of inds) {
          const indId = ind.id || `ind_5y_${node.id}_${Math.random().toString(36).substring(2, 7)}`;
          await Indicator5Years.updateOne(
            { id: indId },
            {
              $set: {
                id: indId,
                nodeId: node.id,
                indikator: ind.indikator,
                satuan: ind.satuan || '-',
                tipeTarget: ind.tipeTarget || 'Kondisi Akhir Naik',
                target2025: ind.target2025 || '0',
                target2026: ind.target2026 || '0',
                target2027: ind.target2027 || '0',
                target2028: ind.target2028 || '0',
                target2029: ind.target2029 || '0',
                target2030: ind.target2030 || '0',
                targetAkhir: ind.targetAkhir || '0',
                definisiOperasional: ind.definisiOperasional || '',
                metodePenghitungan: ind.metodePenghitungan || 'Jumlah',
                variabelJumlah: ind.variabelJumlah || '',
                variabelPembilang: ind.variabelPembilang || '',
                variabelPenyebut: ind.variabelPenyebut || ''
              }
            },
            { upsert: true }
          );
          migrated5YCount++;
        }
        
        // Bersihkan array lama di node utama agar tidak ganda di kemudian hari
        await Cascading5Years.updateOne({ id: node.id }, { $set: { indicators: [] } });
      }
    }

    // 3. Migrasikan Indikator Renja Tahunan
    const nodesAnnual = await CascadingAnnual.find({});
    let migratedAnnualCount = 0;
    
    for (const node of nodesAnnual) {
      let inds = node.indicators || [];

      if (inds.length === 0 && node.indikator && node.indikator !== '-') {
        inds = [{
          id: `ind_mig_${node.id}`,
          indikator: node.indikator,
          satuan: node.satuan || '-',
          tipeTarget: node.tipeTarget || 'Kondisi Akhir Naik',
          target: node.target || '0',
          definisiOperasional: node.definisiOperasional || '',
          metodePenghitungan: node.metodePenghitungan || 'Jumlah',
          variabelJumlah: node.variabelJumlah || '',
          variabelPembilang: node.variabelPembilang || '',
          variabelPenyebut: node.variabelPenyebut || ''
        }];
      }

      if (inds.length > 0) {
        for (const ind of inds) {
          const indId = ind.id || `ind_ann_${node.id}_${Math.random().toString(36).substring(2, 7)}`;
          await IndicatorAnnual.updateOne(
            { id: indId },
            {
              $set: {
                id: indId,
                nodeId: node.id,
                tahun: node.tahun || 2026,
                indikator: ind.indikator,
                satuan: ind.satuan || '-',
                tipeTarget: ind.tipeTarget || 'Kondisi Akhir Naik',
                target: ind.target || '0',
                penanggungJawab: ind.penanggungJawab || node.penanggungJawab || null,
                definisiOperasional: ind.definisiOperasional || '',
                metodePenghitungan: ind.metodePenghitungan || 'Jumlah',
                variabelJumlah: ind.variabelJumlah || '',
                variabelPembilang: ind.variabelPembilang || '',
                variabelPenyebut: ind.variabelPenyebut || ''
              }
            },
            { upsert: true }
          );
          migratedAnnualCount++;
        }
        
        // Bersihkan array lama di node utama
        await CascadingAnnual.updateOne({ id: node.id }, { $set: { indicators: [] } });
      }
    }

    console.log(`[Auto-Migration] Sukses memindahkan ${migrated5YCount} indikator Renstra & ${migratedAnnualCount} indikator Renja.`);
  } catch (error) {
    console.error('[Auto-Migration] Kegagalan migrasi otomatis indikator:', error);
  }
}
