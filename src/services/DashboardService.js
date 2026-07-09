import dbConnect from '@/lib/db';
import EmployeeRepository from '@/repositories/EmployeeRepository';
import PerformanceRepository from '@/repositories/PerformanceRepository';
import Selection from '@/models/Selection';
import IndicatorAnnual from '@/models/IndicatorAnnual';
import CascadingAnnual from '@/models/CascadingAnnual';
import Renaksi from '@/models/Renaksi';
import RealisasiSchedule from '@/models/RealisasiSchedule';
import PerjakinDocument from '@/models/PerjakinDocument';
import Employee from '@/models/Employee';
import { resolveTreePICs } from '@/lib/pic-resolver';

class DashboardService {
  async getSummary(yearNum) {
    await dbConnect();
    const employees = await EmployeeRepository.findAll();
    // Filter active employees (or those where isActive is not strictly false)
    const activeEmployees = employees.filter(emp => emp.isActive !== false);
    
    const performances = await PerformanceRepository.find({ tahun: yearNum });

    const summary = activeEmployees.map(emp => {
      const perf = performances.find(p => p.employeeId === emp.id);
      return {
        id: emp.id,
        nama: emp.nama,
        jabatan: emp.jabatan,
        roles: emp.roles,
        parentId: emp.parentId,
        status: perf ? perf.status : 'Belum Mengisi',
        skorAKIP: perf && perf.evaluasiAtasan ? perf.evaluasiAtasan.skorAKIP : null,
        predikat: perf && perf.evaluasiAtasan ? perf.evaluasiAtasan.predikat : null
      };
    });

    return summary;
  }

