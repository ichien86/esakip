import Cascading5YearsRepository from '@/repositories/Cascading5YearsRepository';

class Cascading5YearsService {
  /**
   * Mengambil dan memformat data Cascading 5 Years.
   */
  async getCascading5YearsData() {
    const data = await Cascading5YearsRepository.findAll();
    
    const mapped = data.map(node => {
      let lvl = node.level;
      if (lvl === 'program') lvl = 'sasaran_program';
      else if (lvl === 'kegiatan') lvl = 'sasaran_kegiatan';
      else if (lvl === 'subkegiatan') lvl = 'sasaran_subkegiatan';
      else if (lvl === 'aktivitas') lvl = 'sasaran_aktivitas';

      let indicators = node.indicators || [];
      if (indicators.length === 0 && node.indikator && node.indikator !== '-') {
        indicators = [{
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
      }

      // Pastikan mengembalikan plain object
      const plainNode = typeof node.toObject === 'function' ? node.toObject() : node;

      return {
        ...plainNode,
        level: lvl,
        indicators,
        sasaran: plainNode.sasaran || plainNode.sasaranSubkegiatan || '',
        nomenklatur: plainNode.nomenklatur || (['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan'].includes(lvl) ? plainNode.text : '')
      };
    });

    return mapped;
  }

  /**
   * Fungsi rekursif untuk menyebarkan perubahan Bidang Pengampu ke anak-anaknya.
   */
  async propagateBidangPengampu(nodeId, newBidangPengampu) {
    const children = await Cascading5YearsRepository.find({ parentId: nodeId });
    for (const child of children) {
      child.bidangPengampu = newBidangPengampu;
      
      // Adjust splitTargets if any key in splitTargets is not in newBidangPengampu
      if (child.splitTargets && typeof child.splitTargets === 'object') {
        const updatedSplitTargets = {};
        newBidangPengampu.forEach(b => {
          updatedSplitTargets[b] = child.splitTargets[b] || '0';
        });
        child.splitTargets = updatedSplitTargets;
      }
      
      await Cascading5YearsRepository.saveDocument(child);
      // Recursively propagate
      await this.propagateBidangPengampu(child.id, newBidangPengampu);
    }
  }

  /**
   * Menyimpan data Cascading 5 Years baru atau memperbarui yang ada.
   */
  async saveCascading5YearsData(body) {
    const {
      id, level, text, indikator, satuan, tipeTarget, parentId, bidangPengampu,
      crossCuttingType, splitTargets,
      target2025, target2026, target2027, target2028, target2029, target2030, targetAkhir,
      anggaran2025, anggaran2026, anggaran2027, anggaran2028, anggaran2029, anggaran2030, anggaranAkhir,
      requesterRole, requesterBidang,
      sasaranSubkegiatan, definisiOperasional, metodePenghitungan, variabelJumlah, variabelPembilang, variabelPenyebut,
      sasaran, nomenklatur, indicators, masterId
    } = body;

    const finalBidang = Array.isArray(bidangPengampu) ? bidangPengampu : (bidangPengampu ? [bidangPengampu] : []);

    let resolvedBidang = finalBidang;
    if (level !== 'tujuan' && parentId) {
      const parentNode = await Cascading5YearsRepository.findOne({ id: parentId });
      if (parentNode) {
        resolvedBidang = parentNode.bidangPengampu || [];
      }
    }

    if (!level || !text || resolvedBidang.length === 0) {
      const err = new Error('Data cascading 5 tahunan tidak lengkap');
      err.status = 400;
      throw err;
    }

    if (requesterRole === 'admin_bidang') {
      if (level === 'tujuan') {
        const err = new Error('Hanya Administrator Sistem yang dapat mengelola Tujuan Strategis.');
        err.status = 403;
        throw err;
      }
      const hasAccess = resolvedBidang.every(b => requesterBidang === b);
      if (!hasAccess) {
        const err = new Error(`Anda hanya dapat mengelola cascading pengampuan bidang Anda (${requesterBidang})`);
        err.status = 403;
        throw err;
      }
    }

    const itemId = id || `5y_${level.substring(0, 3)}_${Date.now()}`;

    // Validate global uniqueness for subkegiatan masterId
    if (level === 'sasaran_subkegiatan' || level === 'subkegiatan') {
      if (masterId) {
        const existingSubkeg = await Cascading5YearsRepository.findOne({
          masterId: masterId,
          id: { $ne: itemId }
        });
        if (existingSubkeg) {
          const err = new Error('Subkegiatan ini sudah digunakan di bagian lain dan tidak boleh diduplikasi.');
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
      satuan: satuan || '-',
      tipeTarget: tipeTarget || 'Kondisi Akhir Naik',
      parentId: parentId || null,
      bidangPengampu: resolvedBidang,
      crossCuttingType: crossCuttingType || 'shared',
      splitTargets: splitTargets || {},
      target2025: target2025 || '0',
      target2026: target2026 || '0',
      target2027: target2027 || '0',
      target2028: target2028 || '0',
      target2029: target2029 || '0',
      target2030: target2030 || '0',
      targetAkhir: targetAkhir || '0',
      anggaran2025: anggaran2025 || '0',
      anggaran2026: anggaran2026 || '0',
      anggaran2027: anggaran2027 || '0',
      anggaran2028: anggaran2028 || '0',
      anggaran2029: anggaran2029 || '0',
      anggaran2030: anggaran2030 || '0',
      anggaranAkhir: anggaranAkhir || '0',
      sasaranSubkegiatan: sasaranSubkegiatan || '',
      definisiOperasional: definisiOperasional || '',
      metodePenghitungan: metodePenghitungan || 'Jumlah',
      variabelJumlah: variabelJumlah || '',
      variabelPembilang: variabelPembilang || '',
      variabelPenyebut: variabelPenyebut || '',
      sasaran: sasaran || '',
      nomenklatur: nomenklatur || '',
      indicators: indicators || [],
      masterId: masterId || null
    };

    const existingItem = await Cascading5YearsRepository.findOne({ id: itemId });
    const oldBidangStr = existingItem ? JSON.stringify(existingItem.bidangPengampu || []) : null;
    const newBidangStr = JSON.stringify(resolvedBidang);

    const savedItem = await Cascading5YearsRepository.createOrUpdate(itemData);

    // If bidangPengampu changed, propagate to descendants recursively
    if (existingItem && oldBidangStr !== newBidangStr) {
      await this.propagateBidangPengampu(itemId, resolvedBidang);
    }

    return savedItem;
  }
}

export default new Cascading5YearsService();
