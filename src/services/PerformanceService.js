import PerformanceRepository from '@/repositories/PerformanceRepository';

class PerformanceService {
  async getPerformance(employeeId, yearNum) {
    let perf = await PerformanceRepository.findOne({ employeeId, tahun: yearNum });
    if (!perf) {
      perf = {
        id: `perf_${employeeId}_${yearNum}`,
        employeeId,
        tahun: yearNum,
        status: 'Draft',
        targetIKU: [],
        evaluasiAtasan: {
          evaluatorId: null,
          skorAKIP: null,
          predikat: null,
          catatan: '',
          tanggalEvaluasi: null
        }
      };
    }
    return perf;
  }

  async updatePerformance({ employeeId, tahun, targetIKU, status }) {
    const yearNum = parseInt(tahun);
    const recordId = `perf_${employeeId}_${yearNum}`;
    let perf = await PerformanceRepository.findOne({ id: recordId });

    if (perf) {
      if (targetIKU !== undefined) perf.targetIKU = targetIKU;
      if (status !== undefined) perf.status = status;
      await PerformanceRepository.saveDocument(perf);
    } else {
      // In a more robust architecture, we would have a .create in the Repository
      const Performance = (await import('@/models/Performance')).default;
      perf = new Performance({
        id: recordId,
        employeeId,
        tahun: yearNum,
        status: status || 'Draft',
        targetIKU: targetIKU || [],
        evaluasiAtasan: {
          evaluatorId: null,
          skorAKIP: null,
          predikat: null,
          catatan: '',
          tanggalEvaluasi: null
        }
      });
      await PerformanceRepository.saveDocument(perf);
    }

    return perf;
  }

  async evaluatePerformance({ employeeId, tahun, evaluatorId, skorAKIP, catatan }) {
    const yearNum = parseInt(tahun);
    const recordId = `perf_${employeeId}_${yearNum}`;
    let perf = await PerformanceRepository.findOne({ id: recordId });

    if (!perf) {
      const err = new Error('Data capaian kinerja pegawai belum ditemukan');
      err.status = 404;
      throw err;
    }

    let predikat = 'D';
    const score = parseFloat(skorAKIP);
    if (score >= 90) predikat = 'AA';
    else if (score >= 80) predikat = 'A';
    else if (score >= 70) predikat = 'BB';
    else if (score >= 60) predikat = 'B';
    else if (score >= 50) predikat = 'CC';
    else if (score >= 30) predikat = 'C';

    perf.status = 'Selesai';
    perf.evaluasiAtasan = {
      evaluatorId,
      skorAKIP: score,
      predikat,
      catatan: catatan || '',
      tanggalEvaluasi: new Date().toISOString().split('T')[0]
    };

    await PerformanceRepository.saveDocument(perf);
    return perf;
  }
}

const performanceService = new PerformanceService();
export default performanceService;