  async getPendingTasksAndActiveTargets(employeeId, role, yearNum) {
    await dbConnect();
    const emp = await Employee.findOne({ id: employeeId });
    const jabatan = emp ? emp.jabatan : '';
    const userBidang = emp && emp.bidangs ? emp.bidangs[0] : '';

    const tasks = [];
    const activeMonthTargets = [];

    // 1. Get assigned indicators for this employee using resolved tree PICs
    const allNodes = await CascadingAnnual.find({ tahun: yearNum });
    const allAnnualIndicators = await IndicatorAnnual.find({ tahun: yearNum });
    const resolvedNodes = resolveTreePICs(allNodes, allAnnualIndicators);

    const assignedIndicators = [];
    resolvedNodes.forEach(node => {
      const inds = node.indicators || [];
      inds.forEach(ind => {
        if (ind.penanggungJawab) {
          const pics = ind.penanggungJawab.split(',').map(s => s.trim());
          const isMatch = pics.includes(employeeId) || (jabatan && pics.includes(`jabatan:${jabatan}`));
          if (isMatch) {
            assignedIndicators.push(ind);
          }
        }
      });
    });

    // A. IF USER IS ADMIN UNIT KERJA (role === 'admin_bidang')
    if (role === 'admin_bidang' && userBidang) {
      // Find indicators in their unit that have no penanggungJawab
      const unitNodes = await CascadingAnnual.find({ bidangPengampu: userBidang, tahun: yearNum });
      const unitNodeIds = unitNodes.map(n => n.id);
      const unassignedCount = await IndicatorAnnual.countDocuments({
        nodeId: { $in: unitNodeIds },
        tahun: yearNum,
        $or: [{ penanggungJawab: null }, { penanggungJawab: '' }]
      });

      if (unassignedCount > 0) {
        tasks.push({
          id: 'assign_indicators',
          title: 'Tentukan Penanggung Jawab IKU',
          description: `Terdapat ${unassignedCount} indikator kinerja di unit kerja ${userBidang} yang belum ditentukan penanggung jawab (PIC) nya.`,
          status: 'warning',
          actionUrl: '/employee/select',
          actionLabel: 'Pilih & Atur PIC'
        });
      }
    }

    // B. IF USER IS PEGAWAI (or any role that has assigned indicators)
    // If they have no assigned indicators yet
    if (assignedIndicators.length === 0 && role === 'pegawai') {
      tasks.push({
        id: 'no_assigned_indicators',
        title: 'Indikator Kinerja Belum Ditugaskan',
        description: 'Anda belum memiliki Indikator Kinerja Utama (IKU) yang ditugaskan oleh Admin Unit Kerja Anda.',
        status: 'info',
        actionUrl: '#',
        actionLabel: 'Hubungi Admin Unit Kerja'
      });
    }

    // If they have assigned indicators
    if (assignedIndicators.length > 0) {
      const indicatorIds = assignedIndicators.map(ind => ind.id);
      const renaksiRecords = await Renaksi.find({ employeeId, tahun: yearNum, indicatorId: { $in: indicatorIds } });

      // 2. Check targets status
      const draftRecords = renaksiRecords.filter(r => r.status === 'Draft');
      
      if (renaksiRecords.length < assignedIndicators.length * 12) {
        tasks.push({
          id: 'fill_targets',
          title: 'Isi Target Bulanan (Rencana Aksi)',
          description: `Anda belum menyelesaikan pengisian target bulanan rencana aksi (${renaksiRecords.length}/${assignedIndicators.length * 12} terisi).`,
          status: 'warning',
          actionUrl: '/employee/renaksi',
          actionLabel: 'Lengkapi Rencana Aksi'
        });
      } else if (draftRecords.length > 0) {
        tasks.push({
          id: 'submit_targets',
          title: 'Ajukan Target Rencana Aksi',
          description: 'Terdapat target bulanan rencana aksi Anda yang masih berstatus Draft dan belum diajukan.',
          status: 'warning',
          actionUrl: '/employee/renaksi',
          actionLabel: 'Ajukan Target'
        });
      }

      // 3. Check realization status for active months
      const activeSchedules = await RealisasiSchedule.find({ tahun: yearNum, isLocked: false });

      if (activeSchedules.length > 0) {
        const monthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        
        const pendingMonths = [];
        const activeMonthNums = activeSchedules.map(s => s.bulan);

        for (const sched of activeSchedules) {
          const m = sched.bulan;
          const monthRecords = renaksiRecords.filter(r => r.bulan === m);

          const incomplete = monthRecords.some(r => r.realisasiBulanan === null || !['Diajukan', 'Disetujui', 'ACC_Subkoor', 'ACC_Kabid', 'ACC_Admin'].includes(r.status));
          if (incomplete || monthRecords.length < assignedIndicators.length) {
            pendingMonths.push(monthNames[m - 1]);
          }
        }

        if (pendingMonths.length > 0) {
          tasks.push({
            id: 'fill_realisasi',
            title: 'Isi Laporan Realisasi Bulanan',
            description: `Anda belum melengkapi laporan realisasi kinerja untuk bulan: ${pendingMonths.join(', ')}.`,
            status: 'warning',
            actionUrl: '/employee/realisasi',
            actionLabel: 'Lengkapi Realisasi'
          });
        }

        // 4. Fetch Active Month Targets to display on the dashboard!
        const primaryActiveMonth = Math.max(...activeMonthNums);
        if (primaryActiveMonth > 0) {
          for (const ind of assignedIndicators) {
            const record = renaksiRecords.find(r => r.indicatorId === ind.id && r.bulan === primaryActiveMonth);
            activeMonthTargets.push({
              indicatorId: ind.id,
              indikator: ind.indikator,
              satuan: ind.satuan,
              bulan: primaryActiveMonth,
              bulanLabel: monthNames[primaryActiveMonth - 1],
              target: record ? record.targetBulanan : 0,
              realisasi: record ? record.realisasiBulanan : null,
              status: record ? record.status : 'Belum Diisi'
            });
          }
        }
      }

      // 5. Perjakin check
      const perjakinDoc = await PerjakinDocument.findOne({ employeeId, tahun: yearNum });

      if (!perjakinDoc) {
        tasks.push({
          id: 'create_perjakin',
          title: 'Buat Perjanjian Kinerja (Perjakin)',
          description: 'Dokumen Perjanjian Kinerja (Perjakin) Anda belum dibuat/diajukan.',
          status: 'warning',
          actionUrl: '/employee/perjakin',
          actionLabel: 'Ajukan Perjakin'
        });
      } else if (['Draft', 'Ditolak'].includes(perjakinDoc.status)) {
        tasks.push({
          id: 'submit_perjakin',
          title: 'Ajukan Perjanjian Kinerja (Perjakin)',
          description: `Dokumen Perjanjian Kinerja (Perjakin) Anda berstatus ${perjakinDoc.status} dan belum diajukan.`,
          status: 'warning',
          actionUrl: '/employee/perjakin',
          actionLabel: 'Ajukan Perjakin'
        });
      }
    }

    // 6. Supervisor Approvals
    const subordinates = await Employee.find({ parentId: employeeId, isActive: true });
    if (subordinates.length > 0) {
      const subIds = subordinates.map(s => s.id);
      const pendingTargets = await Renaksi.countDocuments({
        employeeId: { $in: subIds },
        tahun: yearNum,
        status: 'Target_Diajukan'
      });
      if (pendingTargets > 0) {
        tasks.push({
          id: 'approve_targets',
          title: 'Validasi Rencana Aksi Bawahan',
          description: `Terdapat ${pendingTargets} target bulanan rencana aksi bawahan yang memerlukan verifikasi Anda.`,
          status: 'info',
          actionUrl: '/supervisor/evaluation',
          actionLabel: 'Validasi Kinerja'
        });
      }

      const pendingRealizations = await Renaksi.countDocuments({
        employeeId: { $in: subIds },
        tahun: yearNum,
        status: 'Diajukan'
      });
      if (pendingRealizations > 0) {
        tasks.push({
          id: 'approve_realisasi',
          title: 'Validasi Realisasi Bulanan Bawahan',
          description: `Terdapat ${pendingRealizations} laporan realisasi bulanan bawahan yang memerlukan verifikasi Anda.`,
          status: 'info',
          actionUrl: '/supervisor/evaluation',
          actionLabel: 'Validasi Kinerja'
        });
      }
    }

    return { tasks, activeMonthTargets };
  }
}

const dashboardService = new DashboardService();
export default dashboardService;
