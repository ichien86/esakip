import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import Cascading5YearsRepository from '@/repositories/Cascading5YearsRepository';
import { resolveTreePICs } from '@/lib/pic-resolver';

class CascadingAnnualService {
  /**
   * Mengambil dan memformat data Cascading Annual.
   */
  async getCascadingAnnualData() {
    const data = await CascadingAnnualRepository.findAll();
    const resolvedData = resolveTreePICs(data);
    
    const mapped = resolvedData.map(node => {
      let lvl = node.level;
      if (lvl === 'program') lvl = 'sasaran_program';
      else if (lvl === 'kegiatan') lvl = 'sasaran_kegiatan';
      else if (lvl === 'subkegiatan') lvl = 'sasaran_subkegiatan';
      else if (lvl === 'aktivitas') lvl = 'sasaran_aktivitas';
      if (lvl === 'indikator_tujuan' || lvl === 'indikator_sasaran') return null;

      let indicators = node.indicators || [];
      if (indicators.length === 0 && node.indikator && node.indikator !== '-') {
        indicators = [{
          id: `ind_mig_${node.id}`,
          indikator: node.indikator,
          satuan: node.satuan || '-',
          tipeTarget: node.tipeTarget || 'Kondisi Akhir Naik',
          target: node.target || '0'
        }];
      }

      // Convert to plain object to ensure we don't return Mongoose documents directly
      const plainNode = typeof node.toObject === 'function' ? node.toObject() : node;

      return {
        ...plainNode,
        level: lvl,
        indicators,
        sasaran: plainNode.sasaran || plainNode.sasaranSubkegiatan || '',
        nomenklatur: plainNode.nomenklatur || (['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan'].includes(lvl) ? plainNode.text : '')
      };
    }).filter(Boolean);

    return mapped;
  }

  /**
   * Menyimpan data Cascading Annual baru atau memperbarui yang ada.
   */
  async saveCascadingAnnualData(body) {
    const {
      id, level, text, indikator, target, satuan, tipeTarget, parentId, bidangPengampu,
      crossCuttingType, splitTargets, tahun,
      requesterRole, requesterBidang,
      sasaranSubkegiatan, definisiOperasional, metodePenghitungan, variabelJumlah, variabelPembilang, variabelPenyebut,
      masterId, anggaran, anggaranDpa, sasaran, nomenklatur, indicators
    } = body;

    const finalBidang = Array.isArray(bidangPengampu) ? bidangPengampu : (bidangPengampu ? [bidangPengampu] : []);

    if (!level || !text || finalBidang.length === 0) {
      throw new Error('Data cascading tidak lengkap');
    }

    if (requesterRole === 'admin_bidang') {
      if (level === 'tujuan' || level === 'sasaran') {
        const err = new Error('Hanya Administrator Sistem yang dapat mengubah Tujuan & Sasaran Makro.');
        err.status = 403;
        throw err;
      }
      const hasAccess = finalBidang.every(b => requesterBidang === b);
      if (!hasAccess) {
        const err = new Error(`Anda hanya dapat mengelola cascading pengampuan bidang Anda (${requesterBidang})`);
        err.status = 403;
        throw err;
      }
    }

    const itemId = id || `${level.substring(0, 3)}_${Date.now()}`;

    // Validate global uniqueness for subkegiatan masterId
    if (level === 'sasaran_subkegiatan' || level === 'subkegiatan') {
      if (masterId) {
        const existingSubkeg = await CascadingAnnualRepository.findOne({
          masterId: masterId,
          tahun: tahun || 2026,
          id: { $ne: itemId }
        });
        if (existingSubkeg) {
          const err = new Error('Subkegiatan ini sudah digunakan di bagian lain untuk tahun ini dan tidak boleh diduplikasi.');
          err.status = 400;
          throw err;
        }
      }
    }

    const itemData = {
      id: itemId,
      level,
      text,
      indikator: indikator || '-',
      target: target || '0',
      satuan: satuan || '-',
      tipeTarget: tipeTarget || 'Kondisi Akhir Naik',
      parentId: parentId || null,
      bidangPengampu: finalBidang,
      crossCuttingType: crossCuttingType || 'shared',
      splitTargets: splitTargets || {},
      tahun: tahun || 2026,
      sasaranSubkegiatan: sasaranSubkegiatan || '',
      definisiOperasional: definisiOperasional || '',
      metodePenghitungan: metodePenghitungan || 'Jumlah',
      variabelJumlah: variabelJumlah || '',
      variabelPembilang: variabelPembilang || '',
      variabelPenyebut: variabelPenyebut || '',
      masterId: masterId || null,
      anggaran: anggaran || 0,
      anggaranDpa: anggaranDpa || 0,
      sasaran: sasaran || '',
      nomenklatur: nomenklatur || '',
      indicators: indicators || []
    };

    const savedItem = await CascadingAnnualRepository.createOrUpdate(itemData);

    // Sync back to Cascading5Years target & budget for the corresponding year
    try {
      const yearNum = tahun || 2026;
      const fiveYearMatch = await Cascading5YearsRepository.findOne({
        $or: [
          { level: level, text: text },
          { level: level, masterId: masterId }
        ]
      });

      if (fiveYearMatch) {
        // Sync indicator targets inside the array
        if (Array.isArray(indicators) && Array.isArray(fiveYearMatch.indicators)) {
          indicators.forEach(ind => {
            const matchInd5 = fiveYearMatch.indicators.find(i5 => i5.indikator === ind.indikator);
            if (matchInd5) {
              matchInd5[`target${yearNum}`] = ind.target;
            }
          });
          fiveYearMatch.markModified('indicators');
        }

        if (level === 'sasaran_subkegiatan' || level === 'subkegiatan') {
          fiveYearMatch[`anggaran${yearNum}`] = (anggaran || 0).toString();
          
          const val2025 = yearNum === 2025 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2025) || 0);
          const val2026 = yearNum === 2026 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2026) || 0);
          const val2027 = yearNum === 2027 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2027) || 0);
          const val2028 = yearNum === 2028 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2028) || 0);
          const val2029 = yearNum === 2029 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2029) || 0);
          const val2030 = yearNum === 2030 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2030) || 0);
          
          fiveYearMatch.anggaranAkhir = (val2025 + val2026 + val2027 + val2028 + val2029 + val2030).toString();
        }
        await Cascading5YearsRepository.saveDocument(fiveYearMatch);
      }
    } catch (err) {
      console.error('Failed to sync to Cascading5Years:', err);
    }

    return savedItem;
  }
}

export default new CascadingAnnualService();
