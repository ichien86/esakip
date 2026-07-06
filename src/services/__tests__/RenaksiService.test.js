import { describe, it, expect, vi, beforeEach } from 'vitest';
import RenaksiService from '@/services/RenaksiService';

// Mocks
vi.mock('@/repositories/RenaksiRepository', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    updateMany: vi.fn(),
    saveDocument: vi.fn()
  }
}));

vi.mock('@/models/Employee', () => ({
  default: {
    findOne: vi.fn()
  }
}));

vi.mock('@/models/Setting', () => ({
  default: {
    findOne: vi.fn()
  }
}));

vi.mock('@/models/RealisasiSchedule', () => ({
  default: {
    findOne: vi.fn()
  }
}));

vi.mock('@/repositories/CascadingAnnualRepository', () => ({
  default: {
    findOne: vi.fn()
  }
}));

vi.mock('@/repositories/IndicatorAnnualRepository', () => ({
  default: {
    findOne: vi.fn(),
    find: vi.fn()
  }
}));

vi.mock('@/lib/db', () => ({
  default: vi.fn()
}));

// Dynamic mocks using doMock for dynamic imports
vi.mock('@/models/PerjakinDocument', () => ({
  default: {
    findOne: vi.fn()
  }
}));

describe('RenaksiService Business Process Locks', () => {
  let RenaksiRepository;
  let Employee;
  let PerjakinDocument;

  beforeEach(async () => {
    vi.clearAllMocks();
    RenaksiRepository = (await import('@/repositories/RenaksiRepository')).default;
    Employee = (await import('@/models/Employee')).default;
    PerjakinDocument = (await import('@/models/PerjakinDocument')).default;
  });

  describe('3. Target Revision Lock', () => {
    it('should block saveBatchTargets if realisasi exists', async () => {
      Employee.findOne.mockResolvedValue({ id: 'emp1', bidangs: ['Bidang A'] });
      // Mock existing realisasi
      RenaksiRepository.find.mockResolvedValue([{ id: 'rx_emp1_ind1_1', realisasiBulanan: 10 }]);

      await expect(
        RenaksiService.saveBatchTargets('emp1', [{ indicatorId: 'ind1', bulan: 1, targetBulanan: 5 }], '2026')
      ).rejects.toThrow('Tidak dapat mengubah target karena Anda sudah mulai mengisi laporan realisasi.');
    });

    it('should block revisiTargets if realisasi exists', async () => {
      // Mock existing realisasi
      RenaksiRepository.find.mockResolvedValue([{ id: 'rx_emp1_ind1_1', realisasiBulanan: 10 }]);

      await expect(
        RenaksiService.revisiTargets('emp1', '2026')
      ).rejects.toThrow('Revisi target tidak diizinkan karena Anda sudah mulai mengisi laporan realisasi.');
    });
  });

  describe('2. Perjakin Document check', () => {
    beforeEach(() => {
      RenaksiRepository.find.mockResolvedValue([]);
    });

    it('should block saveRealisasi if Perjakin is not approved', async () => {
      RenaksiRepository.findOne.mockResolvedValue({ id: 'rx_1', targetBulanan: 10, tahun: 2026, status: 'Target_Disetujui' });
      PerjakinDocument.findOne.mockResolvedValue({ status: 'Draft' }); // Not Disetujui

      const body = {
        employeeId: 'emp1', indicatorId: 'ind1', bulan: 1, realisasiBulanan: 5,
        kendala: 'K', solusi: 'S'
      };

      await expect(
        RenaksiService.saveRealisasi(body)
      ).rejects.toThrow('Pengisian realisasi belum dapat dilakukan karena Dokumen Perjanjian Kinerja (Perjakin) Anda belum disetujui.');
    });

    it('should allow saveRealisasi if Perjakin is approved', async () => {
      RenaksiRepository.findOne.mockResolvedValue({ id: 'rx_1', targetBulanan: 10, tahun: 2026, status: 'Target_Disetujui' });
      PerjakinDocument.findOne.mockResolvedValue({ status: 'Disetujui' }); // Disetujui
      
      const CascadingAnnualRepository = (await import('@/repositories/CascadingAnnualRepository')).default;
      CascadingAnnualRepository.findOne.mockResolvedValue({ tipeTarget: 'Akumulatif', metodePenghitungan: 'Tunggal' });

      // Assuming other validations pass (Kendala/Solusi/FaktorPendorong depending on target)
      const body = {
        employeeId: 'emp1', indicatorId: 'ind1', bulan: 1, realisasiBulanan: 5,
        kendala: 'K', solusi: 'S', buktiDukung: 'http://link',
        variablesRealization: [{ name: 'A', value: '5' }]
      };

      // Mock saveDocument
      RenaksiRepository.saveDocument.mockResolvedValue(true);

      const result = await RenaksiService.saveRealisasi(body);
      expect(result).toBeDefined();
    });
  });

  describe('1. Bukti Dukung Mandatory', () => {
    beforeEach(() => {
      RenaksiRepository.find.mockResolvedValue([]);
    });

    it('should block saveRealisasi if Bukti Dukung is empty when submitting', async () => {
      RenaksiRepository.findOne.mockResolvedValue({ id: 'rx_1', targetBulanan: 10, tahun: 2026, status: 'Target_Disetujui' });
      PerjakinDocument.findOne.mockResolvedValue({ status: 'Disetujui' }); 

      const CascadingAnnualRepository = (await import('@/repositories/CascadingAnnualRepository')).default;
      CascadingAnnualRepository.findOne.mockResolvedValue({ tipeTarget: 'Akumulatif', metodePenghitungan: 'Tunggal' });

      const body = {
        employeeId: 'emp1', indicatorId: 'ind1', bulan: 1, realisasiBulanan: 15,
        faktorPendorong: 'F', inovasi: 'I', buktiDukung: '', // Empty
        variablesRealization: [{ name: 'A', value: '15' }]
      };

      await expect(
        RenaksiService.saveRealisasi(body)
      ).rejects.toThrow('Bukti Dukung wajib dilampirkan sebelum mengajukan realisasi.');
    });

    it('should allow saveRealisasi if Bukti Dukung is provided in variablesRealization', async () => {
      RenaksiRepository.findOne.mockResolvedValue({ id: 'rx_1', targetBulanan: 10, tahun: 2026, status: 'Target_Disetujui' });
      PerjakinDocument.findOne.mockResolvedValue({ status: 'Disetujui' }); 

      const CascadingAnnualRepository = (await import('@/repositories/CascadingAnnualRepository')).default;
      CascadingAnnualRepository.findOne.mockResolvedValue({ tipeTarget: 'Akumulatif', metodePenghitungan: 'Tunggal' });

      const body = {
        employeeId: 'emp1', indicatorId: 'ind1', bulan: 1, realisasiBulanan: 15,
        faktorPendorong: 'F', inovasi: 'I', buktiDukung: '',
        variablesRealization: [
          { name: 'X', value: '15', buktiDukung: 'http://proof' }
        ]
      };

      // Mock saveDocument
      RenaksiRepository.saveDocument.mockResolvedValue(true);

      const result = await RenaksiService.saveRealisasi(body);
      expect(result).toBeDefined();
    });
  });
});
