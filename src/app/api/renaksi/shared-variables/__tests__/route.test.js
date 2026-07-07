import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/renaksi/shared-variables/route';
import RenaksiRepository from '@/repositories/RenaksiRepository';

vi.mock('@/repositories/RenaksiRepository', () => ({
  default: {
    findAll: vi.fn()
  }
}));

describe('Shared Variables API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should export output variable alias as a shared variable', async () => {
    const mockRecords = [
      {
        tahun: 2026,
        bulan: 1,
        indicatorId: 'ind-1',
        snapshotOutputVariableAlias: 'Variabel X',
        realisasiBulanan: 125.5, // The final output we want to share
        buktiDukung: '[{"url":"link.com"}]',
        variablesRealization: [
          { name: 'Var Input 1', value: 50 },
          { name: 'Var Input 2', value: 75.5 }
        ]
      }
    ];

    RenaksiRepository.findAll.mockResolvedValue(mockRecords);

    // Mock NextRequest
    const mockRequest = {
      url: 'http://localhost/api/renaksi/shared-variables?tahun=2026&bulan=1'
    };

    const response = await GET(mockRequest);
    const data = await response.json();

    // 1. Should export input variables
    expect(data['Var Input 1']).toBeDefined();
    expect(data['Var Input 1'][0].value).toBe(50);

    expect(data['Var Input 2']).toBeDefined();
    expect(data['Var Input 2'][0].value).toBe(75.5);

    // 2. Should export the final realization alias
    expect(data['Variabel X']).toBeDefined();
    expect(data['Variabel X'][0].value).toBe(125.5);
    expect(data['Variabel X'][0].buktiDukung).toBe('[{"url":"link.com"}]');
  });
});
