'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useUI } from '@/context/UIContext';

export default function AdminMonitoringRekomendasiPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { activeRole } = useUI();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear().toString());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/rekomendasi?tahun=${filterTahun}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
      }
    } catch (e) {
      console.error('Failed to load rekomendasi', e);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, filterTahun]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasAccess = ['admin', 'perencana', 'admin_bidang'].includes(activeRole);

  if (!hasAccess) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa-solid fa-ban text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Akses Ditolak</h2>
        <p className="text-muted" style={{ marginTop: '8px' }}>Hanya Administrator, Admin Perencana, dan Admin Unit Kerja yang diperbolehkan mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3><i className="fa-solid fa-clipboard-question text-orange"></i> Monitoring Rekomendasi Kinerja</h3>
          <p className="text-muted">Pantau status teguran dan tindak lanjut rekomendasi pegawai.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Tahun:</label>
          <select 
            className="modern-select" 
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            style={{ minWidth: '100px', padding: '6px 12px', fontSize: '14px' }}
          >
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
            <option value="2028">2028</option>
          </select>
        </div>
      </div>
      <div className="panel-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <i className="fa-solid fa-circle-notch fa-spin"></i> Memuat data rekomendasi...
          </div>
        ) : data.length === 0 ? (
          <div className="empty-state">
            <i className="fa-regular fa-folder-open text-muted" style={{ fontSize: '32px', marginBottom: '12px' }}></i>
            <p>Tidak ada data rekomendasi / tindak lanjut pada tahun {filterTahun}.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Periode</th>
                  <th>Pegawai</th>
                  <th style={{ width: '80px' }}>Capaian</th>
                  <th>Rekomendasi Atasan</th>
                  <th style={{ width: '130px' }}>Status</th>
                  <th>Tindak Lanjut & Bukti</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => (
                  <tr key={item._id || idx}>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: '600' }}>Bulan {item.bulan}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>{item.tahun}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{item.employeeName}</div>
                      <div className="text-muted" style={{ fontSize: '12px' }}>{item.jabatan}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>{item.bidang}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${item.capaianBulanan < 100 ? 'badge-danger' : 'badge-success'}`}>
                        {item.capaianBulanan}%
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                        {item.rekomendasiAtasan}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.statusRekomendasi === 'Menunggu Tindak Lanjut' ? (
                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-regular fa-clock"></i> Pending
                        </span>
                      ) : item.statusRekomendasi === 'Selesai' ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-solid fa-check"></i> Selesai
                        </span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)' }}>{item.statusRekomendasi}</span>
                      )}
                    </td>
                    <td>
                      {item.tindakLanjutRekomendasi ? (
                         <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', marginBottom: '6px' }}>
                           {item.tindakLanjutRekomendasi}
                         </div>
                      ) : (
                         <span className="text-muted" style={{ fontStyle: 'italic', fontSize: '12px' }}>Belum ada tindak lanjut</span>
                      )}
                      
                      {item.buktiDukungTindakLanjut && (
                        <div>
                          <a href={item.buktiDukungTindakLanjut} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline" style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', padding: '4px 8px', fontSize: '11px' }}>
                            <i className="fa-solid fa-arrow-up-right-from-square"></i> Lihat Bukti
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
