import * as xlsx from 'xlsx';
import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import Cascading5Years from '@/models/Cascading5Years'; // TODO: use Cascading5YearsRepository when available
import { resolveTreePICs } from '@/lib/pic-resolver';

class RenjaService {
  async getRenja(yearNum) {
    const annualNodes = await CascadingAnnualRepository.find({ tahun: yearNum });
    const IndicatorAnnual = (await import('@/models/IndicatorAnnual')).default;
    const annualIndicators = await IndicatorAnnual.find({ tahun: yearNum });
    const resolvedNodes = resolveTreePICs(annualNodes, annualIndicators);
    
    // Fallback to direct model query if repository is not fully migrated
    const fiveYearNodes = await Cascading5Years.find({});

    const enrichedData = resolvedNodes.map(node => {
      const fiveYearMatch = fiveYearNodes.find(c5 => {
        if (node.level === 'tujuan' || node.level === 'sasaran') {
          return c5.level === node.level && c5.text === node.text;
        }
        return c5.level === node.level && c5.masterId === node.masterId;
      });

      return {
        ...node.toObject ? node.toObject() : node,
        target5Tahun: fiveYearMatch ? fiveYearMatch[`target${yearNum}`] : null,
        targetAkhir5Tahun: fiveYearMatch ? fiveYearMatch.targetAkhir : null,
        anggaran5Tahun: fiveYearMatch ? fiveYearMatch[`anggaran${yearNum}`] : null,
        anggaranAkhir5Tahun: fiveYearMatch ? fiveYearMatch.anggaranAkhir : null
      };
    });

    return enrichedData;
  }

  async importDPA(fileBuffer, yearNum) {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      const err = new Error('File Excel kosong atau tidak terbaca.');
      err.status = 400;
      throw err;
    }

    // Find keys in the first row
    const firstRow = rows[0];
    let subkegiatanKey = '';
    let anggaranKey = '';

