import { describe, it, expect, vi, beforeEach } from 'vitest';
import CascadingAnnualService from '../CascadingAnnualService';
import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import IndicatorAnnualRepository from '@/repositories/IndicatorAnnualRepository';

vi.mock('@/repositories/CascadingAnnualRepository', () => ({
  default: {
    findAll: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
    saveDocument: vi.fn()
  }
}));

vi.mock('@/repositories/Cascading5YearsRepository', () => ({
  default: {
    findOne: vi.fn()
  }
}));

vi.mock('@/repositories/IndicatorAnnualRepository', () => ({
  default: {
    findAll: vi.fn()
  }
}));

vi.mock('@/repositories/Indicator5YearsRepository', () => ({
  default: {
    findAll: vi.fn()
  }
}));

// Mock module for pic-resolver
vi.mock('@/lib/pic-resolver', () => ({
  resolveTreePICs: vi.fn((data, indicators) => data) // Identity mock
}));

describe('CascadingAnnualService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCascadingAnnualData', () => {
    it('should fetch and format cascading annual data correctly', async () => {
      CascadingAnnualRepository.findAll.mockResolvedValue([
        { id: 'prog-1', level: 'program', sasaran: 'Sasaran Prog', toObject: function() { return this; } },
        { id: 'keg-1', level: 'kegiatan', sasaran: 'Sasaran Keg', parentId: 'prog-1', toObject: function() { return this; } },
        { id: 'ind-tujuan', level: 'indikator_tujuan', sasaran: 'Tujuan', toObject: function() { return this; } } // should be filtered out
      ]);

      IndicatorAnnualRepository.findAll.mockResolvedValue([
        { id: 'ind-1', nodeId: 'prog-1', indikator: 'Ind 1', target: 10, toObject: function() { return this; } }
      ]);

      const result = await CascadingAnnualService.getCascadingAnnualData();
      
      expect(result).toHaveLength(2); // 'indikator_tujuan' should be excluded
      
      // Level mapping validation
      expect(result[0].level).toBe('sasaran_program');
      expect(result[1].level).toBe('sasaran_kegiatan');
      
      // Indicators attachment validation
      expect(result[0].indicators).toHaveLength(1);
      expect(result[0].indicators[0].indikator).toBe('Ind 1');
      expect(result[1].indicators).toHaveLength(0);
    });
  });
});
