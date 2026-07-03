import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, init }))
  }
}));

vi.mock('@/lib/db', () => ({
  default: vi.fn()
}));

const mockRenaksiFind = vi.fn();
vi.mock('@/models/Renaksi', () => ({
  default: {
    find: vi.fn(() => ({
      lean: mockRenaksiFind
    }))
  }
}));

const mockEmployeeFind = vi.fn();
vi.mock('@/models/Employee', () => ({
  default: {
    find: vi.fn(() => ({
      lean: mockEmployeeFind
    }))
  }
}));

const mockIndicatorFind = vi.fn();
vi.mock('@/models/IndicatorAnnual', () => ({
  default: {
    find: vi.fn(() => ({
      lean: mockIndicatorFind
    }))
  }
}));

vi.mock('@/lib/api-auth', () => ({
  getValidatedUser: vi.fn()
}));

describe('GET /api/admin/rekap-realisasi', () => {
  let mockRequest;
  
  beforeEach(() => {
    vi.clearAllMocks();
    const headersMap = new Map([['x-requester-role', 'admin']]);
    mockRequest = {
      url: 'http://localhost/api/admin/rekap-realisasi?tahun=2026',
      headers: {
        get: vi.fn(key => headersMap.get(key))
      }
    };
  });

  it('harus menolak jika role tidak diizinkan', async () => {
    const { getValidatedUser } = await import('@/lib/api-auth');
    getValidatedUser.mockReturnValue({ role: 'pemimpin', user: {} });

    const response = await GET(mockRequest);
    expect(response.init.status).toBe(403);
    expect(response.body.error).toBe('Akses ditolak.');
  });

  it('harus mengembalikan error jika tahun tidak ada', async () => {
    const { getValidatedUser } = await import('@/lib/api-auth');
    getValidatedUser.mockReturnValue({ role: 'admin', user: {} });

    mockRequest.url = 'http://localhost/api/admin/rekap-realisasi';
    const response = await GET(mockRequest);
    expect(response.init.status).toBe(400);
    expect(response.body.error).toBe('Parameter tahun wajib diisi.');
  });

  it('harus memfilter berdasarkan bidang jika role admin_bidang', async () => {
    const { getValidatedUser } = await import('@/lib/api-auth');
    getValidatedUser.mockReturnValue({ role: 'admin_bidang', user: { bidang: 'TI' } });

    mockRenaksiFind.mockResolvedValue([
      { _id: 'r1', employeeId: 'emp-1', indicatorId: 'ind-1', tahun: 2026, bulan: 1, realisasiBulanan: 100 },
      { _id: 'r2', employeeId: 'emp-2', indicatorId: 'ind-2', tahun: 2026, bulan: 1, realisasiBulanan: 80 }
    ]);
    mockEmployeeFind.mockResolvedValue([
      { id: 'emp-1', namaLengkap: 'Budi', jabatan: 'Staf', bidang: 'TI' },
      { id: 'emp-2', namaLengkap: 'Ani', jabatan: 'Staf', bidang: 'Hukum' }
    ]);
    mockIndicatorFind.mockResolvedValue([]);

    const response = await GET(mockRequest);
    
    // Hanya Ani yang di Hukum akan terfilter, Budi di TI masuk
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].employeeName).toBe('Budi');
  });

  it('harus meratakan array tautan bukti dukung', async () => {
    const { getValidatedUser } = await import('@/lib/api-auth');
    getValidatedUser.mockReturnValue({ role: 'admin', user: {} });

    mockRenaksiFind.mockResolvedValue([
      { 
        _id: 'r1', employeeId: 'emp-1', indicatorId: 'ind-1', tahun: 2026, bulan: 1, 
        realisasiBulanan: 100,
        variablesRealization: [
          { buktiDukung: JSON.stringify([{ url: 'http://link1' }]) },
          { buktiDukung: JSON.stringify([{ url: 'http://link2' }]) }
        ]
      }
    ]);
    mockEmployeeFind.mockResolvedValue([{ id: 'emp-1', namaLengkap: 'Budi', bidang: 'TI' }]);
    mockIndicatorFind.mockResolvedValue([]);

    const response = await GET(mockRequest);
    
    expect(response.body.data[0].buktiDukung).toEqual(['http://link1', 'http://link2']);
  });
});
