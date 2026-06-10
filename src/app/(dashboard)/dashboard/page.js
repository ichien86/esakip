'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function DashboardPage() {
  const { fetchWithAuth, currentUser, activeRole, activeBidang, activeYear } = useSimulation();
  const [summaryData, setSummaryData] = useState([]);
  const [deactivatedWarnings, setDeactivatedWarnings] = useState([]);
  const [masterWarnings, setMasterWarnings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/dashboard/summary');
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (e) {
      console.error('Failed to load dashboard summary', e);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const fetchWarnings = useCallback(async () => {
    if (!['admin', 'admin_bidang', 'perencana'].includes(activeRole)) {
      setDeactivatedWarnings([]);
      return;
    }
    try {
      const res = await fetchWithAuth('/api/admin/deactivated-warnings');
      if (res.ok) {
        const data = await res.json();
        setDeactivatedWarnings(data);
      }
    } catch (e) {
      console.error('Failed to fetch deactivated warnings', e);
    }
  }, [activeRole, fetchWithAuth]);

  const fetchMasterWarnings = useCallback(async () => {
    if (!['admin', 'admin_bidang', 'perencana'].includes(activeRole)) {
      setMasterWarnings([]);
      return;
    }
    try {
      const res = await fetchWithAuth('/api/admin/master-warnings');
      if (res.ok) {
        const data = await res.json();
        setMasterWarnings(data);
      }
    } catch (e) {
      console.error('Failed to fetch master warnings', e);
    }
  }, [activeRole, fetchWithAuth]);

  const fetchNotifications = useCallback(async () => {
    if (!['admin', 'admin_bidang', 'perencana', 'pemimpin'].includes(activeRole)) {
      setNotifications([]);
      return;
    }
    try {
      const res = await fetchWithAuth('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  }, [activeRole, fetchWithAuth]);

  const handleMarkAsRead = async (id) => {
    try {
      const res = await fetchWithAuth('/api/notifications', {
        method: 'PUT',
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menandai notifikasi sebagai dibaca.');
      }
    } catch (e) {
      alert('Kesalahan jaringan.');
    }
  };

  const handleSyncMaster = async (warning) => {
    try {
      const res = await fetchWithAuth('/api/admin/master-warnings', {
        method: 'POST',
        body: JSON.stringify({
          nodeId: warning.nodeId,
          type: warning.type,
          requesterRole: activeRole
        })
      });
      if (res.ok) {
        alert('Data cascading berhasil disinkronkan dengan data master terbaru.');
        fetchMasterWarnings();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menyinkronkan data.');
      }
    } catch (e) {
      alert('Kesalahan jaringan saat sinkronisasi.');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSummary();
      fetchWarnings();
      fetchMasterWarnings();
      fetchNotifications();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSummary, fetchWarnings, fetchMasterWarnings, fetchNotifications]);

  const participants = summaryData.filter(emp => emp.id !== 'admin');
  const totalEmployees = participants.length;
  const evaluatedCount = participants.filter(emp => emp.status === 'Selesai').length;
  
  const totalScore = participants
    .filter(emp => emp.status === 'Selesai' && emp.skorAKIP !== null)
    .reduce((sum, emp) => sum + emp.skorAKIP, 0);
  const averageScore = evaluatedCount > 0 ? (totalScore / evaluatedCount).toFixed(1) : '0.0';

  const getStatusBadge = (status) => {
    if (status === 'Selesai') return <span className="badge badge-finished">Selesai Dievaluasi</span>;
    if (status === 'Draft') return <span className="badge badge-submitted">Draft Usulan</span>;
    return <span className="badge badge-none">Belum Mengisi</span>;
  };

  return (
    <section>
      {loading ? (
        <div style={{ color: 'white', textAlign: 'center', marginTop: '40px' }}>
          <i className="fa-solid fa-circle-notch fa-spin"></i> Memuat dashboard...
        </div>
      ) : (
        <>
          {/* Unassigned Performance Indicator Notifications */}
          {notifications.length > 0 && (
            <div className="glass-panel" style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              marginBottom: '24px',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.15)'
            }}>
              <div className="panel-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h3 style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  Pemberitahuan: Indikator Kehilangan Penanggung Jawab
                </h3>
              </div>
              <div className="panel-body">
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Terdapat indikator kinerja yang kehilangan penanggung jawab di unit kerja Anda karena pegawai bersangkutan pindah unit kerja.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notifications.map((notif, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(15, 23, 42, 0.4)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.15)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ flex: '1 1 300px' }}>
                        <p style={{ color: 'white', fontSize: '13px', margin: '0 0 4px 0', lineHeight: '1.4' }}>{notif.message}</p>
                        <span className="text-muted" style={{ fontSize: '11px' }}>
                          Dibuat pada: {new Date(notif.createdAt).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div style={{ flex: '0 0 auto' }}>
                        <button 
                          className="btn btn-sm btn-secondary" 
                          onClick={() => handleMarkAsRead(notif.id)}
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
                        >
                          Tandai Dibaca
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Master Data Mismatch Warnings */}
          {masterWarnings.length > 0 && (
            <div className="glass-panel" style={{
              background: 'rgba(255, 107, 0, 0.1)',
              border: '1px solid rgba(255, 107, 0, 0.3)',
              marginBottom: '24px',
              boxShadow: '0 0 15px rgba(255, 107, 0, 0.15)'
            }}>
              <div className="panel-header" style={{ borderBottom: '1px solid rgba(255, 107, 0, 0.2)' }}>
                <h3 style={{ color: 'var(--primary-orange)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-arrows-rotate"></i>
                  Pembaruan Kamus Data Master Terdeteksi
                </h3>
              </div>
              <div className="panel-body">
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Ada data master yang telah diubah di kamus data, tetapi data cascading perencanaan Anda belum diperbarui. 
                  Silakan mutakhirkan node berikut agar sinkron dengan kamus data.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {masterWarnings.map((warning, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(15, 23, 42, 0.4)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 107, 0, 0.15)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ flex: '1 1 300px' }}>
                        <span className="badge" style={{ fontSize: '9px', textTransform: 'uppercase', background: 'rgba(255, 107, 0, 0.2)', color: 'var(--primary-orange)', padding: '2px 6px', borderRadius: '4px' }}>
                          {warning.level} ({warning.type === 'annual' ? 'Indikator Renja' : 'Indikator Renstra'})
                        </span>
                        
                        <div style={{ marginTop: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#EF4444' }}>Data Saat Ini:</span>
                          <h4 style={{ fontSize: '13px', margin: '2px 0 6px 0', color: 'white' }}>{warning.text}</h4>
                          {warning.masterNama && (
                            <>
                              <span style={{ fontSize: '11px', color: '#10B981' }}>Kamus Terbaru:</span>
                              <h4 style={{ fontSize: '13px', margin: '2px 0 0 0', color: 'white', fontWeight: 'bold' }}>{warning.masterNama}</h4>
                            </>
                          )}
                        </div>

                        {warning.masterIndikator && (warning.indikator !== warning.masterIndikator || warning.satuan !== warning.masterSatuan) && (
                          <div style={{ marginTop: '6px', fontSize: '12px' }}>
                            <div style={{ color: 'var(--text-muted)' }}>
                              Indikator lama: {warning.indikator} ({warning.satuan})
                            </div>
                            <div style={{ color: 'var(--primary-orange)', fontWeight: 'bold' }}>
                              Indikator baru: {warning.masterIndikator} ({warning.masterSatuan})
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ flex: '0 0 auto' }}>
                        <button 
                          className="btn btn-sm btn-orange" 
                          onClick={() => handleSyncMaster(warning)}
                          style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <i className="fa-solid fa-arrows-rotate"></i>
                          Mutakhirkan
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Warnings Panel */}
          {deactivatedWarnings.length > 0 && (
            <div className="glass-panel" style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              marginBottom: '24px',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.15)'
            }}>
              <div className="panel-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h3 style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  Peringatan: Pengampu Indikator Dinonaktifkan
                </h3>
              </div>
              <div className="panel-body">
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Berikut adalah daftar indikator {activeRole === 'admin_bidang' ? `di bidang Anda (${activeBidang})` : ''} yang memiliki pengampu/penanggung jawab yang saat ini berstatus <strong>Nonaktif</strong>. 
                  Silakan koordinasikan dengan Admin Perencana untuk menugaskan kembali indikator ini.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {deactivatedWarnings.map((warning, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(15, 23, 42, 0.4)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.15)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ flex: '1 1 300px' }}>
                        <span className="badge badge-draft" style={{ fontSize: '9px', textTransform: 'uppercase', background: 'rgba(255, 107, 0, 0.2)', color: 'var(--primary-orange)', border: '1px solid rgba(255, 107, 0, 0.3)' }}>
                          {warning.indicatorLevel}
                        </span>
                        <h4 style={{ fontSize: '13px', margin: '4px 0 2px 0', color: 'white' }}>{warning.indicatorText}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{warning.indicatorDetail}</p>
                      </div>
                      <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                        <div style={{ fontSize: '12px', color: '#EF4444', fontWeight: 'bold' }}>
                          Pengampu Nonaktif:
                        </div>
                        <div style={{ fontSize: '13px', color: 'white' }}>
                          {warning.employeeNama}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {warning.employeeJabatan}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon bg-orange"><i className="fa-solid fa-users"></i></div>
              <div className="stat-info">
                <h3>{totalEmployees}</h3>
                <p>Total Pegawai BPBD</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon bg-blue"><i className="fa-solid fa-circle-check"></i></div>
              <div className="stat-info">
                <h3>{evaluatedCount} / {totalEmployees}</h3>
                <p>Sudah Dievaluasi</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon bg-green"><i className="fa-solid fa-award"></i></div>
              <div className="stat-info">
                <h3>{averageScore}</h3>
                <p>Rata-rata Skor AKIP</p>
              </div>
            </div>
          </div>

          {/* Leaderboard/Summary panel */}
          <div className="glass-panel" style={{ marginTop: '24px' }}>
            <div className="panel-header">
              <h3>
                <i className="fa-solid fa-ranking-star text-orange"></i> Rekapitulasi Capaian Kinerja BPBD {activeYear}
              </h3>
            </div>
            <div className="panel-body">
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama Pegawai</th>
                      <th>Jabatan</th>
                      <th>Bidang</th>
                      <th>Status Evaluasi</th>
                      <th style={{ textAlign: 'center' }}>Skor AKIP</th>
                      <th style={{ textAlign: 'center' }}>Predikat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada data pegawai</td>
                      </tr>
                    ) : (
                      participants.map(emp => (
                        <tr key={emp.id}>
                          <td><strong>{emp.nama}</strong></td>
                          <td>{emp.jabatan}</td>
                          <td>{emp.bidang || 'Pimpinan'}</td>
                          <td>{getStatusBadge(emp.status)}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {emp.skorAKIP !== null ? emp.skorAKIP.toFixed(2) : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {emp.predikat ? (
                              <span className="badge badge-score">{emp.predikat}</span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
