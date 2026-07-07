import Cascading5YearsRepository from '@/repositories/Cascading5YearsRepository';
import Indicator5YearsRepository from '@/repositories/Indicator5YearsRepository';

class Cascading5YearsService {
  /**
   * Mengambil dan memformat data Cascading 5 Years.
   */
  async getCascading5YearsData() {
    const data = await Cascading5YearsRepository.findAll();
    const allIndicators = await Indicator5YearsRepository.findAll();

    // Self-repair parent bidangPengampu inconsistencies (bottom-up cleanup level-by-level)
    const levelGroups = [
      ['sasaran_subkegiatan', 'subkegiatan'],
      ['sasaran_kegiatan', 'kegiatan'],
      ['sasaran_program', 'program']
    ];

    for (const levels of levelGroups) {
      const parents = data.filter(p => levels.includes(p.level));
      for (const parent of parents) {
        const children = data.filter(c => c.parentId === parent.id);
        const isSubkegiatan = ['sasaran_subkegiatan', 'subkegiatan'].includes(parent.level);
        
        if (children.length === 0) {
          if (!isSubkegiatan && parent.bidangPengampu && parent.bidangPengampu.length > 0) {
            parent.bidangPengampu = [];
            await Cascading5YearsRepository.saveDocument(parent);
          }
        } else {
          const aggregated = new Set();
          children.forEach(c => {
            if (Array.isArray(c.bidangPengampu)) {
              c.bidangPengampu.forEach(b => aggregated.add(b));
            }
          });
          const newBidangs = Array.from(aggregated);
          if (JSON.stringify(parent.bidangPengampu || []) !== JSON.stringify(newBidangs)) {
            parent.bidangPengampu = newBidangs;
            await Cascading5YearsRepository.saveDocument(parent);
          }
        }
      }
    }

    const indicatorsByNodeId = {};
    allIndicators.forEach(ind => {
      const plainInd = typeof ind.toObject === 'function' ? ind.toObject() : ind;
      if (!indicatorsByNodeId[plainInd.nodeId]) {
        indicatorsByNodeId[plainInd.nodeId] = [];
      }
      indicatorsByNodeId[plainInd.nodeId].push(plainInd);
    });
    
    const mapped = data.map(node => {
      let lvl = node.level;
      if (lvl === 'program') lvl = 'sasaran_program';
      else if (lvl === 'kegiatan') lvl = 'sasaran_kegiatan';
      else if (lvl === 'subkegiatan') lvl = 'sasaran_subkegiatan';
      else if (lvl === 'aktivitas') lvl = 'sasaran_aktivitas';

      const plainNode = typeof node.toObject === 'function' ? node.toObject() : node;
      let indicators = indicatorsByNodeId[plainNode.id] || [];
      
      if (indicators.length === 0 && node.indikator && node.indikator !== '-' && node.indikator !== 'Indikator Terpisah') {
        indicators = [{
          id: `ind_mig_${node.id}`,
          nodeId: node.id,
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
          outputVariableAlias: node.outputVariableAlias || '',
          metodePenghitungan: node.metodePenghitungan || 'Jumlah',
          variabelJumlah: node.variabelJumlah || '',
          variabelPembilang: node.variabelPembilang || '',
          variabelPenyebut: node.variabelPenyebut || ''
        }];
      }

      let cType = plainNode.crossCuttingType || 'bersama';
      if (cType === 'shared') cType = 'bersama';
      if (cType === 'split') cType = 'digabung';

      const sortedIndicators = [...indicators].sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 0;
        const orderB = b.order !== undefined ? b.order : 0;
        if (orderA !== orderB) return orderA - orderB;
        if (a.indikator === 'Indikator Terpisah' || a.indikator === '-') return 1;
        if (b.indikator === 'Indikator Terpisah' || b.indikator === '-') return -1;
        return 0;
      });

      return {
        ...plainNode,
        crossCuttingType: cType,
        level: lvl,
        indicators: sortedIndicators,
        sasaran: plainNode.sasaran || plainNode.sasaranSubkegiatan || '',
        nomenklatur: plainNode.nomenklatur || ''
      };
    });

    return mapped;
  }

  /**
   * Fungsi rekursif untuk menyebarkan perubahan Bidang Pengampu ke induknya (Bottom-Up).
   */
  async propagateBidangUpwards(parentId) {
    if (!parentId) return;
    
    const parentNode = await Cascading5YearsRepository.findOne({ id: parentId });
    if (!parentNode) return;

    // Merangkum untuk Program, Kegiatan, dan Subkegiatan
    if (['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan', 'program', 'kegiatan', 'subkegiatan'].includes(parentNode.level)) {
      const children = await Cascading5YearsRepository.find({ parentId: parentId });
      
      // Khusus Subkegiatan: Jika tidak punya anak (Aktivitas), biarkan bertindak sebagai leaf. Jangan timpa nilainya dengan kosong.
      if (children.length === 0 && ['sasaran_subkegiatan', 'subkegiatan'].includes(parentNode.level)) {
        return;
      }

      const aggregatedBidang = new Set();
      children.forEach(child => {
        if (Array.isArray(child.bidangPengampu)) {
          child.bidangPengampu.forEach(b => aggregatedBidang.add(b));
        }
      });
      
      const newBidangs = Array.from(aggregatedBidang);
      const oldBidangStr = JSON.stringify(parentNode.bidangPengampu || []);
      const newBidangStr = JSON.stringify(newBidangs);

      if (oldBidangStr !== newBidangStr) {
        parentNode.bidangPengampu = newBidangs;
        await Cascading5YearsRepository.saveDocument(parentNode);
        
        // Teruskan ke atas jika punya induk lagi
        if (parentNode.parentId) {
          await this.propagateBidangUpwards(parentNode.parentId);
        }
      }
    }
  }

  /**
   * Menyimpan data Cascading 5 Years baru atau memperbarui yang ada.
   */
  async saveCascading5YearsData(body) {
    const {
      id, level, text, indikator, satuan, tipeTarget, parentId, bidangPengampu,
      crossCuttingType, selectedBidang, splitTargets,
      target2025, target2026, target2027, target2028, target2029, target2030, targetAkhir,
      anggaran2025, anggaran2026, anggaran2027, anggaran2028, anggaran2029, anggaran2030, anggaranAkhir,
      requesterRole, requesterBidang,
      masterId, sasaranSubkegiatan, definisiOperasional, outputVariableAlias, metodePenghitungan, variabelJumlah, variabelPembilang, variabelPenyebut, variables,
      sasaran, nomenklatur, indicators
    } = body;

    const finalBidang = Array.isArray(bidangPengampu) ? bidangPengampu : (bidangPengampu ? [bidangPengampu] : []);

    let resolvedBidang = finalBidang;
    
    // Validasi kelengkapan data
    if (!level || !text) {
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

    let resolvedCrossCuttingType = crossCuttingType || 'bersama';
    if (resolvedCrossCuttingType === 'shared') resolvedCrossCuttingType = 'bersama';
    if (resolvedCrossCuttingType === 'split') resolvedCrossCuttingType = 'digabung';

    let resolvedSelectedBidang = selectedBidang || null;
    if (resolvedCrossCuttingType === 'digabung') {
      resolvedSelectedBidang = null;
    }

    const itemData = {
      id: itemId,
      level,
      text,
      indikator: 'Indikator Terpisah', // placeholder for schema field if required, or keep '-'
      satuan: satuan || '-',
      tipeTarget: tipeTarget || 'Kondisi Akhir Naik',
      parentId: parentId || null,
      bidangPengampu: resolvedBidang,
      crossCuttingType: resolvedCrossCuttingType,
      selectedBidang: resolvedSelectedBidang,
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
      outputVariableAlias: outputVariableAlias || '',
      metodePenghitungan: metodePenghitungan || 'Jumlah',
      variabelJumlah: variabelJumlah || '',
      variabelPembilang: variabelPembilang || '',
      variabelPenyebut: variabelPenyebut || '',
      sasaran: sasaran || '',
      nomenklatur: nomenklatur || '',
      indicators: [], // Empty indicator array in main document
      masterId: masterId || null
    };

    const savedItem = await Cascading5YearsRepository.createOrUpdate(itemData);

    // Save indicators to separate collection
    if (Array.isArray(indicators)) {
      const existingInds = await Indicator5YearsRepository.find({ nodeId: itemId });
      const existingIds = existingInds.map(ind => ind.id);
      const incomingIds = indicators.filter(ind => ind.id).map(ind => ind.id);
      const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));
      
      if (idsToDelete.length > 0) {
        await Indicator5YearsRepository.deleteMany({ id: { $in: idsToDelete } });
      }

      let orderIndex = 0;
      for (const ind of indicators) {
        const indId = ind.id || `ind_5y_${itemId}_${Math.random().toString(36).substring(2, 7)}`;
        await Indicator5YearsRepository.createOrUpdate({
          id: indId,
          nodeId: itemId,
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
          outputVariableAlias: ind.outputVariableAlias || '',
          metodePenghitungan: ind.metodePenghitungan || 'Tunggal',
          variabelJumlah: ind.variabelJumlah || '',
          variabelPembilang: ind.variabelPembilang || '',
          variabelPenyebut: ind.variabelPenyebut || '',
          variables: Array.isArray(ind.variables) ? ind.variables : [],
          order: ind.order !== undefined ? ind.order : orderIndex
        });
        orderIndex++;
      }
    }

    // Bottom-Up Propagation: Jika ini adalah child, trigger induknya untuk agregasi ulang
    if (parentId) {
      await this.propagateBidangUpwards(parentId);
    }

    const updatedIndicators = await Indicator5YearsRepository.find({ nodeId: itemId });
    const plainItem = typeof savedItem.toObject === 'function' ? savedItem.toObject() : savedItem;

    const sortedIndicators = updatedIndicators
      .map(ind => typeof ind.toObject === 'function' ? ind.toObject() : ind)
      .sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 0;
        const orderB = b.order !== undefined ? b.order : 0;
        if (orderA !== orderB) return orderA - orderB;
        if (a.indikator === 'Indikator Terpisah' || a.indikator === '-') return 1;
        if (b.indikator === 'Indikator Terpisah' || b.indikator === '-') return -1;
        return 0;
      });

    return {
      ...plainItem,
      indicators: sortedIndicators
    };
  }
}

export default new Cascading5YearsService();
