import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuthService from '../AuthService';
import EmployeeRepository from '@/repositories/EmployeeRepository';
import bcrypt from 'bcrypt';

vi.mock('@/repositories/EmployeeRepository', () => ({
  default: {
    findOne: vi.fn()
  }
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn()
  }
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should throw error if nip or password missing', async () => {
      await expect(AuthService.login({ nip: '123' })).rejects.toThrow('NIP/ID dan Password wajib diisi');
      await expect(AuthService.login({ password: '123' })).rejects.toThrow('NIP/ID dan Password wajib diisi');
    });

    it('should throw error if user not found', async () => {
      EmployeeRepository.findOne.mockResolvedValue(null);
      await expect(AuthService.login({ nip: '123', password: '123' })).rejects.toThrow('NIP/ID tidak terdaftar');
    });

    it('should throw error if user is inactive', async () => {
      EmployeeRepository.findOne.mockResolvedValue({ isActive: false });
      await expect(AuthService.login({ nip: '123', password: '123' })).rejects.toThrow('Akun Anda dinonaktifkan. Silakan hubungi Administrator.');
    });

    it('should throw error if user is bupati', async () => {
      EmployeeRepository.findOne.mockResolvedValue({ roles: ['bupati'] });
      await expect(AuthService.login({ nip: 'bupati', password: '123' })).rejects.toThrow('Akses ditolak. Akun ini hanya digunakan sebagai referensi sistem.');
    });

    it('should throw error if password incorrect', async () => {
      EmployeeRepository.findOne.mockResolvedValue({ password: 'hashed' });
      bcrypt.compare.mockResolvedValue(false);
      await expect(AuthService.login({ nip: '123', password: 'wrong' })).rejects.toThrow('Password salah');
    });

    it('should login successfully with bcrypt matched password', async () => {
      const mockEmp = {
        id: 'emp-1',
        nama: 'Emp 1',
        nip: '123',
        jabatan: 'Staff',
        roles: ['admin_perencana'],
        password: 'hashed'
      };
      EmployeeRepository.findOne.mockResolvedValue(mockEmp);
      bcrypt.compare.mockResolvedValue(true);
      
      const result = await AuthService.login({ nip: '123', password: 'password' });
      expect(result.id).toBe('emp-1');
      expect(result.nama).toBe('Emp 1');
      expect(result.warningsCount).toBe(0);
    });

    it('should login successfully with plain text password matched (legacy)', async () => {
      const mockEmp = {
        id: 'emp-2',
        nama: 'Emp 2',
        nip: '123',
        password: 'plaintext_password'
      };
      EmployeeRepository.findOne.mockResolvedValue(mockEmp);
      bcrypt.compare.mockResolvedValue(false); // bcrypt fails
      
      const result = await AuthService.login({ nip: '123', password: 'plaintext_password' });
      expect(result.id).toBe('emp-2');
    });
  });
});
