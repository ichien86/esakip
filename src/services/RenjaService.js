import dbConnect from '@/lib/db';
import * as xlsx from 'xlsx';
import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import Cascading5Years from '@/models/Cascading5Years'; // TODO: use Cascading5YearsRepository when available
import { resolveTreePICs } from '@/lib/pic-resolver';

class RenjaService {
  async getRenja(yearNum) {
    await dbConnect();
    const annualNodes = await CascadingAnnualRepository.find({ tahun: yearNum });
    const IndicatorAnnual = (await import('@/models/IndicatorAnnual')).default;
    const annualIndicators = await IndicatorAnnual.find({ tahun: yearNum }).sort({ order: 1 });
    const resolvedNodes = resolveTreePICs(annualNodes, annualIndicators);
    
    // Fallback to direct model query if repository is not fully migrated
    const fiveYearNodes = await Cascading5Years.find({});
    const Indicator5Years = (await import('@/models/Indicator5Years')).default;
    const fiveYearIndicators = await Indicator5Years.find({});

    const enrichedData = resolvedNodes.map(node => {
      const fiveYearMatch = fiveYearNodes.find(c5 => {
        if (node.level === 'tujuan' || node.level === 'sasaran') {
          return c5.level === node.level && c5.text === node.text;
        }
        return c5.level === node.level && c5.masterId === node.masterId;
      });

      const nodeObj = node.toObject ? node.toObject() : node;

      // Merge operational definitions from 5-Year Master to Annual Indicators
      if (fiveYearMatch && nodeObj.indicators && Array.isArray(nodeObj.indicators)) {
        nodeObj.indicators = nodeObj.indicators.map(ind => {
          const masterInd = fiveYearIndicators.find(m => m.nodeId === fiveYearMatch.id && m.indikator === ind.indikator);
          if (masterInd) {
            // Jika annual belum punya array variables tapi master punya, ambil dari master
            const needsMasterVars = (!ind.variables || ind.variables.length === 0) && masterInd.variables && masterInd.variables.length > 0;
            return {
              ...ind,
              definisiOperasional: ind.definisiOperasional || masterInd.definisiOperasional || '',
              metodePenghitungan: ind.metodePenghitungan === 'Jumlah' ? masterInd.metodePenghitungan || 'Tunggal' : (ind.metodePenghitungan || masterInd.metodePenghitungan || 'Tunggal'),
              variabelJumlah: ind.variabelJumlah || masterInd.variabelJumlah || '',
              variabelPembilang: ind.variabelPembilang || masterInd.variabelPembilang || '',
              variabelPenyebut: ind.variabelPenyebut || masterInd.variabelPenyebut || '',
              variables: needsMasterVars ? masterInd.variables : (ind.variables || [])
            };
          }
          return ind;
        });
      }

      return {
        ...nodeObj,
        target5Tahun: fiveYearMatch ? fiveYearMatch[`target${yearNum}`] : null,
        targetAkhir5Tahun: fiveYearMatch ? fiveYearMatch.targetAkhir : null,
        anggaran5Tahun: fiveYearMatch ? fiveYearMatch[`anggaran${yearNum}`] : null,
        anggaranAkhir5Tahun: fiveYearMatch ? fiveYearMatch.anggaranAkhir : null
      };
    });
    // Urutkan secara hierarkis (berjenjang) agar tampilan UI selalu terstruktur
    const childrenMap = {};
    const rootNodes = [];
    
    enrichedData.forEach(node => {
      if (!node.parentId) {
        rootNodes.push(node);
      } else {
        if (!childrenMap[node.parentId]) childrenMap[node.parentId] = [];
        childrenMap[node.parentId].push(node);
      }
    });

    const sortedData = [];
    const traverse = (node) => {
      sortedData.push(node);
      if (childrenMap[node.id]) {
        childrenMap[node.id].forEach(child => traverse(child));
      }
    };

    rootNodes.forEach(root => traverse(root));
    
    // Masukkan yatim piatu (orphans) di akhir jika ada relasi parentId yang terputus
    const sortedSet = new Set(sortedData.map(n => n.id));
    enrichedData.forEach(n => {
      if (!sortedSet.has(n.id)) {
        sortedData.push(n);
      }
    });

    return sortedData;
  }

