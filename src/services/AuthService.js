import EmployeeRepository from '@/repositories/EmployeeRepository';
import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import MasterRepository from '@/repositories/MasterRepository';
import bcrypt from 'bcryptjs';

class AuthService {
  async login({ nip, password }) {
    if (!nip || !password) {
      const err = new Error('NIP/ID dan Password wajib diisi');
      err.status = 400;
      throw err;
    }

    const employee = await EmployeeRepository.findOne({
      $or: [
        { nip: nip },
        { id: nip }
      ]
    });

    if (!employee) {
      const err = new Error('NIP/ID tidak terdaftar');
      err.status = 401;
      throw err;
    }

    if (employee.isActive === false) {
      const err = new Error('Akun Anda dinonaktifkan. Silakan hubungi Administrator.');
      err.status = 401;
      throw err;
    }

    if (employee.roles && employee.roles.includes('bupati')) {
      const err = new Error('Akses ditolak. Akun ini hanya digunakan sebagai referensi sistem.');
      err.status = 403;
      throw err;
    }

    const isPasswordValid = await bcrypt.compare(password, employee.password);
    if (!isPasswordValid && employee.password !== password) {
      const err = new Error('Password salah');
      err.status = 401;
      throw err;
    }

    let bidangs = employee.bidangs;
    let warningsCount = 0;

    try {
      // Query only nodes that belong to the user's bidangs
      const bidangsForWarnings = (employee.roles.includes('admin') || employee.roles.includes('perencana'))
        ? ['Sekretariat', 'Bidang Pencegahan dan Kesiapsiagaan', 'Bidang Kedaruratan dan Logistik', 'Bidang Rehabilitasi dan Rekonstruksi', 'Tata Usaha', 'Badan']
        : employee.bidangs;

      const annualNodes = await CascadingAnnualRepository.find({ bidangPengampu: { $in: bidangsForWarnings }, masterId: { $ne: null } });
      const masterPrograms = await MasterRepository.findPrograms();
      const masterKegiatans = await MasterRepository.findKegiatans();
      const masterSubkegiatans = await MasterRepository.findSubkegiatans();

      const progMap = new Map(masterPrograms.map(p => [p.id, p]));
      const kegMap = new Map(masterKegiatans.map(k => [k.id, k]));
      const subMap = new Map(masterSubkegiatans.map(s => [s.id, s]));

      for (const node of annualNodes) {
        if (node.level === 'program' || node.level === 'sasaran_program') {
          const master = progMap.get(node.masterId);
          if (master && node.text !== master.nama) warningsCount++;
        } else if (node.level === 'kegiatan' || node.level === 'sasaran_kegiatan') {
          const master = kegMap.get(node.masterId);
          if (master && node.text !== master.nama) warningsCount++;
        } else if (node.level === 'subkegiatan' || node.level === 'sasaran_subkegiatan') {
          const master = subMap.get(node.masterId);
          if (master && (node.text !== master.nama || node.indikator !== master.indikator || node.satuan !== master.satuan)) warningsCount++;
        }
      }
    } catch (e) {
      console.error('Failed to calculate warningsCount during login', e);
    }

    const result = {
      id: employee.id,
      nama: employee.nama,
      nip: employee.nip,
      jabatan: employee.jabatan,
      pangkatGolongan: employee.pangkatGolongan || '',
      roles: employee.roles,
      parentId: employee.parentId,
      bidangs: bidangs,
      scopeLeader: employee.scopeLeader || null,
      warningsCount
    };
    return JSON.parse(JSON.stringify(result));
  }
}

export default new AuthService();
