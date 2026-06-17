'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSimulation } from '@/context/SimulationContext';
import DocumentPreviewModal from '@/components/DocumentPreviewModal';
import { parseBuktiDukung } from '@/utils/linkPreview';

export default function SupervisorEvaluationPage() {
  const { fetchWithAuth, currentUser, activeRole, activeYear, allEmployees } = useSimulation();

  const [subordinates, setSubordinates] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  
  // Reported Renaksis requiring review
  const [subRenaksis, setSubRenaksis] = useState([]);
  const [annualNodes, setAnnualNodes] = useState([]);

  // Final Evaluation Form
  const [skorAKIP, setSkorAKIP] = useState('');
  const [catatan, setCatatan] = useState('');
  const [perfRecord, setPerfRecord] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  // Document Preview State
  const [previewUrl, setPreviewUrl] = useState('');

  const isSupervisor = ['admin_bidang', 'pemimpin'].includes(activeRole);

  const [pendingTargets, setPendingTargets] = useState([]);
  const [pendingRealisasis, setPendingRealisasis] = useState([]);
  const [kabidLoading, setKabidLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('targets'); // 'targets' | 'realisations'
  const [evalMode, setEvalMode] = useState('validation'); // 'validation' | 'akip' for Pemimpin

  const loadValidationItems = useCallback(async () => {
    if (!currentUser) return;
    setKabidLoading(true);
    try {
      let subs = [];
      if (activeRole === 'admin_bidang') {
        const supervisorId = currentUser.parentId;
        if (supervisorId) {
          subs = allEmployees.filter(emp => 
            emp.parentId === supervisorId && 
            emp.id !== currentUser.id && 
            emp.isActive !== false &&
            emp.bidangs.some(b => currentUser.bidangs.includes(b))
          );
        }
      } else if (activeRole === 'pemimpin') {
        subs = allEmployees.filter(emp => {
          if (emp.id === currentUser.id) return false;
          if (currentUser.bidangs.includes('Badan') || currentUser.scopeLeader === 'Badan') return true;
          return emp.bidangs.some(b => currentUser.bidangs.includes(b));
        });
      }

      const subIds = subs.map(s => s.id);
      if (subIds.length === 0) {
        setPendingTargets([]);
        setPendingRealisasis([]);
        setKabidLoading(false);
        return;
      }

      const allTargets = [];
      const allRealisasis = [];

      const nodesRes = await fetchWithAuth(`/api/renja/${activeYear}`);
      const allNodes = nodesRes.ok ? await nodesRes.json() : [];

      const allSubRenaksis = [];
      const subRenaksisMap = {};

      for (let sub of subs) {
        const rxRes = await fetchWithAuth(`/api/renaksi/${sub.id}/${activeYear}`);
        if (rxRes.ok) {
          const rxData = await rxRes.json();
          subRenaksisMap[sub.id] = rxData;
          allSubRenaksis.push(...rxData);
        }
      }

      for (let sub of subs) {
        const rxData = subRenaksisMap[sub.id] || [];
        
        // Target validation
        const subPendingTargets = rxData.filter(r => ['Target_Diajukan', 'Target_ACC_Admin'].includes(r.status));
        const groupedByIndicator = {};
        subPendingTargets.forEach(r => {
          if (!groupedByIndicator[r.indicatorId]) {
            groupedByIndicator[r.indicatorId] = [];
          }
          groupedByIndicator[r.indicatorId].push(r);
        });

        Object.keys(groupedByIndicator).forEach(indicatorId => {
          const records = groupedByIndicator[indicatorId];
          const node = allNodes.find(n => n.id === indicatorId);
          const targetStatus = records[0]?.status || 'Target_Diajukan';
          const monthlyTargetsStr = records.map(r => `B${r.bulan}: ${r.targetBulanan}`).join(', ');

          const totalTargetAllSubs = allSubRenaksis
            .filter(r => r.indicatorId === indicatorId)
            .reduce((sum, r) => sum + (r.targetBulanan || 0), 0);

          allTargets.push({
            employeeId: sub.id,
            employeeNama: sub.nama,
            employeeJabatan: sub.jabatan,
            bidang: sub.bidangs[0] || '',
            indicatorId,
            indicatorText: node ? node.text : 'Indikator',
            indicatorName: node ? node.indikator : 'Indikator',
            indicatorSatuan: node ? node.satuan : '',
            indicatorLevel: node ? node.level : '',
            yearlyTarget: node ? node.target : '0',
            monthlyTargetsStr,
            records,
            crossCuttingType: node ? node.crossCuttingType : 'shared',
            totalTargetAllSubs,
            status: targetStatus,
            isCrossCuttingSelected: records[0]?.isCrossCuttingSelected !== false
          });
        });

        // Realisasi validation
        const subPendingRealisasis = rxData.filter(r => ['Diajukan', 'ACC_Admin'].includes(r.status));
        subPendingRealisasis.forEach(r => {
          const node = allNodes.find(n => n.id === r.indicatorId);
          allRealisasis.push({
            id: r.id,
            employeeId: sub.id,
            employeeNama: sub.nama,
            employeeJabatan: sub.jabatan,
            bidang: sub.bidangs[0] || '',
            indicatorId: r.indicatorId,
            indicatorText: node ? node.text : 'Indikator',
            indicatorName: node ? node.indikator : 'Indikator',
            indicatorSatuan: node ? node.satuan : '',
            metodePenghitungan: node ? node.metodePenghitungan : 'Jumlah',
            bulan: r.bulan,
            targetBulanan: r.targetBulanan,
            realisasiBulanan: r.realisasiBulanan,
            buktiDukung: r.buktiDukung,
            kendala: r.kendala,
            solusi: r.solusi,
            faktorPendorong: r.faktorPendorong,
            inovasi: r.inovasi,
            variabelJumlahVal: r.variabelJumlahVal,
            variabelPembilangVal: r.variabelPembilangVal,
            variabelPenyebutVal: r.variabelPenyebutVal,
            status: r.status,
            isCrossCuttingSelected: r.isCrossCuttingSelected !== false
          });
        });
      }

      setPendingTargets(allTargets);
      setPendingRealisasis(allRealisasis);
    } catch (e) {
      console.error('Failed to load validation items', e);
    } finally {
      setKabidLoading(false);
    }
  }, [currentUser, activeRole, activeYear, allEmployees, fetchWithAuth]);

  useEffect(() => {
    if (isSupervisor) {
      const timer = setTimeout(() => {
        loadValidationItems();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isSupervisor, loadValidationItems]);

  const handleApproveTarget = async (employeeId, indicatorId, empName) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth('/api/renaksi/target/approve', {
        method: 'POST',
        body: JSON.stringify({ employeeId, indicatorId })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(`Rencana target bulanan untuk ${empName} berhasil di-update (${data.nextStatus}).`);
        loadValidationItems();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyetujui target.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const handleApproveRealisasi = async (id, empName, bulan) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth('/api/renaksi/approve', {
        method: 'POST',
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(`Realisasi bulan ${bulan} untuk ${empName} berhasil di-update (${data.data.status}).`);
        loadValidationItems();
        if (selectedSub) {
          handleSelectSub(selectedSub);
        }
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyetujui realisasi.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const loadSubordinates = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Pemimpin only evaluates direct subordinates (where parentId matches currentUser id)
      let subs = [];
      if (activeRole === 'pemimpin') {
        subs = allEmployees.filter(emp => emp.parentId === currentUser.id && emp.isActive !== false);
      }
      setSubordinates(subs);

      // Load all Renja indicators for details lookup
      const nodesRes = await fetchWithAuth(`/api/renja/${activeYear}`);
      if (nodesRes.ok) {
        setAnnualNodes(await nodesRes.json());
      }
    } catch (e) {
      console.error('Failed to load subordinate list', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser, activeRole, activeYear, allEmployees, fetchWithAuth]);

  useEffect(() => {
    if (isSupervisor) {
      const timer = setTimeout(() => {
        loadSubordinates();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isSupervisor, loadSubordinates]);

  // Load details when a subordinate is selected
  const handleSelectSub = async (sub) => {
    setSelectedSub(sub);
    setError('');
    setSuccess('');
    setSkorAKIP('');
    setCatatan('');
    setPerfRecord(null);

    try {
      // 1. Fetch Renaksi
      const rxRes = await fetchWithAuth(`/api/renaksi/${sub.id}/${activeYear}`);
      if (rxRes.ok) {
        const rxData = await rxRes.json();
        // Filter those submitted (ACC_Admin) for Pemimpin's validation
        setSubRenaksis(rxData.filter(r => r.status === 'ACC_Admin'));
      }

      // 2. Fetch Performance Evaluation Sheet
      const perfRes = await fetchWithAuth(`/api/performance/${sub.id}/${activeYear}`);
      if (perfRes.ok) {
        const perfData = await perfRes.json();
        setPerfRecord(perfData);
        if (perfData.evaluasiAtasan && perfData.evaluasiAtasan.skorAKIP !== null) {
          setSkorAKIP(perfData.evaluasiAtasan.skorAKIP.toString());
          setCatatan(perfData.evaluasiAtasan.catatan || '');
        }
      }
    } catch (e) {
      console.error('Failed to load subordinate performance details', e);
    }
  };

  const handleSubmitEvaluation = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedSub) return;
    const scoreVal = parseFloat(skorAKIP);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
      setError('Skor AKIP wajib bernilai antara 0 - 100.');
      return;
    }

    try {
      const res = await fetchWithAuth('/api/performance/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: selectedSub.id,
          tahun: activeYear,
          evaluatorId: currentUser.id,
          skorAKIP: scoreVal,
          catatan
        })
      });

      if (res.ok) {
        setSuccess('Evaluasi akhir AKIP berhasil disimpan.');
        handleSelectSub(selectedSub);
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan evaluasi.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  if (!isSupervisor) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa-solid fa-ban text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Akses Ditolak</h2>
        <p className="text-muted" style={{ marginTop: '8px' }}>Hanya pejabat penilai (atasan langsung) yang diperbolehkan mengakses halaman evaluasi bawahan.</p>
      </div>
    );
  }

  const getPredikatLabel = (score) => {
    if (score >= 90) return 'AA';
    if (score >= 80) return 'A';
    if (score >= 70) return 'BB';
    if (score >= 60) return 'B';
    if (score >= 50) return 'CC';
    if (score >= 30) return 'C';
    return 'D';
  };

  return (
    <section>
      {/* Tab Switcher for Pemimpin to choose between Validation Dashboard and AKIP evaluation */}
      {activeRole === 'pemimpin' && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button
            className={`btn ${evalMode === 'validation' ? 'btn-orange' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
            onClick={() => setEvalMode('validation')}
          >
            <i className="fa-solid fa-user-check"></i> Validasi Usulan Kinerja
          </button>
          <button
            className={`btn ${evalMode === 'akip' ? 'btn-orange' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
            onClick={() => setEvalMode('akip')}
          >
            <i className="fa-solid fa-gavel"></i> Penilaian Akhir AKIP-I Bawahan
          </button>
        </div>
      )}

      {/* 1. Validation Dashboard Mode */}
      {(activeRole === 'admin_bidang' || (activeRole === 'pemimpin' && evalMode === 'validation')) && (
        <div className="glass-panel">
          <div className="panel-header justify-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3>
                <i className="fa-solid fa-user-check text-orange"></i>{' '}
                {activeRole === 'pemimpin' ? `Dashboard Validasi Pemimpin (${currentUser.scopeLeader || 'Badan'})` : 'Dashboard Validasi Admin Unit Kerja'}
              </h3>
              <p className="text-muted">
                {activeRole === 'pemimpin'
                  ? 'Gunakan perangkat seluler atau desktop untuk memvalidasi Rencana Aksi (Renaksi) dan Realisasi bawahan Anda.'
                  : 'Gunakan perangkat seluler atau desktop untuk melakukan ACC Rencana Aksi (Renaksi) dan Realisasi bawahan unit kerja Anda.'}
              </p>
            </div>
            
            {/* Tabs Selector */}
            <div style={{ display: 'flex', gap: '8px', background: 'rgba(15,23,42,0.4)', padding: '4px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <button
                className={`btn btn-sm ${activeTab === 'targets' ? 'btn-orange' : 'btn-secondary'}`}
                style={{ border: 'none', padding: '6px 14px', fontSize: '12px', width: 'auto' }}
                onClick={() => setActiveTab('targets')}
              >
                <i className="fa-solid fa-list-check"></i> Target Renaksi ({pendingTargets.length})
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'realisations' ? 'btn-orange' : 'btn-secondary'}`}
                style={{ border: 'none', padding: '6px 14px', fontSize: '12px', width: 'auto' }}
                onClick={() => setActiveTab('realisations')}
              >
                <i className="fa-solid fa-circle-play"></i> Realisasi Kinerja ({pendingRealisasis.length})
              </button>
            </div>
          </div>

          <div className="panel-body">
            {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
            {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

            {kabidLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <i className="fa-solid fa-circle-notch fa-spin"></i> Memuat usulan validasi...
              </div>
            ) : activeTab === 'targets' ? (
              // Tab Targets
              pendingTargets.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  Tidak ada usulan target renaksi yang perlu diproses.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {pendingTargets.map((item, idx) => {
                    const isActionable = activeRole === 'admin_bidang'
                      ? item.status === 'Target_Diajukan'
                      : item.status === 'Target_ACC_Admin';

                    const buttonText = activeRole === 'admin_bidang'
                      ? (item.status === 'Target_ACC_Admin' ? 'Telah di-ACC Admin' : 'ACC Target')
                      : (item.status === 'Target_Disetujui' ? 'Disetujui Pemimpin' : 'Validasi Target');

                    return (
                      <div key={idx} className="glass-panel" style={{
                        margin: 0,
                        border: `1px solid ${item.status === 'Target_ACC_Admin' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 107, 0, 0.2)'}`,
                        background: 'rgba(255, 255, 255, 0.02)',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                        width: '100%'
                      }}>
                        <div className="panel-header" style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--glass-border)',
                          background: 'rgba(255, 107, 0, 0.03)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'
                        }}>
                          <div>
                            <h4 style={{ fontSize: '14px', color: 'white', margin: 0 }}>{item.employeeNama}</h4>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.employeeJabatan} ({item.bidang})</span>
                          </div>
                          <span className="badge" style={{ fontSize: '9px', background: 'rgba(255, 107, 0, 0.15)', color: 'var(--primary-orange)', border: '1px solid rgba(255, 107, 0, 0.3)', width: 'auto' }}>
                            {item.indicatorLevel}
                          </span>
                        </div>
                        <div className="panel-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--primary-orange)', fontWeight: 600 }}>Indikator:</label>
                            <p style={{ fontSize: '12px', color: 'white', margin: '2px 0 0 0', fontWeight: 'bold' }}>{item.indicatorName}</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{item.indicatorText}</p>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '20px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Target Tahunan</span>
                              <strong style={{ fontSize: '13px', color: 'white' }}>{item.yearlyTarget} {item.indicatorSatuan}</strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Target Terbagi</span>
                              <strong style={{ fontSize: '13px', color: 'white' }}>
                                {item.records.reduce((sum, r) => sum + r.targetBulanan, 0)} {item.indicatorSatuan}
                              </strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Status Badge */}
                            {item.status === 'Target_Diajukan' && <span className="badge" style={{ fontSize: '10px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', width: 'auto' }}><i className="fa-solid fa-clock"></i> Diajukan Staf</span>}
                            {item.status === 'Target_ACC_Admin' && <span className="badge" style={{ fontSize: '10px', background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)', width: 'auto' }}><i className="fa-solid fa-circle-check"></i> ACC Admin Unit Kerja</span>}
                            {item.status === 'Target_Disetujui' && <span className="badge" style={{ fontSize: '10px', background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', width: 'auto' }}><i className="fa-solid fa-circle-check"></i> Disetujui Pemimpin</span>}

                            {/* Cross-cutting badge */}
                            {item.totalTargetAllSubs > 0 && item.crossCuttingType === 'shared' && (
                              <span className="badge" style={{
                                fontSize: '10px',
                                background: item.isCrossCuttingSelected ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                                color: item.isCrossCuttingSelected ? '#10B981' : '#94A3B8',
                                border: `1px solid ${item.isCrossCuttingSelected ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.3)'}`,
                                width: 'auto'
                              }}>
                                <i className="fa-solid fa-share-nodes"></i> {item.isCrossCuttingSelected ? 'Capaian Resmi' : 'Tidak Digunakan'}
                              </span>
                            )}
                          </div>

                          {item.crossCuttingType === 'split' && (
                            <div style={{
                              background: Math.abs(item.totalTargetAllSubs - parseFloat(item.yearlyTarget)) < 0.05 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                              border: `1px solid ${Math.abs(item.totalTargetAllSubs - parseFloat(item.yearlyTarget)) < 0.05 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              padding: '10px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              lineHeight: '1.4',
                              color: Math.abs(item.totalTargetAllSubs - parseFloat(item.yearlyTarget)) < 0.05 ? '#10B981' : '#EF4444'
                            }}>
                              <i className={Math.abs(item.totalTargetAllSubs - parseFloat(item.yearlyTarget)) < 0.05 ? "fa-solid fa-circle-check" : "fa-solid fa-triangle-exclamation"} style={{ marginRight: '6px' }}></i>
                              Kolaborasi: <strong>Split (Dipecah)</strong>
                              <br />
                              Total target seluruh pengampu: <strong>{item.totalTargetAllSubs}</strong> dari target tahunan <strong>{item.yearlyTarget}</strong>.
                              {Math.abs(item.totalTargetAllSubs - parseFloat(item.yearlyTarget)) >= 0.05 && (
                                <div style={{ marginTop: '4px', fontWeight: 'bold' }}>
                                  Peringatan: Jumlah target pengampu ({item.totalTargetAllSubs}) tidak sama dengan target indikator ({item.yearlyTarget})!
                                </div>
                              )}
                            </div>
                          )}

                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rincian Target Bulanan (Jan-Des):</label>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(4, 1fr)',
                              gap: '4px',
                              marginTop: '4px',
                              background: 'rgba(255,255,255,0.01)',
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--glass-border)'
                            }}>
                              {item.records.sort((a,b) => a.bulan - b.bulan).map(r => (
                                <div key={r.bulan} style={{ fontSize: '11px', textAlign: 'center', color: 'white', background: 'rgba(0,0,0,0.15)', padding: '2px', borderRadius: '4px' }}>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '9px', display: 'block' }}>B{r.bulan}</span>
                                  <strong>{r.targetBulanan}</strong>
                                </div>
                              ))}
                            </div>
                          </div>

                          <button
                            className="btn btn-orange w-full"
                            style={{
                              marginTop: '8px',
                              padding: '8px',
                              width: '100%',
                              opacity: (!isActionable || (item.crossCuttingType === 'split' && Math.abs(item.totalTargetAllSubs - parseFloat(item.yearlyTarget)) >= 0.05)) ? 0.5 : 1,
                              cursor: (!isActionable || (item.crossCuttingType === 'split' && Math.abs(item.totalTargetAllSubs - parseFloat(item.yearlyTarget)) >= 0.05)) ? 'not-allowed' : 'pointer'
                            }}
                            disabled={!isActionable || (item.crossCuttingType === 'split' && Math.abs(item.totalTargetAllSubs - parseFloat(item.yearlyTarget)) >= 0.05)}
                            onClick={() => handleApproveTarget(item.employeeId, item.indicatorId, item.employeeNama)}
                          >
                            <i className="fa-solid fa-circle-check"></i> {buttonText}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              // Tab Realisations
              pendingRealisasis.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  Tidak ada usulan realisasi bulanan yang perlu diproses.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {pendingRealisasis.map((item, idx) => {
                    const isUnderperform = item.realisasiBulanan < item.targetBulanan;
                    const isPercentage = item.metodePenghitungan === 'Persentase';
                    const isJumlah = item.metodePenghitungan === 'Jumlah';

                    const isActionable = activeRole === 'admin_bidang'
                      ? item.status === 'Diajukan'
                      : item.status === 'ACC_Admin';

                    const buttonText = activeRole === 'admin_bidang'
                      ? (item.status === 'ACC_Admin' ? 'Telah di-ACC Admin' : 'ACC Realisasi')
                      : (item.status === 'Disetujui' ? 'Disetujui Pemimpin' : 'Validasi Realisasi');

                    return (
                      <div key={item.id} className="glass-panel" style={{
                        margin: 0,
                        border: `1px solid ${item.status === 'ACC_Admin' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`,
                        background: 'rgba(255, 255, 255, 0.02)',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                        width: '100%'
                      }}>
                        <div className="panel-header" style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--glass-border)',
                          background: 'rgba(16, 185, 129, 0.03)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <h4 style={{ fontSize: '14px', color: 'white', margin: 0 }}>{item.employeeNama}</h4>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.employeeJabatan}</span>
                          </div>
                          <span className="badge" style={{
                            fontSize: '9px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10B981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            width: 'auto'
                          }}>
                            Bulan {item.bulan}
                          </span>
                        </div>
                        <div className="panel-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--primary-orange)', fontWeight: 600 }}>Indikator:</label>
                            <p style={{ fontSize: '12px', color: 'white', margin: '2px 0 0 0', fontWeight: 'bold' }}>{item.indicatorName}</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{item.indicatorText}</p>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Target Bulan Ini</span>
                              <strong style={{ fontSize: '13px', color: 'white' }}>{item.targetBulanan} {item.indicatorSatuan}</strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Realisasi Capaian</span>
                              <strong style={{ fontSize: '13px', color: '#10B981' }}>
                                {item.realisasiBulanan}{item.indicatorSatuan === '%' || item.indicatorSatuan?.toLowerCase() === 'persen' ? '%' : ''}
                              </strong>
                              {isPercentage && (
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>
                                  ({item.variabelPembilangVal || 0} / {item.variabelPenyebutVal || 0})
                                </span>
                              )}
                              {isJumlah && (
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>
                                  (Q: {item.variabelJumlahVal || 0})
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Status Badge */}
                            {item.status === 'Diajukan' && <span className="badge" style={{ fontSize: '10px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', width: 'auto' }}><i className="fa-solid fa-clock"></i> Diajukan Staf</span>}
                             {item.status === 'ACC_Admin' && <span className="badge" style={{ fontSize: '10px', background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)', width: 'auto' }}><i className="fa-solid fa-circle-check"></i> ACC Admin Unit Kerja</span>}
                            {item.status === 'Disetujui' && <span className="badge" style={{ fontSize: '10px', background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', width: 'auto' }}><i className="fa-solid fa-circle-check"></i> Disetujui Pemimpin</span>}

                            {/* Cross-cutting badge */}
                            {item.isCrossCuttingSelected !== undefined && (
                              <span className="badge" style={{
                                fontSize: '10px',
                                background: item.isCrossCuttingSelected ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                                color: item.isCrossCuttingSelected ? '#10B981' : '#94A3B8',
                                border: `1px solid ${item.isCrossCuttingSelected ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.3)'}`,
                                width: 'auto'
                              }}>
                                <i className="fa-solid fa-share-nodes"></i> {item.isCrossCuttingSelected ? 'Capaian Resmi' : 'Tidak Digunakan'}
                              </span>
                            )}
                          </div>

                          {(() => {
                            const files = parseBuktiDukung(item.buktiDukung);
                            if (files.length === 0) return null;
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', marginBottom: '8px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                                  <i className="fa-solid fa-folder-open text-orange"></i> Bukti Dukung ({files.length}):
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {files.map((file, idx) => (
                                    <button 
                                      key={idx}
                                      type="button" 
                                      onClick={() => setPreviewUrl(file.url)} 
                                      className="btn btn-sm btn-secondary" 
                                      style={{ 
                                        padding: '4px 10px', 
                                        fontSize: '11px', 
                                        width: 'auto', 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--glass-border)'
                                      }}
                                      title={file.url}
                                    >
                                      <i className="fa-solid fa-file-lines text-orange"></i> {file.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Analysis and constraints info */}
                          <div style={{
                            background: isUnderperform ? 'rgba(245, 158, 11, 0.06)' : 'rgba(16, 185, 129, 0.06)',
                            border: `1px solid ${isUnderperform ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                            padding: '10px',
                            borderRadius: '6px',
                            fontSize: '12px'
                          }}>
                            {isUnderperform ? (
                              <>
                                <div style={{ color: 'var(--warning)', fontWeight: 'bold' }}>Kendala:</div>
                                <div style={{ color: 'white', marginBottom: '6px' }}>{item.kendala || '-'}</div>
                                <div style={{ color: 'var(--info)', fontWeight: 'bold' }}>Solusi:</div>
                                <div style={{ color: 'white' }}>{item.solusi || '-'}</div>
                              </>
                            ) : (
                              <>
                                <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>Faktor Pendorong:</div>
                                <div style={{ color: 'white', marginBottom: '6px' }}>{item.faktorPendorong || '-'}</div>
                                {item.inovasi && (
                                  <>
                                    <div style={{ color: 'var(--primary-orange)', fontWeight: 'bold' }}>Inovasi:</div>
                                    <div style={{ color: 'white' }}>{item.inovasi}</div>
                                  </>
                                )}
                              </>
                            )}
                          </div>

                          <button
                            className="btn btn-orange w-full"
                            style={{
                              marginTop: '8px',
                              padding: '8px',
                              background: isActionable ? '#10B981' : '#64748B',
                              borderColor: isActionable ? '#10B981' : '#64748B',
                              opacity: isActionable ? 1 : 0.5,
                              cursor: isActionable ? 'pointer' : 'not-allowed',
                              width: '100%'
                            }}
                            disabled={!isActionable}
                            onClick={() => handleApproveRealisasi(item.id, item.employeeNama, item.bulan)}
                          >
                            <i className="fa-solid fa-circle-check"></i> {buttonText}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* 2. Subordinate AKIP Evaluation Mode (Only for Pemimpin) */}
      {activeRole === 'pemimpin' && evalMode === 'akip' && (
        <div className="grid-subordinates">
          {/* Subordinate Sidebar List */}
          <div className="glass-panel" style={{ height: 'max-content' }}>
            <div className="panel-header">
              <h3><i className="fa-solid fa-users-gear text-orange"></i> Bawahan Langsung</h3>
            </div>
            <div className="panel-body">
              {loading ? (
                <div style={{ textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin"></i> Loading...</div>
              ) : subordinates.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada bawahan langsung yang terdaftar.</div>
              ) : (
                <div className="subordinate-list">
                  {subordinates.map(sub => (
                    <div
                      key={sub.id}
                      className={`subordinate-item ${selectedSub?.id === sub.id ? 'active' : ''}`}
                      onClick={() => handleSelectSub(sub)}
                    >
                      <h4>{sub.nama}</h4>
                      <p>{sub.jabatan}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Subordinate Evaluation Panel */}
          <div className="glass-panel" style={{ display: selectedSub ? 'block' : 'none' }}>
            {selectedSub && (
              <>
                <div className="panel-header justify-between">
                  <div>
                    <h3><i className="fa-solid fa-gavel text-orange"></i> Evaluasi Kinerja: {selectedSub.nama}</h3>
                    <p className="text-muted">{selectedSub.jabatan} - NIP. {selectedSub.nip}</p>
                  </div>
                </div>

                <div className="panel-body">
                  {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
                  {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

                  {/* Subordinate Reports pending approval */}
                  <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Persetujuan Realisasi Bulanan (Pending Validasi)</h4>
                  {subRenaksis.length === 0 ? (
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '13px', marginBottom: '30px' }}>
                      Tidak ada laporan bulanan yang memerlukan validasi saat ini.
                    </div>
                  ) : (
                    <div className="table-responsive mb-4">
                      <table className="table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Bulan</th>
                            <th>Indikator Sasaran</th>
                            <th>Target</th>
                            <th>Realisasi</th>
                            <th>Bukti Dukung</th>
                            <th>Analisis Hambatan/Pendorong</th>
                            <th style={{ textAlign: 'right' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subRenaksis.map(rx => {
                            const node = annualNodes.find(n => n.id === rx.indicatorId);
                            const isUnderperform = rx.realisasiBulanan < rx.targetBulanan;
                            return (
                              <tr key={rx.id}>
                                <td><strong>Bulan {rx.bulan}</strong></td>
                                <td>
                                  <strong>{node?.text}</strong>
                                  <div className="text-muted">{node?.indikator}</div>
                                </td>
                                <td style={{ textAlign: 'center' }}>{rx.targetBulanan}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <strong>{rx.realisasiBulanan}{node?.satuan === '%' || node?.satuan?.toLowerCase() === 'persen' ? '%' : ''}</strong>
                                  {node?.metodePenghitungan === 'Persentase' && (
                                    <div className="text-muted" style={{ fontSize: '10px', marginTop: '2px' }}>
                                      ({rx.variabelPembilangVal || 0} / {rx.variabelPenyebutVal || 0})
                                    </div>
                                  )}
                                  {node?.metodePenghitungan === 'Jumlah' && (
                                    <div className="text-muted" style={{ fontSize: '10px', marginTop: '2px' }}>
                                      (Q: {rx.variabelJumlahVal || 0})
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {(() => {
                                    const files = parseBuktiDukung(rx.buktiDukung);
                                    if (files.length === 0) return <span className="text-muted" style={{ fontSize: '11px' }}>-</span>;
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {files.map((file, idx) => (
                                          <button 
                                            key={idx}
                                            type="button" 
                                            onClick={() => setPreviewUrl(file.url)} 
                                            className="btn btn-sm btn-secondary" 
                                            style={{ 
                                              padding: '2px 6px', 
                                              fontSize: '10px', 
                                              display: 'inline-flex', 
                                              alignItems: 'center', 
                                              gap: '4px',
                                              whiteSpace: 'nowrap',
                                              width: 'auto',
                                              textAlign: 'left'
                                            }}
                                            title={file.name}
                                          >
                                            <i className="fa-solid fa-file-lines text-orange"></i>
                                            <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td>
                                  {isUnderperform ? (
                                    <div>
                                      <div style={{ color: 'var(--warning)', fontWeight: 'bold' }}>Kendala:</div>
                                      <div>{rx.kendala}</div>
                                      <div style={{ color: 'var(--info)', fontWeight: 'bold', marginTop: '4px' }}>Solusi:</div>
                                      <div>{rx.solusi}</div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>Pendorong:</div>
                                      <div>{rx.faktorPendorong}</div>
                                      {rx.inovasi && (
                                        <>
                                          <div style={{ color: 'var(--primary-orange)', fontWeight: 'bold', marginTop: '4px' }}>Inovasi:</div>
                                          <div>{rx.inovasi}</div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button className="btn btn-sm btn-orange" onClick={() => handleApproveRealisasi(rx.id, selectedSub.nama, rx.bulan)}>Validasi</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Final AKIP Evaluator form */}
                  <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '30px 0' }} />
                  
                  <h4 style={{ fontSize: '14px', marginBottom: '16px' }}>Penetapan Hasil Evaluasi AKIP Individu (AKIP-I)</h4>
                  
                  <form onSubmit={handleSubmitEvaluation}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div className="form-group">
                        <label>Skor Evaluasi AKIP (0 - 100)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          value={skorAKIP}
                          onChange={(e) => setSkorAKIP(e.target.value)}
                          required
                          placeholder="Contoh: 82.50"
                        />
                      </div>
                      {skorAKIP && !isNaN(parseFloat(skorAKIP)) && (
                        <div className="form-group">
                          <label>Predikat Kinerja Hasil</label>
                          <div style={{ marginTop: '8px' }}>
                            <span className="badge badge-score" style={{ fontSize: '14px', padding: '6px 14px' }}>
                              {getPredikatLabel(parseFloat(skorAKIP))}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="form-group mb-3">
                      <label>Catatan & Rekomendasi Atasan Evaluator</label>
                      <textarea
                        className="form-control"
                        rows="4"
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                        required
                        placeholder="Masukkan poin rekomendasi perbaikan untuk pegawai..."
                      />
                    </div>
                    <button type="submit" className="btn btn-orange" style={{ marginTop: '12px' }}>
                      <i className="fa-solid fa-save"></i> Simpan Evaluasi Akhir
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewUrl && (
        <DocumentPreviewModal 
          url={previewUrl} 
          onClose={() => setPreviewUrl('')} 
        />
      )}
    </section>
  );
}
