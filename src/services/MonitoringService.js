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
    const annualNodes = await CascadingAnnualRepository.findAll();
    const renaksis = await RenaksiRepository.findAll();
    const all5YIndicators = await Indicator5YearsRepository.findAll();
    const allAnnualIndicators = await IndicatorAnnualRepository.findAll();

    const indicators5YByNodeId = {};
    all5YIndicators.forEach(ind => {
      const plainInd = typeof ind.toObject === 'function' ? ind.toObject() : ind;
      if (!indicators5YByNodeId[plainInd.nodeId]) {
        indicators5YByNodeId[plainInd.nodeId] = [];
      }
      indicators5YByNodeId[plainInd.nodeId].push(plainInd);
    });

    const indicatorsAnnualByNodeId = {};
    allAnnualIndicators.forEach(ind => {
      const plainInd = typeof ind.toObject === 'function' ? ind.toObject() : ind;
      if (!indicatorsAnnualByNodeId[plainInd.nodeId]) {
        indicatorsAnnualByNodeId[plainInd.nodeId] = [];
      }
      indicatorsAnnualByNodeId[plainInd.nodeId].push(plainInd);
    });

    const enrichedAnnualNodes = annualNodes.map(node => {
      const plainNode = typeof node.toObject === 'function' ? node.toObject() : node;
      return {
        ...plainNode,
        indicators: indicatorsAnnualByNodeId[plainNode.id] || []
      };
    });

    const monitoringData = [];

    for (const item of items) {
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

          // Find matching annual nodes that share indicators and fields (bidang)
          const matchingAnnualNodes = enrichedAnnualNodes.filter(c => {
            const sharesBidang = c.bidangPengampu.some(b => plainItem.bidangPengampu.includes(b));
            if (!sharesBidang) return false;

            let cIndicators = c.indicators || [];
            if (cIndicators.length === 0 && c.indikator && c.indikator !== '-') {
              cIndicators = [{
                indikator: c.indikator
              }];
            }
            return cIndicators.some(ind => ind.indikator === indicator.indikator);
          });
          const matchingIds = matchingAnnualNodes.map(n => n.id);

          // Filter monthly achievements for those indicators in the given year
          const yearRenaksi = renaksis.filter(r =>
            r.tahun === year &&
            matchingIds.includes(r.indicatorId) &&
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
        if (targetAkhir > 0) {
          if (indicator.tipeTarget === 'Kondisi Akhir Menurun') {
            if (totalRealisasi === 0) progres = 0;
            else if (totalRealisasi <= targetAkhir) progres = 100;
            else progres = Math.min(100, (targetAkhir / totalRealisasi) * 100);
          } else {
            progres = Math.min(100, (totalRealisasi / targetAkhir) * 100);
          }
        }

        // if the model is a mongoose document, toObject() will exist.
        // Otherwise, it's just an object or plain object.
        const baseItem = plainItem;

        monitoringData.push({
          ...baseItem,
          id: `${item.id}_${indicator.id || Math.random().toString(36).substr(2, 9)}`,
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

export default new MonitoringService();
