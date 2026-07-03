import { describe, it, expect, vi, beforeEach } from 'vitest';
import RenaksiService from '../RenaksiService';
import RenaksiRepository from '@/repositories/RenaksiRepository';

vi.mock('@/repositories/RenaksiRepository', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    updateMany: vi.fn(),
    saveDocument: vi.fn()
  }
}));

vi.mock('@/repositories/SelectionRepository', () => ({
  default: {
    findOne: vi.fn()
  }
}));

vi.mock('@/repositories/CascadingAnnualRepository', () => ({ default: { find: vi.fn() } }));
vi.mock('@/repositories/IndicatorAnnualRepository', () => ({ default: { find: vi.fn() } }));
vi.mock('../LinkVerificationService', () => ({
  default: {
    verifyLink: vi.fn()
  }
}));
vi.mock('@/repositories/EmployeeRepository', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn()
  }
}));
vi.mock('@/models/Employee', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn()
  }
}));
vi.mock('@/models/RealisasiSchedule', () => ({ default: {} }));
vi.mock('@/models/Renaksi', () => ({ default: {} }));

// Mock Setting model
vi.mock('@/models/Setting', () => ({
  default: {
    findOne: vi.fn()
  }
}));

vi.mock('@/lib/db', () => ({
  default: vi.fn(),
  connectDB: vi.fn()
}));

