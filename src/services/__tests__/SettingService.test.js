import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingService from '../SettingService';
import SettingRepository from '@/repositories/SettingRepository';
import RenaksiRepository from '@/repositories/RenaksiRepository';
import Cascading5Years from '@/models/Cascading5Years';
import Indicator5Years from '@/models/Indicator5Years';

vi.mock('@/repositories/SettingRepository', () => ({
  default: {
    findAll: vi.fn(),
    findOne: vi.fn(),
    saveDocument: vi.fn(),
    create: vi.fn()
  }
}));

vi.mock('@/repositories/RenaksiRepository', () => ({
  default: {
    find: vi.fn()
  }
}));

vi.mock('@/models/Cascading5Years', () => ({
  default: {
    find: vi.fn()
  }
}));

vi.mock('@/models/Indicator5Years', () => ({
  default: {
    find: vi.fn()
  }
}));

describe('SettingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllSettings', () => {
    it('should return default settings if empty', async () => {
      SettingRepository.findAll.mockResolvedValue([]);
      const result = await SettingService.getAllSettings();
      expect(result).toEqual({ renstra_locked: false, renja_locked: false });
    });

    it('should return merged settings', async () => {
      SettingRepository.findAll.mockResolvedValue([
        { key: 'renja_locked', value: true }
      ]);
      const result = await SettingService.getAllSettings();
      expect(result.renja_locked).toBe(true);
      expect(result.renstra_locked).toBe(false);
    });
  });

  describe('updateSetting', () => {
    it('should reject non-admin users', async () => {
      await expect(
        SettingService.updateSetting({ key: 'renja_locked', value: true, requesterRole: 'pemimpin' })
      ).rejects.toThrow('Akses ditolak');
    });

    it('should reject if key or value is missing', async () => {
      await expect(
        SettingService.updateSetting({ key: '', value: true, requesterRole: 'admin' })
      ).rejects.toThrow('Key dan Value wajib diisi');
    });

    describe('renja_locked validation', () => {
      it('should throw error if locking renja with unapproved targets', async () => {
        RenaksiRepository.find.mockResolvedValue([{ id: 'tgt-1', status: 'Draft' }]);
        
        await expect(
          SettingService.updateSetting({ key: 'renja_locked', value: true, requesterRole: 'admin' })
        ).rejects.toThrow(/Sistem ditolak untuk dikunci.*Terdapat 1 target Renaksi/);
      });

      it('should allow locking renja if all targets are approved', async () => {
        RenaksiRepository.find.mockResolvedValue([]); // No unapproved targets
        SettingRepository.findOne.mockResolvedValue(null);
        SettingRepository.create.mockResolvedValue({ key: 'renja_locked', value: true });

        const result = await SettingService.updateSetting({ key: 'renja_locked', value: true, requesterRole: 'admin' });
        expect(result.key).toBe('renja_locked');
        expect(result.value).toBe(true);
      });
    });

    describe('renstra_locked validation', () => {
      it('should throw error if cascading branch is incomplete (leaf is not subkegiatan)', async () => {
        Cascading5Years.find.mockResolvedValue([
          { id: '1', level: 'tujuan', text: 'Tujuan 1', parentId: null },
          { id: '2', level: 'sasaran', text: 'Sasaran 1', parentId: '1' }
          // Node 2 is a leaf, but its level is 'sasaran' (not subkegiatan)
        ]);
        
        await expect(
          SettingService.updateSetting({ key: 'renstra_locked', value: true, requesterRole: 'admin' })
        ).rejects.toThrow(/Cascading terputus pada node "Sasaran 1"/);
      });

      it('should throw error if a main node is missing definisiOperasional', async () => {
        Cascading5Years.find.mockResolvedValue([
          { id: '1', level: 'subkegiatan', text: 'Sub 1', parentId: null, definisiOperasional: '' }
        ]);

        await expect(
          SettingService.updateSetting({ key: 'renstra_locked', value: true, requesterRole: 'admin' })
        ).rejects.toThrow(/belum memiliki Definisi Operasional/);
      });

      it('should throw error if an indicator is missing definisiOperasional', async () => {
        Cascading5Years.find.mockResolvedValue([
          { id: '1', level: 'subkegiatan', text: 'Sub 1', parentId: null, definisiOperasional: 'Def' }
        ]);
        Indicator5Years.find.mockResolvedValue([
          { id: 'ind-1', nodeId: '1', indikator: 'Indikator A', definisiOperasional: '' }
        ]);

        await expect(
          SettingService.updateSetting({ key: 'renstra_locked', value: true, requesterRole: 'admin' })
        ).rejects.toThrow(/Indikator tambahan "Indikator A" pada node "Sub 1" belum memiliki Definisi Operasional/);
      });

      it('should allow locking renstra if all validation passes', async () => {
        Cascading5Years.find.mockResolvedValue([
          { id: '1', level: 'subkegiatan', text: 'Sub 1', parentId: null, definisiOperasional: 'Valid Def' }
        ]);
        Indicator5Years.find.mockResolvedValue([]);
        
        SettingRepository.findOne.mockResolvedValue({ key: 'renstra_locked', value: false });
        SettingRepository.saveDocument.mockImplementation(async (doc) => doc);

        const result = await SettingService.updateSetting({ key: 'renstra_locked', value: true, requesterRole: 'admin' });
        expect(SettingRepository.saveDocument).toHaveBeenCalled();
        expect(result.value).toBe(true);
      });
    });
  });
});