  async importDPA(fileBuffer, yearNum) {
    await dbConnect();
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
    await dbConnect();
    const fiveYearNodes = await Cascading5Years.find({});

    const CascadingAnnual = (await import('@/models/CascadingAnnual')).default;
    const IndicatorAnnual = (await import('@/models/IndicatorAnnual')).default;
    const Indicator5Years = (await import('@/models/Indicator5Years')).default;

    // Load five-year indicators to sync from
    const all5YIndicators = await Indicator5Years.find({});
    const indicatorsByNodeId = {};
    all5YIndicators.forEach(ind => {
      if (!indicatorsByNodeId[ind.nodeId]) {
        indicatorsByNodeId[ind.nodeId] = [];
      }
      indicatorsByNodeId[ind.nodeId].push(ind);
    });

    const existingAnnualNodes = await CascadingAnnual.find({ tahun: yearNum });
    const existingAnnualIndicators = await IndicatorAnnual.find({ tahun: yearNum });
    
    // Create maps for quick lookup
    const existingNodesMap = new Map(existingAnnualNodes.map(n => [n.id, n]));
    const existingIndsMap = new Map(existingAnnualIndicators.map(i => [i.id, i]));
    
    const nodeIdsToKeep = new Set();
    const indIdsToKeep = new Set();

    let updatedCount = 0;

    for (const c5 of fiveYearNodes) {
      const nodeAnnualId = `${c5.id}_${yearNum}`;
      nodeIdsToKeep.add(nodeAnnualId);
      
      const existingNode = existingNodesMap.get(nodeAnnualId);
      if (existingNode) {
        // Update fields but preserve assignments & DPA
        existingNode.level = c5.level;
        existingNode.text = c5.text;
        existingNode.indikator = c5.indikator || '-';
        existingNode.target = c5[`target${yearNum}`] || '0';
        existingNode.satuan = c5.satuan || '-';
        existingNode.tipeTarget = c5.tipeTarget || 'Kondisi Akhir Naik';
        existingNode.parentId = c5.parentId ? `${c5.parentId}_${yearNum}` : null;
        existingNode.bidangPengampu = c5.bidangPengampu || [];
        existingNode.masterId = c5.masterId || null;
        existingNode.anggaran = (c5.level === 'subkegiatan' || c5.level === 'sasaran_subkegiatan') ? (parseFloat(c5[`anggaran${yearNum}`]) || 0) : 0;
        existingNode.sasaran = c5.sasaran || '';
        existingNode.nomenklatur = c5.nomenklatur || '';
        existingNode.sasaranSubkegiatan = c5.sasaranSubkegiatan || '';
        existingNode.definisiOperasional = c5.definisiOperasional || '';
        existingNode.metodePenghitungan = c5.metodePenghitungan || 'Jumlah';
        existingNode.variabelJumlah = c5.variabelJumlah || '';
        existingNode.variabelPembilang = c5.variabelPembilang || '';
        existingNode.variabelPenyebut = c5.variabelPenyebut || '';
        await existingNode.save();
        updatedCount++;
      } else {
        // Insert new
        await CascadingAnnual.create({
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
          indicators: [],
          sasaranSubkegiatan: c5.sasaranSubkegiatan || '',
          definisiOperasional: c5.definisiOperasional || '',
          metodePenghitungan: c5.metodePenghitungan || 'Jumlah',
          variabelJumlah: c5.variabelJumlah || '',
          variabelPembilang: c5.variabelPembilang || '',
          variabelPenyebut: c5.variabelPenyebut || ''
        });
        updatedCount++;
      }

      // Upsert indicators
      const node5YIndicators = indicatorsByNodeId[c5.id] || [];
      for (const ind of node5YIndicators) {
        const annIndId = `${ind.id}_${yearNum}`;
        indIdsToKeep.add(annIndId);
        
        const existingInd = existingIndsMap.get(annIndId);
        if (existingInd) {
          // Update
          existingInd.indikator = ind.indikator;
          existingInd.target = ind[`target${yearNum}`] || '0';
          existingInd.satuan = ind.satuan;
          existingInd.tipeTarget = ind.tipeTarget || 'Kondisi Akhir Naik';
          existingInd.definisiOperasional = ind.definisiOperasional || '';
          existingInd.metodePenghitungan = ind.metodePenghitungan || 'Jumlah';
          existingInd.variabelJumlah = ind.variabelJumlah || '';
          existingInd.variabelPembilang = ind.variabelPembilang || '';
          existingInd.variabelPenyebut = ind.variabelPenyebut || '';
          existingInd.order = ind.order !== undefined ? ind.order : 0;
          await existingInd.save();
        } else {
          // Insert new
          await IndicatorAnnual.create({
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
            variabelPenyebut: ind.variabelPenyebut || '',
            order: ind.order !== undefined ? ind.order : 0
          });
        }
      }
    }

    // Delete removed nodes & indicators
    if (nodeIdsToKeep.size > 0) {
      await CascadingAnnual.deleteMany({ tahun: yearNum, id: { $nin: Array.from(nodeIdsToKeep) } });
    }
    if (indIdsToKeep.size > 0) {
      await IndicatorAnnual.deleteMany({ tahun: yearNum, id: { $nin: Array.from(indIdsToKeep) } });
    }

    return updatedCount;
  }
}

const renjaService = new RenjaService();
export default renjaService;
