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

vi.mock('@/repositories/EmployeeRepository', () => ({
  default: {
    findOne: vi.fn(),
    find: vi.fn()
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

    it('should throw error if variables are missing', () => {
      expect(() => {
        RenaksiService.computeRealisasi('Penjumlahan', null, []);
      }).toThrow('Variabel untuk metode Penjumlahan wajib diisi.');
    });
  });

  describe('Administrator Realisasi Validation', () => {
    it('should throw error if Administrator submits realisasi when subordinate targets are not approved', async () => {
      RenaksiRepository.findOne.mockResolvedValue({ id: 'rx_1', targetBulanan: 10, tahun: 2026, status: 'Target_Disetujui' });
      const PerjakinDocument = (await import('@/models/PerjakinDocument')).default;
      PerjakinDocument.findOne.mockResolvedValue({ status: 'Disetujui' }); 

      const CascadingAnnualRepository = (await import('@/repositories/CascadingAnnualRepository')).default;
      CascadingAnnualRepository.findOne.mockResolvedValue({ tipeTarget: 'Akumulatif', metodePenghitungan: 'Tunggal' });

      const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
      EmployeeRepository.findOne.mockResolvedValue({ id: 'admin1', jenisJabatan: 'Administrator' });
      EmployeeRepository.find.mockResolvedValue([{ id: 'sub1' }]);
      
      RenaksiRepository.find.mockImplementation(async (query) => {
        if (query.statusRekomendasi) return []; // no uncompleted recs
        return [{ id: 'sub_rx1', targetBulanan: 5, status: 'Diajukan' }]; // subordinate targets
      });

      const body = {
        employeeId: 'admin1', indicatorId: 'ind1', bulan: 1, realisasiBulanan: 15,
        faktorPendorong: 'F', inovasi: 'I', buktiDukung: 'http://proof',
        status: 'Diajukan',
        variablesRealization: [{ name: 'A', value: '15' }]
      };

      await expect(
        RenaksiService.saveRealisasi(body)
      ).rejects.toThrow('Anda belum dapat mengajukan Realisasi Kinerja. Harap pastikan seluruh target staf di unit kerja Anda telah disetujui realisasinya pada bulan ini.');
    });

    it('should succeed if Administrator submits realisasi and subordinate targets are approved', async () => {
      RenaksiRepository.findOne.mockResolvedValue({ id: 'rx_1', targetBulanan: 10, tahun: 2026, status: 'Target_Disetujui' });
      const PerjakinDocument = (await import('@/models/PerjakinDocument')).default;
      PerjakinDocument.findOne.mockResolvedValue({ status: 'Disetujui' }); 

      const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
      EmployeeRepository.findOne.mockResolvedValue({ id: 'admin1', jenisJabatan: 'Administrator' });
      EmployeeRepository.find.mockResolvedValue([{ id: 'sub1' }]);
      
      RenaksiRepository.find.mockImplementation(async (query) => {
        if (query.statusRekomendasi) return []; 
        return [{ id: 'sub_rx1', targetBulanan: 5, status: 'Disetujui' }]; 
      });

      const body = {
        employeeId: 'admin1', indicatorId: 'ind1', bulan: 1, realisasiBulanan: 15,
        faktorPendorong: 'F', inovasi: 'I', buktiDukung: 'http://proof',
        status: 'Diajukan',
        variablesRealization: [{ name: 'A', value: '15' }]
      };

      RenaksiRepository.saveDocument.mockResolvedValue(true);
      const result = await RenaksiService.saveRealisasi(body);
      expect(result).toBeDefined();
    });

    it('should succeed if Pengawas submits realisasi even when subordinate targets are not approved', async () => {
      RenaksiRepository.findOne.mockResolvedValue({ id: 'rx_1', targetBulanan: 10, tahun: 2026, status: 'Target_Disetujui' });
      const PerjakinDocument = (await import('@/models/PerjakinDocument')).default;
      PerjakinDocument.findOne.mockResolvedValue({ status: 'Disetujui' }); 

      const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
      EmployeeRepository.findOne.mockResolvedValue({ id: 'pengawas1', jenisJabatan: 'Pengawas' });
      
      RenaksiRepository.find.mockImplementation(async (query) => {
        if (query.statusRekomendasi) return []; 
        return [{ id: 'sub_rx1', targetBulanan: 5, status: 'Diajukan' }]; 
      });

      const body = {
        employeeId: 'pengawas1', indicatorId: 'ind1', bulan: 1, realisasiBulanan: 15,
        faktorPendorong: 'F', inovasi: 'I', buktiDukung: 'http://proof',
        status: 'Diajukan',
        variablesRealization: [{ name: 'A', value: '15' }]
      };

      RenaksiRepository.saveDocument.mockResolvedValue(true);
      const result = await RenaksiService.saveRealisasi(body);
      expect(result).toBeDefined();
    });
  });

  describe('computeRealisasi Multi-Variable Percentage', () => {
    it('should calculate percentage correctly with multiple pembilang and penyebut', () => {
      const variablesRealization = [
        { name: 'Pem 1', value: '10' },
        { name: 'Pem 2', value: '20' },
        { name: 'Pen 1', value: '40' },
        { name: 'Pen 2', value: '20' }
      ];
      const snapshotVariables = [
        { type: 'pembilang' },
        { type: 'pembilang' },
        { type: 'penyebut' },
        { type: 'penyebut' }
      ];

      // Sum Pembilang = 10 + 20 = 30
      // Sum Penyebut = 40 + 20 = 60
      // Percentage = (30 / 60) * 100 = 50.00
      
      const result = RenaksiService.computeRealisasi('Persentase', variablesRealization, snapshotVariables);
      expect(result).toBe(50);
    });

    it('should throw error if total penyebut is zero', () => {
      const variablesRealization = [
        { name: 'Pem 1', value: '10' },
        { name: 'Pen 1', value: '0' },
        { name: 'Pen 2', value: '0' }
      ];
      const snapshotVariables = [
        { type: 'pembilang' },
        { type: 'penyebut' },
        { type: 'penyebut' }
      ];

      expect(() => {
        RenaksiService.computeRealisasi('Persentase', variablesRealization, snapshotVariables);
      }).toThrow('Total nilai penyebut tidak boleh nol.');
    });
  });
});
