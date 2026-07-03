import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextResponse } from 'next/server';

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

vi.mock('@/lib/api-auth', () => ({
  getValidatedUser: vi.fn()
}));

describe('GET /api/admin/rekomendasi', () => {
  let mockRequest;
  
  beforeEach(() => {
    vi.clearAllMocks();
    const headersMap = new Map([['x-requester-role', 'admin']]);
    mockRequest = {
      url: 'http://localhost/api/admin/rekomendasi',
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

  it('harus mengembalikan semua data jika role adalah admin', async () => {
    const { getValidatedUser } = await import('@/lib/api-auth');
    getValidatedUser.mockReturnValue({ role: 'admin', user: {} });

    mockRenaksiFind.mockResolvedValue([
      { employeeId: 'emp-1', tahun: 2026, bulan: 1, statusRekomendasi: 'Menunggu Tindak Lanjut' }
    ]);
    mockEmployeeFind.mockResolvedValue([
      { id: 'emp-1', namaLengkap: 'Budi', jabatan: 'Staf', bidang: 'TI' }
    ]);

    const response = await GET(mockRequest);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].employeeName).toBe('Budi');
  });

  it('harus memfilter berdasarkan bidang jika role adalah admin_bidang', async () => {
    const { getValidatedUser } = await import('@/lib/api-auth');
    getValidatedUser.mockReturnValue({ role: 'admin_bidang', user: { bidang: 'Keuangan' } });

    mockRenaksiFind.mockResolvedValue([
      { employeeId: 'emp-1', tahun: 2026, bulan: 1, statusRekomendasi: 'Menunggu Tindak Lanjut' },
      { employeeId: 'emp-2', tahun: 2026, bulan: 1, statusRekomendasi: 'Menunggu Tindak Lanjut' }
    ]);
    mockEmployeeFind.mockResolvedValue([
      { id: 'emp-1', namaLengkap: 'Budi', jabatan: 'Staf', bidang: 'TI' },
      { id: 'emp-2', namaLengkap: 'Ani', jabatan: 'Kasubag', bidang: 'Keuangan' }
    ]);

    const response = await GET(mockRequest);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].employeeName).toBe('Ani');
  });
});
