import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmployeeService from '../EmployeeService';
import EmployeeRepository from '@/repositories/EmployeeRepository';

vi.mock('@/repositories/EmployeeRepository', () => ({
  default: {
    findAll: vi.fn(),
    findOne: vi.fn(),
    saveDocument: vi.fn()
  }
}));

describe('EmployeeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllEmployees', () => {
    it('should return all employees except bupati', async () => {
      EmployeeRepository.findAll.mockResolvedValue([
        { id: '1', name: 'Emp 1', roles: ['admin_perencana'] },
        { id: '2', name: 'Bupati', roles: ['bupati'] }
      ]);

      const result = await EmployeeService.getAllEmployees();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });

  describe('changePassword', () => {
    it('should throw error if data incomplete', async () => {
      await expect(
        EmployeeService.changePassword({ employeeId: '1' })
      ).rejects.toThrow('Data tidak lengkap');
    });

    it('should throw error if employee not found', async () => {
      EmployeeRepository.findOne.mockResolvedValue(null);
      await expect(
        EmployeeService.changePassword({ employeeId: '1', oldPassword: 'old', newPassword: 'new' })
      ).rejects.toThrow('Pegawai tidak ditemukan');
    });

    it('should throw error if old password mismatch', async () => {
      EmployeeRepository.findOne.mockResolvedValue({ id: '1', password: 'real_old' });
      await expect(
        EmployeeService.changePassword({ employeeId: '1', oldPassword: 'wrong_old', newPassword: 'new' })
      ).rejects.toThrow('Password lama salah');
    });

    it('should update password correctly', async () => {
      const mockEmployee = { id: '1', password: 'real_old' };
      EmployeeRepository.findOne.mockResolvedValue(mockEmployee);
      EmployeeRepository.saveDocument.mockResolvedValue(true);

      const result = await EmployeeService.changePassword({ employeeId: '1', oldPassword: 'real_old', newPassword: 'new_pass' });
      
      expect(mockEmployee.password).toBe('new_pass');
      expect(EmployeeRepository.saveDocument).toHaveBeenCalledWith(mockEmployee);
      expect(result).toBe(true);
    });
  });

  describe('changeUnit', () => {
    it('should throw error if supervisor has only one bidang', async () => {
      EmployeeRepository.findOne
        .mockResolvedValueOnce({ id: '1', parentId: '2' }) // requester
        .mockResolvedValueOnce({ id: '2', bidangs: ['Bidang A'] }); // supervisor

      await expect(
        EmployeeService.changeUnit({ requesterId: '1', bidang: 'Bidang B' })
      ).rejects.toThrow('Pilihan unit kerja dikunci karena atasan Anda tidak merangkap jabatan (bukan Plt).');
    });

    it('should throw error if supervisor does not lead the requested bidang', async () => {
      EmployeeRepository.findOne
        .mockResolvedValueOnce({ id: '1', parentId: '2' }) // requester
        .mockResolvedValueOnce({ id: '2', bidangs: ['Bidang A', 'Bidang B'] }); // supervisor

      await expect(
        EmployeeService.changeUnit({ requesterId: '1', bidang: 'Bidang C' })
      ).rejects.toThrow('Unit kerja tidak valid. Atasan Anda tidak memimpin unit kerja ini.');
    });

    it('should change unit correctly', async () => {
      const mockEmployee = { id: '1', parentId: '2', bidangs: ['Bidang A'] };
      EmployeeRepository.findOne
        .mockResolvedValueOnce(mockEmployee) // requester
        .mockResolvedValueOnce({ id: '2', bidangs: ['Bidang A', 'Bidang B'] }); // supervisor
      EmployeeRepository.saveDocument.mockResolvedValue(true);

      const result = await EmployeeService.changeUnit({ requesterId: '1', bidang: 'Bidang B' });
      expect(mockEmployee.bidangs).toEqual(['Bidang B']);
      expect(EmployeeRepository.saveDocument).toHaveBeenCalledWith(mockEmployee);
      expect(result).toBe(mockEmployee);
    });
  });
});
