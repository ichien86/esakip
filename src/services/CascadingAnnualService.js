import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import Cascading5YearsRepository from '@/repositories/Cascading5YearsRepository';
import IndicatorAnnualRepository from '@/repositories/IndicatorAnnualRepository';
import Indicator5YearsRepository from '@/repositories/Indicator5YearsRepository';
import { resolveTreePICs } from '@/lib/pic-resolver';

class CascadingAnnualService {
  /**
   * Mengambil dan memformat data Cascading Annual.
   */
  async getCascadingAnnualData() {
    const data = await CascadingAnnualRepository.findAll();
    const allIndicators = await IndicatorAnnualRepository.findAll();
    const resolvedData = resolveTreePICs(data, allIndicators);
    
    const indicatorsByNodeId = {};
    allIndicators.forEach(ind => {
      const plainInd = typeof ind.toObject === 'function' ? ind.toObject() : ind;
      if (!indicatorsByNodeId[plainInd.nodeId]) {
        indicatorsByNodeId[plainInd.nodeId] = [];
      }
      indicatorsByNodeId[plainInd.nodeId].push(plainInd);
    });

    const mapped = resolvedData.map(node => {
      let lvl = node.level;
      if (lvl === 'program') lvl = 'sasaran_program';
      else if (lvl === 'kegiatan') lvl = 'sasaran_kegiatan';
      else if (lvl === 'subkegiatan') lvl = 'sasaran_subkegiatan';
      else if (lvl === 'aktivitas') lvl = 'sasaran_aktivitas';
      if (lvl === 'indikator_tujuan' || lvl === 'indikator_sasaran') return null;

      const plainNode = typeof node.toObject === 'function' ? node.toObject() : node;
      let indicators = indicatorsByNodeId[plainNode.id] || [];
      if (indicators.length === 0 && node.indikator && node.indikator !== '-') {
        indicators = [{
          id: `ind_mig_${node.id}`,
          nodeId: node.id,
          tahun: node.tahun || 2026,
          indikator: node.indikator,
          satuan: node.satuan || '-',
          tipeTarget: node.tipeTarget || 'Kondisi Akhir Naik',
          target: node.target || '0',
          penanggungJawab: node.penanggungJawab || null,
          definisiOperasional: node.definisiOperasional || '',
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
        nomenklatur: plainNode.nomenklatur || (['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan'].includes(lvl) ? plainNode.text : '')
      };
    }).filter(Boolean);

    return mapped;
  }

  /**
   * Fungsi rekursif untuk menyebarkan perubahan Bidang Pengampu ke induknya (Bottom-Up).
   */
  async propagateBidangUpwards(parentId) {
    if (!parentId) return;
    
    const parentNode = await CascadingAnnualRepository.findOne({ id: parentId });
    if (!parentNode) return;

    // Merangkum untuk Program, Kegiatan, dan Subkegiatan
    if (['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan', 'program', 'kegiatan', 'subkegiatan'].includes(parentNode.level)) {
      const children = await CascadingAnnualRepository.find({ parentId: parentId });
      
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
        await CascadingAnnualRepository.saveDocument(parentNode);
        
        // Teruskan ke atas jika punya induk lagi
        if (parentNode.parentId) {
          await this.propagateBidangUpwards(parentNode.parentId);
        }
      }
    }
  }

  /**
   * Menyimpan data Cascading Annual baru atau memperbarui yang ada.
   */
  async saveCascadingAnnualData(body) {
    const {
      id, level, text, indikator, target, satuan, tipeTarget, parentId, bidangPengampu,
      crossCuttingType, selectedBidang, splitTargets, tahun,
      requesterRole, requesterBidang,
      sasaranSubkegiatan, definisiOperasional, metodePenghitungan, variabelJumlah, variabelPembilang, variabelPenyebut,
      masterId, anggaran, anggaranDpa, sasaran, nomenklatur, indicators
    } = body;

    const finalBidang = Array.isArray(bidangPengampu) ? bidangPengampu : (bidangPengampu ? [bidangPengampu] : []);

    if (!level || !text) {
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
      indikator: 'Indikator Terpisah',
      target: target || '0',
      satuan: satuan || '-',
      tipeTarget: tipeTarget || 'Kondisi Akhir Naik',
      parentId: parentId || null,
      bidangPengampu: finalBidang,
      crossCuttingType: resolvedCrossCuttingType,
      selectedBidang: resolvedSelectedBidang,
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
      indicators: [] // Empty indicators in main document
    };

    const savedItem = await CascadingAnnualRepository.createOrUpdate(itemData);

    const yearNum = tahun || 2026;

    // Save annual indicators to separate collection
    if (Array.isArray(indicators)) {
      const existingInds = await IndicatorAnnualRepository.find({ nodeId: itemId });
      const existingIds = existingInds.map(ind => ind.id);
      const incomingIds = indicators.filter(ind => ind.id).map(ind => ind.id);
      const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));
      
      if (idsToDelete.length > 0) {
        await IndicatorAnnualRepository.deleteMany({ id: { $in: idsToDelete } });
      }

      let orderIndex = 0;
      for (const ind of indicators) {
        const indId = ind.id || `ind_ann_${itemId}_${Math.random().toString(36).substring(2, 7)}`;
        await IndicatorAnnualRepository.createOrUpdate({
          id: indId,
          nodeId: itemId,
          tahun: yearNum,
          indikator: ind.indikator,
          target: ind.target || '0',
          satuan: ind.satuan || '-',
          tipeTarget: ind.tipeTarget || 'Kondisi Akhir Naik',
          penanggungJawab: ind.penanggungJawab || null,
          definisiOperasional: ind.definisiOperasional || '',
          metodePenghitungan: ind.metodePenghitungan || 'Jumlah',
          variabelJumlah: ind.variabelJumlah || '',
          variabelPembilang: ind.variabelPembilang || '',
          variabelPenyebut: ind.variabelPenyebut || '',
          order: ind.order !== undefined ? ind.order : orderIndex
        });
        orderIndex++;
      }
    }

    // Sync back to Cascading5Years target & budget for the corresponding year
    try {
      const fiveYearMatch = await Cascading5YearsRepository.findOne({
        $or: [
          { level: level, text: text },
          { level: level, masterId: masterId }
        ]
      });

      if (fiveYearMatch) {
        // Sync indicator targets inside the Indicator5Years collection
        if (Array.isArray(indicators)) {
          const fiveYearInds = await Indicator5YearsRepository.find({ nodeId: fiveYearMatch.id });
          for (const ind of indicators) {
            const matchInd5 = fiveYearInds.find(i5 => i5.indikator === ind.indikator);
            if (matchInd5) {
              matchInd5[`target${yearNum}`] = ind.target;
              await Indicator5YearsRepository.saveDocument(matchInd5);
            }
          }
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

    // Bottom-Up Propagation: Jika ini adalah child, trigger induknya untuk agregasi ulang
    if (parentId) {
      await this.propagateBidangUpwards(parentId);
    }

    const updatedIndicators = await IndicatorAnnualRepository.find({ nodeId: itemId });
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

export default new CascadingAnnualService();
