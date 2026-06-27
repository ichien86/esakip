'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useSimulationInternal } from '@/context/SimulationInternalContext';
import { useUI } from '@/context/UIContext';

const formatLevel = (lvl) => {
  if (lvl === 'sasaran_program' || lvl === 'program') return 'Sasaran Program';
  if (lvl === 'sasaran_kegiatan' || lvl === 'kegiatan') return 'Sasaran Kegiatan';
  if (lvl === 'sasaran_subkegiatan' || lvl === 'subkegiatan') return 'Sasaran Subkegiatan';
  return lvl;
};

export default function DashboardPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { currentUser } = useSimulationInternal();
  const { activeRole, activeBidang, activeYear } = useUI();
  const [summaryData, setSummaryData] = useState([]);
  const [deactivatedWarnings, setDeactivatedWarnings] = useState([]);
  const [masterWarnings, setMasterWarnings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [activeMonthTargets, setActiveMonthTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/dashboard/summary');
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (e) {
      console.warn('Failed to load dashboard summary:', e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const fetchTasksAndTargets = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/dashboard/tasks');
      if (res.ok) {
        const data = await res.json();
        setPendingTasks(data.tasks || []);
        setActiveMonthTargets(data.activeMonthTargets || []);
      }
    } catch (e) {
      console.warn('Failed to fetch tasks and targets:', e.message);
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
      console.warn('Failed to fetch deactivated warnings:', e.message);
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
      console.warn('Failed to fetch master warnings:', e.message);
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
      console.warn('Failed to fetch notifications:', e.message);
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
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const timer = setTimeout(() => {
      fetchSummary();
      fetchWarnings();
      fetchMasterWarnings();
      fetchNotifications();
      fetchTasksAndTargets();
    }, 0);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [fetchSummary, fetchWarnings, fetchMasterWarnings, fetchNotifications, fetchTasksAndTargets]);

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
        <div style={{ color: 'var(--text-primary)', textAlign: 'center', marginTop: '40px' }}>
          <i className="fa-solid fa-circle-notch fa-spin"></i> Memuat dashboard...
        </div>
      ) : (
        <>
          {/* Actionable Tasks List */}
          {pendingTasks.length > 0 && (
            <div className="glass-panel" style={{
              background: 'rgba(255, 107, 0, 0.05)',
              border: '1px solid rgba(255, 107, 0, 0.25)',
              marginBottom: '24px',
              boxShadow: '0 0 15px rgba(255, 107, 0, 0.1)'
            }}>
              <div className="panel-header" style={{ borderBottom: '1px solid rgba(255, 107, 0, 0.15)' }}>
                <h3 style={{ color: 'var(--primary-orange)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-clipboard-list"></i>
                  Tugas Kinerja Anda
                </h3>
              </div>
              <div className="panel-body">
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Berikut adalah daftar tugas administrasi dan pelaporan kinerja yang memerlukan perhatian Anda untuk tahun {activeYear}:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendingTasks.map((task) => (
                    <div key={task.id} style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      padding: '14px 18px',
                      borderRadius: '8px',
                      border: `1px solid ${task.status === 'warning' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '16px'
                    }}>
                      <div style={{ flex: '1 1 350px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`badge ${task.status === 'warning' ? 'badge-draft' : 'badge-submitted'}`} style={{
                            background: task.status === 'warning' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                            color: task.status === 'warning' ? '#EF4444' : '#3B82F6',
                            border: `1px solid ${task.status === 'warning' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                            fontSize: '10px'
                          }}>
                            {task.status === 'warning' ? 'PENTING' : 'INFORMASI'}
                          </span>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{task.title}</strong>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', margin: '6px 0 0 0', lineHeight: '1.4' }}>
                          {task.description}
                        </p>
                      </div>
                      {task.actionUrl !== '#' && (
                        <div style={{ flex: '0 0 auto' }}>
                          <a 
                            href={task.actionUrl}
                            className={`btn btn-sm ${task.status === 'warning' ? 'btn-orange' : 'btn-secondary'}`}
                            style={{ 
                              padding: '8px 14px', 
                              fontSize: '12.5px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              textDecoration: 'none'
                            }}
                          >
                            {task.actionLabel}
                            <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px' }}></i>
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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
                        <p style={{ color: 'var(--text-primary)', fontSize: '13px', margin: '0 0 4px 0', lineHeight: '1.4' }}>{notif.message}</p>
                        <span className="text-muted" style={{ fontSize: '11px' }}>
                          Dibuat pada: {new Date(notif.createdAt).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div style={{ flex: '0 0 auto' }}>
                        <button 
                          className="btn btn-sm btn-secondary" 
                          onClick={() => handleMarkAsRead(notif.id)}
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.15)' }}
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
                          {formatLevel(warning.level)} ({warning.type === 'annual' ? 'Renja' : 'Renstra'})
                        </span>
                        
                        {/* Name Mismatch */}
                        {warning.hasNameMismatch && (
                          <div style={{ marginTop: '8px', fontSize: '12px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Nama Nomenklatur Berubah:</span>
                            <div style={{ color: '#EF4444', textDecoration: 'line-through', margin: '2px 0' }}>
                              Lama: {warning.nomenklatur || (['program', 'kegiatan', 'subkegiatan'].includes(warning.level) ? warning.text : '-')}
                            </div>
                            <div style={{ color: '#10B981', fontWeight: 'bold' }}>
                              Baru: {warning.masterNama}
                            </div>
                          </div>
                        )}

                        {/* Kinerja (Sasaran) Mismatch */}
                        {warning.hasKinerjaMismatch && (
                          <div style={{ marginTop: '8px', fontSize: '12px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Uraian Sasaran Kinerja Berubah:</span>
                            <div style={{ color: '#EF4444', textDecoration: 'line-through', margin: '2px 0' }}>
                              Lama: {warning.text}
                            </div>
                            <div style={{ color: '#10B981', fontWeight: 'bold' }}>
                              Baru: {warning.masterKinerja}
                            </div>
                          </div>
                        )}

                        {/* Indicator Mismatch */}
                        {warning.hasIndicatorMismatch && (
                          <div style={{ marginTop: '8px', fontSize: '12px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Indikator & Satuan Berubah:</span>
                            <div style={{ color: '#EF4444', textDecoration: 'line-through', margin: '2px 0' }}>
                              Lama: {warning.indikator} ({warning.satuan})
                            </div>
                            <div style={{ color: '#10B981', fontWeight: 'bold' }}>
                              Baru: {warning.masterIndikator} ({warning.masterSatuan})
                            </div>
                          </div>
                        )}

                        {/* Fallback for legacy data/warnings with no mismatch flags */}
                        {!warning.hasNameMismatch && !warning.hasKinerjaMismatch && !warning.hasIndicatorMismatch && (
                          <div style={{ marginTop: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#EF4444' }}>Data Saat Ini:</span>
                            <h4 style={{ fontSize: '13px', margin: '2px 0 6px 0', color: 'var(--text-primary)' }}>{warning.text}</h4>
                            <span style={{ fontSize: '11px', color: '#10B981' }}>Kamus Terbaru:</span>
                            <h4 style={{ fontSize: '13px', margin: '2px 0 0 0', color: 'var(--text-primary)', fontWeight: 'bold' }}>{warning.masterNama}</h4>
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
                        <h4 style={{ fontSize: '13px', margin: '4px 0 2px 0', color: 'var(--text-primary)' }}>{warning.indicatorText}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{warning.indicatorDetail}</p>
                      </div>
                      <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                        <div style={{ fontSize: '12px', color: '#EF4444', fontWeight: 'bold' }}>
                          Pengampu Nonaktif:
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
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
          
          {/* Active Month Targets Panel */}
          {activeMonthTargets.length > 0 && (
            <div className="glass-panel" style={{ marginTop: '24px' }}>
              <div className="panel-header">
                <h3>
                  <i className="fa-solid fa-calendar-check text-orange"></i> Target & Realisasi Kinerja Anda — {activeMonthTargets[0].bulanLabel} {activeYear}
                </h3>
                <p className="text-muted">
                  Berikut adalah target dan status realisasi bulanan Anda yang sedang aktif untuk tahun anggaran {activeYear}.
                </p>
              </div>
              <div className="panel-body">
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeMonthTargets.map((target, idx) => {
                      const getRealisasiStatusBadge = (status) => {
                        if (status === 'Disetujui' || status === 'ACC_Admin') return <span className="badge badge-finished">Disetujui</span>;
                        if (status === 'Diajukan' || status === 'Target_Diajukan') return <span className="badge badge-submitted">Menunggu Validasi</span>;
                        if (status === 'Draft') return <span className="badge badge-draft" style={{ background: 'rgba(255, 107, 0, 0.15)', color: 'var(--primary-orange)', border: '1px solid rgba(255, 107, 0, 0.3)' }}>Draft</span>;
                        return <span className="badge badge-none">Belum Diisi</span>;
                      };

                      return (
                        <div key={idx} style={{
                          background: 'rgba(15, 23, 42, 0.4)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '8px',
                          padding: '14px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '13.5px', lineHeight: '1.4' }}>{target.indikator}</strong>
                            {getRealisasiStatusBadge(target.status)}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--glass-border)' }}>
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Bulanan</div>
                              <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{target.target} {target.satuan}</strong>
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Realisasi</div>
                              <strong style={{ color: target.realisasi !== null ? 'white' : 'var(--text-muted)', fontSize: '13px' }}>
                                {target.realisasi !== null ? `${target.realisasi} ${target.satuan}` : '-'}
                              </strong>
                            </div>
                            <div>
                              {['Disetujui', 'ACC_Admin'].includes(target.status) ? (
                                <span style={{ fontSize: '11.5px', color: 'var(--success)' }}>
                                  <i className="fa-solid fa-circle-check"></i> Selesai
                                </span>
                              ) : (
                                <a 
                                  href="/employee/realisasi" 
                                  className="btn btn-sm btn-orange"
                                  style={{ padding: '6px 10px', fontSize: '11.5px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <i className="fa-solid fa-pen-to-square"></i>
                                  Isi
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Uraian Indikator Kinerja</th>
                          <th style={{ textAlign: 'center' }}>Target Bulanan</th>
                          <th style={{ textAlign: 'center' }}>Realisasi Bulanan</th>
                          <th style={{ textAlign: 'center' }}>Status Laporan</th>
                          <th style={{ textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMonthTargets.map((target, idx) => {
                          const getRealisasiStatusBadge = (status) => {
                            if (status === 'Disetujui' || status === 'ACC_Admin') return <span className="badge badge-finished">Disetujui</span>;
                            if (status === 'Diajukan' || status === 'Target_Diajukan') return <span className="badge badge-submitted">Menunggu Validasi</span>;
                            if (status === 'Draft') return <span className="badge badge-draft" style={{ background: 'rgba(255, 107, 0, 0.15)', color: 'var(--primary-orange)', border: '1px solid rgba(255, 107, 0, 0.3)' }}>Draft</span>;
                            return <span className="badge badge-none">Belum Diisi</span>;
                          };

                          return (
                            <tr key={idx}>
                              <td>
                                <strong style={{ color: 'var(--text-primary)' }}>{target.indikator}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  Satuan: {target.satuan}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {target.target} {target.satuan}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: target.realisasi !== null ? 'white' : 'var(--text-muted)' }}>
                                {target.realisasi !== null ? `${target.realisasi} ${target.satuan}` : '-'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {getRealisasiStatusBadge(target.status)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {['Disetujui', 'ACC_Admin'].includes(target.status) ? (
                                  <span style={{ fontSize: '12px', color: 'var(--success)' }}>
                                    <i className="fa-solid fa-circle-check"></i> Selesai
                                  </span>
                                ) : (
                                  <a 
                                    href="/employee/realisasi" 
                                    className="btn btn-sm btn-orange"
                                    style={{ padding: '4px 10px', fontSize: '11.5px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                    Isi Realisasi
                                  </a>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

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
