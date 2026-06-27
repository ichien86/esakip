import EmployeeRepository from '@/repositories/EmployeeRepository';
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

    const result = {
      id: employee.id,
      nama: employee.nama,
      nip: employee.nip,
      jabatan: employee.jabatan,
      pangkatGolongan: employee.pangkatGolongan || '',
      roles: employee.roles,
      parentId: employee.parentId,
      bidangs: employee.bidangs,
      scopeLeader: employee.scopeLeader || null,
      // warningsCount diambil secara terpisah oleh dashboard agar login lebih cepat
      warningsCount: 0,
    };
    return JSON.parse(JSON.stringify(result));
  }
}

export default new AuthService();
