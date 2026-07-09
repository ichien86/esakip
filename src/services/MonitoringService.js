import Cascading5YearsRepository from '@/repositories/Cascading5YearsRepository';
import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import RenaksiRepository from '@/repositories/RenaksiRepository';
import Indicator5YearsRepository from '@/repositories/Indicator5YearsRepository';
import IndicatorAnnualRepository from '@/repositories/IndicatorAnnualRepository';

class MonitoringService {
  /**
   * Mengambil dan mengkalkulasi data monitoring 5 tahun.
   * @returns {Promise<Array>} Array of monitoring data objects.
   */
  async getMonitoring5YearsData() {
    const items = await Cascading5YearsRepository.findAll();
    const renaksis = await RenaksiRepository.findAll();
    const all5YIndicators = await Indicator5YearsRepository.findAll();

    const indicators5YByNodeId = {};
    all5YIndicators.forEach(ind => {
      const plainInd = typeof ind.toObject === 'function' ? ind.toObject() : ind;
      if (!indicators5YByNodeId[plainInd.nodeId]) {
        indicators5YByNodeId[plainInd.nodeId] = [];
      }
      indicators5YByNodeId[plainInd.nodeId].push(plainInd);
    });

    // 1. Sort nodes hierarchically (Tree Building)
    const buildTree = (parentId = null) => {
      const levelNodes = items.filter(n => {
        const pId = typeof n.toObject === 'function' ? n.toObject().parentId : n.parentId;
        return pId === parentId;
      });
      let result = [];
      for (const node of levelNodes) {
        result.push(node);
        const childNodes = buildTree(typeof node.toObject === 'function' ? node.toObject().id : node.id);
        result = result.concat(childNodes);
      }
      return result;
    };

    const orderedItems = buildTree(null);
    const orderedIds = new Set(orderedItems.map(n => typeof n.toObject === 'function' ? n.toObject().id : n.id));
    const orphans = items.filter(n => !orderedIds.has(typeof n.toObject === 'function' ? n.toObject().id : n.id));
    const finalItems = [...orderedItems, ...orphans];

    const monitoringData = [];

    for (const item of finalItems) {
      const plainItem = typeof item.toObject === 'function' ? item.toObject() : item;
      let indicators = indicators5YByNodeId[plainItem.id] || [];
      if (indicators.length === 0 && plainItem.indikator && plainItem.indikator !== '-') {
        indicators = [{
          id: `ind_mig_${plainItem.id}`,
          indikator: plainItem.indikator,
          satuan: plainItem.satuan || '-',
          tipeTarget: plainItem.tipeTarget || 'Kondisi Akhir Naik',
          target2025: plainItem.target2025 || '0',
          target2026: plainItem.target2026 || '0',
          target2027: plainItem.target2027 || '0',
          target2028: plainItem.target2028 || '0',
          target2029: plainItem.target2029 || '0',
          target2030: plainItem.target2030 || '0',
          targetAkhir: plainItem.targetAkhir || '0'
        }];
      }

      for (const indicator of indicators) {
        const targetAkhir = parseFloat(indicator.targetAkhir) || 0;
        let totalRealisasi = 0;
        const yearlyData = {};

        for (let year = 2025; year <= 2030; year++) {
          const yearTarget = parseFloat(indicator[`target${year}`]) || 0;

          // Annual Indicator ID is exactly derived from 5-Year Indicator ID in RenjaService sync
          const annualIndicatorId = `${indicator.id}_${year}`;

          // Filter monthly achievements for this exact indicator in the given year
          const yearRenaksi = renaksis.filter(r =>
            r.tahun === year &&
            r.indicatorId === annualIndicatorId &&
            r.realisasiBulanan !== null &&
            r.isCrossCuttingSelected !== false
          );

          let yearRealisasi = 0;
          if (indicator.tipeTarget === 'Akumulatif') {
            yearRealisasi = yearRenaksi.reduce((sum, r) => sum + (parseFloat(r.realisasiBulanan) || 0), 0);
          } else {
            // Kondisi Akhir: take the latest non-null realization of that year
            const sorted = [...yearRenaksi].sort((a, b) => b.bulan - a.bulan);
            yearRealisasi = sorted.length > 0 ? (parseFloat(sorted[0].realisasiBulanan) || 0) : 0;
          }

          totalRealisasi += yearRealisasi;
          yearlyData[year] = { target: yearTarget, realisasi: yearRealisasi };
        }

        let progres = 0;
        if (targetAkhir === 0) {
          // Zero-target indicator: if realisasi also 0, that's perfect (100%)
          progres = totalRealisasi === 0 ? 100 : 0;
        } else if (indicator.tipeTarget === 'Kondisi Akhir Menurun') {
          if (totalRealisasi === 0) {
            // Realisasi 0 is a perfect score for a decreasing target
            progres = 100;
          } else if (totalRealisasi <= targetAkhir) {
            progres = 100;
          } else {
            // Exceeded the limit — proportionally lower score, no cap
            progres = (targetAkhir / totalRealisasi) * 100;
          }
        } else {
          // Normal / Akumulatif — no upper cap
          progres = targetAkhir > 0 ? (totalRealisasi / targetAkhir) * 100 : 0;
        }

        monitoringData.push({
          ...plainItem,
          id: `${plainItem.id}_${indicator.id || Math.random().toString(36).substr(2, 9)}`,
          indikator: indicator.indikator,
          satuan: indicator.satuan,
          tipeTarget: indicator.tipeTarget,
          targetAkhir,
          totalRealisasi: Math.round(totalRealisasi * 100) / 100,
          progres: Math.round(progres * 100) / 100,
          yearlyData
        });
      }
    }

    return monitoringData;
  }
}

const monitoringService = new MonitoringService();
export default monitoringService;