describe('RenaksiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitTargets', () => {
    it('should throw error if no targets are found', async () => {
      const Setting = (await import('@/models/Setting')).default;
      Setting.findOne.mockResolvedValue(null);
      
      const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
      EmployeeRepository.findOne.mockResolvedValue({});
      
      const SelectionRepository = (await import('@/repositories/SelectionRepository')).default;
      SelectionRepository.findOne.mockResolvedValue({ selectedIndicators: ['ind-1'] });
      
      const CascadingAnnualRepository = (await import('@/repositories/CascadingAnnualRepository')).default;
      CascadingAnnualRepository.find.mockResolvedValue([{ id: 'ind-1', indikator: 'Ind 1' }]);
      const IndicatorAnnualRepository = (await import('@/repositories/IndicatorAnnualRepository')).default;
      IndicatorAnnualRepository.find.mockResolvedValue([]);
      
      RenaksiRepository.find.mockResolvedValue([]); // No targets
      
      await expect(
        RenaksiService.submitTargets('emp-1', 2026)
      ).rejects.toThrow('Validasi Gagal: Anda belum mengisi target sama sekali untuk indikator "Ind 1"');
    });

    it('should submit targets correctly', async () => {
      const Setting = (await import('@/models/Setting')).default;
      Setting.findOne.mockResolvedValue(null);
      
      const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
      EmployeeRepository.findOne.mockResolvedValue({});
      
      const SelectionRepository = (await import('@/repositories/SelectionRepository')).default;
      SelectionRepository.findOne.mockResolvedValue({ selectedIndicators: ['ind-1'] });
      
      const CascadingAnnualRepository = (await import('@/repositories/CascadingAnnualRepository')).default;
      CascadingAnnualRepository.find.mockResolvedValue([{ id: 'ind-1', indikator: 'Ind 1', tipeTarget: 'Akumulatif' }]);
      const IndicatorAnnualRepository = (await import('@/repositories/IndicatorAnnualRepository')).default;
      IndicatorAnnualRepository.find.mockResolvedValue([]);
      
      RenaksiRepository.find.mockResolvedValue([
        { id: '1', indicatorId: 'ind-1', status: 'Draft' },
        { id: '2', indicatorId: 'ind-1', status: 'Target_Ditolak' }
      ]);
      RenaksiRepository.updateMany.mockResolvedValue({ modifiedCount: 2 });
      
      const result = await RenaksiService.submitTargets('emp-1', 2026);
      expect(RenaksiRepository.updateMany).toHaveBeenCalledWith(
        { employeeId: 'emp-1', tahun: 2026, status: 'Draft' },
        { $set: { status: 'Target_Diajukan' } }
      );
      expect(result).toBe(2);
    });
  });

  describe('revisiTargets', () => {
    it('should throw error if system is locked', async () => {
      const Setting = (await import('@/models/Setting')).default;
      Setting.findOne.mockResolvedValue({ key: 'renja_locked', value: true });
      
      await expect(
        RenaksiService.revisiTargets('emp-1', 2026)
      ).rejects.toThrow('Revisi ditolak karena sistem telah dikunci oleh Administrator.');
    });

    it('should update targets to Draft for revision', async () => {
      const Setting = (await import('@/models/Setting')).default;
      Setting.findOne.mockResolvedValue(null);
      RenaksiRepository.find.mockResolvedValue([
        { id: '1', status: 'Target_Disetujui' }
      ]);
      // Mocking updateMany response correctly
      RenaksiRepository.updateMany.mockResolvedValue({ modifiedCount: 1 });
      
      const result = await RenaksiService.revisiTargets('emp-1', 2026);
      expect(RenaksiRepository.updateMany).toHaveBeenCalledWith(
        { employeeId: 'emp-1', tahun: 2026, status: { $in: ['Target_Disetujui', 'Target_Diajukan', 'Target_ACC_Admin', 'Target_Ditolak'] } },
        { $set: { status: 'Draft' } }
      );
      expect(result).toBe(1);
    });
  });

  describe('approveRealisasi & Rekomendasi Atasan', () => {
    it('Atasan: Wajib isi rekomendasi jika underperforming', async () => {
      RenaksiRepository.findOne.mockResolvedValue({
        id: 'rx_1', employeeId: 'emp-1', status: 'ACC_Admin', capaianBulanan: 80
      });
      const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
      EmployeeRepository.findOne.mockResolvedValue({
        id: 'emp-1', jenisJabatan: 'Administrator'
      });

      await expect(
        RenaksiService.approveRealisasi('rx_1', 'pemimpin', '')
      ).rejects.toThrow('Capaian di bawah target. Rekomendasi dari atasan wajib diisi.');
    });

    it('Atasan: Rekomendasi opsional jika memenuhi target', async () => {
      RenaksiRepository.findOne.mockResolvedValue({
        id: 'rx_2', employeeId: 'emp-1', status: 'ACC_Admin', capaianBulanan: 100, indicatorId: 'ind-1'
      });
      const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
      EmployeeRepository.findOne.mockResolvedValue({
        id: 'emp-1', jenisJabatan: 'Administrator'
      });
      RenaksiRepository.saveDocument.mockResolvedValue(true);
      RenaksiRepository.updateMany.mockResolvedValue(true);

      const res = await RenaksiService.approveRealisasi('rx_2', 'pemimpin', '');
      expect(res.statusRekomendasi).toBeUndefined();
      expect(res.status).toBe('Disetujui');
    });

    it('Bawahan: Diblokir saat saveRealisasi jika ada tindak lanjut belum selesai', async () => {
      RenaksiRepository.findOne.mockResolvedValue({ id: 'rx_3', tahun: 2026 });
      RenaksiRepository.find.mockResolvedValue([{ id: 'rx_old', statusRekomendasi: 'Menunggu Tindak Lanjut' }]);

      await expect(
        RenaksiService.saveRealisasi({ employeeId: 'emp-1', indicatorId: 'ind-1', bulan: 2 })
      ).rejects.toThrow('Anda memiliki rekomendasi kinerja pada Bulan 1 Tahun 2026 yang belum ditindaklanjuti. Harap selesaikan terlebih dahulu sebelum mengisi realisasi.');
    });

    it('Bawahan: Berhasil saveTindakLanjutRekomendasi jika link valid', async () => {
      const LinkVerificationService = (await import('../LinkVerificationService')).default;
      LinkVerificationService.verifyLink.mockResolvedValue(true);

      RenaksiRepository.findOne.mockResolvedValue({
        id: 'rx_old', statusRekomendasi: 'Menunggu Tindak Lanjut'
      });

      const res = await RenaksiService.saveTindakLanjutRekomendasi('rx_old', 'Sudah dikerjakan', 'http://valid.com');
      expect(res.statusRekomendasi).toBe('Selesai');
      expect(res.tindakLanjutRekomendasi).toBe('Sudah dikerjakan');
    });

    it('Bawahan (Desember): Pemblokiran di Bulan 1 Tahun N+1 jika Bulan 12 Tahun N belum ditindaklanjuti', async () => {
      RenaksiRepository.findOne.mockResolvedValue({ id: 'rx_jan_2027', tahun: 2027 });
      RenaksiRepository.find.mockImplementation(async (query) => {
        if (query.bulan === 12 && query.tahun === 2026 && query.statusRekomendasi === 'Menunggu Tindak Lanjut') {
          return [{ id: 'rx_dec_2026' }];
        }
        return [];
      });

      await expect(
        RenaksiService.saveRealisasi({ employeeId: 'emp-1', indicatorId: 'ind-1', bulan: 1 })
      ).rejects.toThrow('Anda memiliki rekomendasi kinerja pada Bulan 12 Tahun 2026 yang belum ditindaklanjuti');
    });
  });
});