    Object.keys(firstRow).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('subkegiatan') || lowerKey.includes('sub kegiatan') || lowerKey.includes('nomenklatur')) {
        subkegiatanKey = key;
      }
      if (lowerKey.includes('dpa') || lowerKey.includes('anggaran dpa') || (lowerKey.includes('anggaran') && !lowerKey.includes('renja'))) {
        anggaranKey = key;
      }
    });

    if (!subkegiatanKey) {
      subkegiatanKey = Object.keys(firstRow).find(key => key.toLowerCase().includes('sub')) || Object.keys(firstRow)[0];
    }
    if (!anggaranKey) {
      anggaranKey = Object.keys(firstRow).find(key => key.toLowerCase().includes('anggaran') || key.toLowerCase().includes('dpa') || key.toLowerCase().includes('jumlah')) || Object.keys(firstRow)[1];
    }

    if (!subkegiatanKey || !anggaranKey) {
      const err = new Error('Kolom Subkegiatan atau Anggaran DPA tidak terdeteksi.');
      err.status = 400;
      throw err;
    }

    let updatedCount = 0;
    const allAnnualSubkegs = await CascadingAnnualRepository.find({ 
      level: { $in: ['sasaran_subkegiatan', 'subkegiatan'] },
      tahun: yearNum 
    });

    for (const row of rows) {
      const subkegName = row[subkegiatanKey] ? String(row[subkegiatanKey]).trim() : '';
      const rawBudget = row[anggaranKey];
      
      let budgetVal = 0;
      if (typeof rawBudget === 'number') {
        budgetVal = rawBudget;
      } else if (typeof rawBudget === 'string') {
        budgetVal = parseFloat(rawBudget.replace(/[^0-9\.-]/g, '')) || 0;
      }

      if (!subkegName || isNaN(budgetVal) || budgetVal <= 0) continue;

      const cleanSearchName = subkegName.replace(/^[\d\.\s]+/, '').toLowerCase();

      for (const node of allAnnualSubkegs) {
        const cleanNodeNomenklatur = (node.nomenklatur || '').replace(/^[\d\.\s]+/, '').toLowerCase();
        const cleanNodeText = (node.text || '').replace(/^[\d\.\s]+/, '').toLowerCase();

        const isMatch = (cleanNodeNomenklatur && (cleanNodeNomenklatur === cleanSearchName || cleanNodeNomenklatur.includes(cleanSearchName) || cleanSearchName.includes(cleanNodeNomenklatur))) ||
                        (cleanNodeText && (cleanNodeText === cleanSearchName || cleanNodeText.includes(cleanSearchName) || cleanSearchName.includes(cleanNodeText)));

        if (isMatch) {
          node.anggaranDpa = budgetVal;
          await node.save(); // since find returns Mongoose documents
          updatedCount++;
        }
      }
    }

    return updatedCount;
  }

  async sync(yearNum) {
    const fiveYearNodes = await Cascading5Years.find({});

    // Delete existing nodes & indicators for this year
    const CascadingAnnual = (await import('@/models/CascadingAnnual')).default;
    const IndicatorAnnual = (await import('@/models/IndicatorAnnual')).default;
    const Indicator5Years = (await import('@/models/Indicator5Years')).default;
    await CascadingAnnual.deleteMany({ tahun: yearNum });
    await IndicatorAnnual.deleteMany({ tahun: yearNum });

    // Load five-year indicators to sync from
    const all5YIndicators = await Indicator5Years.find({});
    const indicatorsByNodeId = {};
    all5YIndicators.forEach(ind => {
      if (!indicatorsByNodeId[ind.nodeId]) {
        indicatorsByNodeId[ind.nodeId] = [];
      }
      indicatorsByNodeId[ind.nodeId].push(ind);
    });

    const cAnnualToInsert = [];
    const indicatorsToInsert = [];

    // Map and clone
    for (const c5 of fiveYearNodes) {
      const nodeAnnualId = `${c5.id}_${yearNum}`;
      
      const node5YIndicators = indicatorsByNodeId[c5.id] || [];
      node5YIndicators.forEach(ind => {
        const annIndId = `${ind.id}_${yearNum}`;
        indicatorsToInsert.push({
          id: annIndId,
          nodeId: nodeAnnualId,
          tahun: yearNum,
          indikator: ind.indikator,
          target: ind[`target${yearNum}`] || '0',
          satuan: ind.satuan,
          tipeTarget: ind.tipeTarget || 'Kondisi Akhir Naik',
          penanggungJawab: null,
          definisiOperasional: ind.definisiOperasional || '',
          metodePenghitungan: ind.metodePenghitungan || 'Jumlah',
          variabelJumlah: ind.variabelJumlah || '',
          variabelPembilang: ind.variabelPembilang || '',
          variabelPenyebut: ind.variabelPenyebut || ''
        });
      });

      cAnnualToInsert.push({
        id: nodeAnnualId,
        level: c5.level,
        text: c5.text,
        indikator: c5.indikator || '-',
        target: c5[`target${yearNum}`] || '0',
        satuan: c5.satuan || '-',
        tipeTarget: c5.tipeTarget || 'Kondisi Akhir Naik',
        parentId: c5.parentId ? `${c5.parentId}_${yearNum}` : null,
        bidangPengampu: c5.bidangPengampu || [],
        crossCuttingType: c5.crossCuttingType === 'shared' ? 'bersama' : (c5.crossCuttingType === 'split' ? 'digabung' : (c5.crossCuttingType || 'bersama')),
        selectedBidang: c5.crossCuttingType === 'split' ? null : (c5.selectedBidang || null),
        splitTargets: c5.splitTargets || {},
        tahun: yearNum,
        masterId: c5.masterId || null,
        anggaran: (c5.level === 'subkegiatan' || c5.level === 'sasaran_subkegiatan') ? (parseFloat(c5[`anggaran${yearNum}`]) || 0) : 0,
        anggaranDpa: 0,
        sasaran: c5.sasaran || '',
        nomenklatur: c5.nomenklatur || '',
        indicators: [], // Keep empty in db
        sasaranSubkegiatan: c5.sasaranSubkegiatan || '',
        definisiOperasional: c5.definisiOperasional || '',
        metodePenghitungan: c5.metodePenghitungan || 'Jumlah',
        variabelJumlah: c5.variabelJumlah || '',
        variabelPembilang: c5.variabelPembilang || '',
        variabelPenyebut: c5.variabelPenyebut || ''
      });
    }

    if (cAnnualToInsert.length > 0) {
      await CascadingAnnual.insertMany(cAnnualToInsert);
    }
    if (indicatorsToInsert.length > 0) {
      await IndicatorAnnual.insertMany(indicatorsToInsert);
    }

    return cAnnualToInsert.length;
  }
}

export default new RenjaService();
