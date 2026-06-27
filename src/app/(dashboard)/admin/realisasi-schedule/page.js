'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useUI } from '@/context/UIContext';

export default function AdminRealisasiSchedulePage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { activeRole, activeYear } = useUI();
  const [schedules, setSchedules] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasAccess = activeRole === 'admin' || activeRole === 'perencana';

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(`/api/admin/settings/realisasi-schedule?tahun=${activeYear}`);
      if (res.ok) {
        setSchedules(await res.json());
      } else {
        setError('Gagal memuat jadwal realisasi.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  }, [activeYear]);

  useEffect(() => {
    if (hasAccess) {
      const timer = setTimeout(() => {
        loadSchedules();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [hasAccess, loadSchedules]);

  const handleToggleLock = (idx) => {
    const updated = [...schedules];
    updated[idx].isLocked = !updated[idx].isLocked;
    setSchedules(updated);
  };

  const handleDeadlineChange = (idx, val) => {
    const updated = [...schedules];
    updated[idx].deadline = val;
    setSchedules(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/settings/realisasi-schedule', {
        method: 'POST',
        body: JSON.stringify({
          schedules,
          requesterRole: activeRole
        })
      });
      if (res.ok) {
        setSuccess(`Jadwal pengisian realisasi tahun ${activeYear} berhasil disimpan.`);
        loadSchedules();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan jadwal.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa-solid fa-ban text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Akses Ditolak</h2>
        <p className="text-muted" style={{ marginTop: '8px' }}>Hanya Administrator Sistem atau Admin Perencana yang diperbolehkan mengelola jadwal realisasi bulanan.</p>
      </div>
    );
  }

  return (
    <section>
      <div className="glass-panel" style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
        <div className="panel-header">
          <h3>
            <i className="fa-solid fa-calendar-check text-orange"></i>
            Jadwal Pengisian Realisasi Bulanan - Tahun {activeYear}
          </h3>
        </div>
        <div className="panel-body">
          {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
          {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

          <p className="text-muted" style={{ fontSize: '13px', marginBottom: '20px' }}>
            Kunci akses pengisian realisasi bulanan bagi pegawai untuk menjamin ketertiban pelaporan. Bulan yang diset <strong>Kunci Pengisian</strong> akan memblokir penyimpanan realisasi, bukti dukung, kendala, dan solusi dari sisi staf.
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <i className="fa-solid fa-circle-notch fa-spin"></i> Memuat jadwal...
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="table-responsive">
                <table className="table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Bulan</th>
                      <th style={{ textAlign: 'center', width: '150px' }}>Status Akses</th>
                      <th>Batas Pengisian (Deadline)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((sch, idx) => (
                      <tr key={idx} style={{ background: sch.isLocked ? 'rgba(239,68,68,0.02)' : '' }}>
                        <td>
                          <strong>{monthNames[sch.bulan - 1]}</strong>
                          <div className="text-muted" style={{ fontSize: '11px' }}>Bulan {sch.bulan} / {activeYear}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${sch.isLocked ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => handleToggleLock(idx)}
                            style={{
                              width: '120px',
                              background: sch.isLocked ? '#EF4444' : '#10B981',
                              borderColor: sch.isLocked ? '#EF4444' : '#10B981',
                              color: 'white',
                              fontWeight: 600
                            }}
                          >
                            {sch.isLocked ? (
                              <><i className="fa-solid fa-lock mr-2"></i> Terkunci</>
                            ) : (
                              <><i className="fa-solid fa-lock-open mr-2"></i> Terbuka</>
                            )}
                          </button>
                        </td>
                        <td>
                          <input
                            type="date"
                            className="form-control"
                            style={{ width: '180px', padding: '6px' }}
                            value={sch.deadline || ''}
                            onChange={(e) => handleDeadlineChange(idx, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '24px' }}>
                <button type="submit" className="btn btn-orange" disabled={isSaving} style={{ width: 'auto' }}>
                  {isSaving ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Menyimpan...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-save mr-2"></i> Simpan Jadwal Realisasi {activeYear}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
