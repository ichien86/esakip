import Cascading5YearsRepository from '@/repositories/Cascading5YearsRepository';
import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import RenaksiRepository from '@/repositories/RenaksiRepository';

class MonitoringService {
  /**
   * Mengambil dan mengkalkulasi data monitoring 5 tahun.
   * @returns {Promise<Array>} Array of monitoring data objects.
   */
  async getMonitoring5YearsData() {
    const items = await Cascading5YearsRepository.findAll();
    const annualNodes = await CascadingAnnualRepository.findAll();
    const renaksis = await RenaksiRepository.findAll();

    const monitoringData = [];

    for (const item of items) {
      let indicators = item.indicators || [];
      if (indicators.length === 0 && item.indikator && item.indikator !== '-') {
        indicators = [{
          id: `ind_mig_${item.id}`,
          indikator: item.indikator,
          satuan: item.satuan || '-',
          tipeTarget: item.tipeTarget || 'Kondisi Akhir Naik',
          target2025: item.target2025 || '0',
          target2026: item.target2026 || '0',
          target2027: item.target2027 || '0',
          target2028: item.target2028 || '0',
          target2029: item.target2029 || '0',
          target2030: item.target2030 || '0',
          targetAkhir: item.targetAkhir || '0'
        }];
      }

      for (const indicator of indicators) {
        const targetAkhir = parseFloat(indicator.targetAkhir) || 0;
        let totalRealisasi = 0;
        const yearlyData = {};

        for (let year = 2025; year <= 2030; year++) {
          const yearTarget = parseFloat(indicator[`target${year}`]) || 0;

          // Find matching annual nodes that share indicators and fields (bidang)
          const matchingAnnualNodes = annualNodes.filter(c => {
            const sharesBidang = c.bidangPengampu.some(b => item.bidangPengampu.includes(b));
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
        const baseItem = typeof item.toObject === 'function' ? item.toObject() : item;

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
