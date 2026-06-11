import EmployeeRepository from '@/repositories/EmployeeRepository';
import Renaksi from '@/models/Renaksi';
import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';

class RewardService {
  async getLeaderboard(yearNum, selectedBulan) {
    const employees = await EmployeeRepository.findAll();
    const activeEmployees = employees.filter(e => e.id !== 'admin' && e.isActive !== false);

    const renaksiQuery = {
      tahun: yearNum,
      realisasiBulanan: { $ne: null },
      status: { $in: ['Diajukan', 'Disetujui'] }
    };

    if (selectedBulan && selectedBulan >= 1 && selectedBulan <= 11) {
      renaksiQuery.bulan = selectedBulan;
    }

    const renaksis = await Renaksi.find(renaksiQuery);
    const annualNodes = await CascadingAnnualRepository.find({ tahun: yearNum });

    const leaderboard = activeEmployees.map(emp => {
      const records = renaksis.filter(r => r.employeeId === emp.id);

      let averageCapaian = 0;
      let latestSubmissionTime = 0;

      if (records.length > 0) {
        let totalCapaian = 0;
        records.forEach(r => {
          const node = annualNodes.find(c => c.id === r.indicatorId);
          let percent = 0;

          if (r.targetBulanan > 0) {
            if (node && node.tipeTarget === 'Kondisi Akhir Menurun') {
              if (r.realisasiBulanan <= r.targetBulanan && r.realisasiBulanan > 0) {
                percent = 100;
              } else if (r.realisasiBulanan > r.targetBulanan) {
                percent = (r.targetBulanan / r.realisasiBulanan) * 100;
              } else {
                percent = 0;
              }
            } else {
              percent = (r.realisasiBulanan / r.targetBulanan) * 100;
            }
          } else if (r.realisasiBulanan > 0) {
            percent = 100;
          } else {
            percent = 100;
          }

          totalCapaian += Math.min(150, percent);
        });
        averageCapaian = totalCapaian / records.length;

        const times = records.map(r => r.tanggalRealisasi ? new Date(r.tanggalRealisasi).getTime() : 0);
        latestSubmissionTime = Math.max(...times);
      }

      return {
        id: emp.id,
        nama: emp.nama,
        jabatan: emp.jabatan,
        bidang: emp.bidangs[0] || '',
        averageCapaian: parseFloat(averageCapaian.toFixed(2)),
        latestSubmissionTime: latestSubmissionTime || Infinity,
        totalBulanMengisi: records.length
      };
    });

    leaderboard.sort((a, b) => {
      if (b.averageCapaian !== a.averageCapaian) {
        return b.averageCapaian - a.averageCapaian;
      }
      return a.latestSubmissionTime - b.latestSubmissionTime;
    });

    return leaderboard;
  }
}

export default new RewardService();
