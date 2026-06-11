import EmployeeRepository from '@/repositories/EmployeeRepository';
import PerformanceRepository from '@/repositories/PerformanceRepository';

class DashboardService {
  async getSummary(yearNum) {
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
}

export default new DashboardService();
