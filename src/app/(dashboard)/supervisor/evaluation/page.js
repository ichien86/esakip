'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function SupervisorEvaluationPage() {
  const { fetchWithAuth, currentUser, activeRole, allEmployees } = useSimulation();

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

  const isSupervisor = ['kasi', 'kabid', 'sekretaris', 'kalaksa', 'admin_bidang'].includes(activeRole);

  const [pendingTargets, setPendingTargets] = useState([]);
  const [pendingRealisasis, setPendingRealisasis] = useState([]);
  const [kabidLoading, setKabidLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('targets'); // 'targets' | 'realisations'

  const loadKabidValidationItems = async () => {
    if (!currentUser || activeRole !== 'kabid') return;
    setKabidLoading(true);
    try {
      const subs = allEmployees.filter(emp => emp.parentId === currentUser.id && emp.isActive !== false);
      const subIds = subs.map(s => s.id);

      if (subIds.length === 0) {
        setPendingTargets([]);
        setPendingRealisasis([]);
        setKabidLoading(false);
        return;
      }

      const allTargets = [];
      const allRealisasis = [];

      const nodesRes = await fetch('/api/renja/2026');
      const allNodes = nodesRes.ok ? await nodesRes.json() : [];

      const allSubRenaksis = [];
      const subRenaksisMap = {};

      for (let sub of subs) {
        const rxRes = await fetch(`/api/renaksi/${sub.id}/2026`);
        if (rxRes.ok) {
          const rxData = await rxRes.json();
          subRenaksisMap[sub.id] = rxData;
          allSubRenaksis.push(...rxData);
        }
      }

      for (let sub of subs) {
        const rxData = subRenaksisMap[sub.id] || [];
        
        // Target validation: status 'Target_Diajukan'
        const subPendingTargets = rxData.filter(r => r.status === 'Target_Diajukan');
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
            totalTargetAllSubs
          });
        });

        // Realisasi validation: status 'Diajukan'
        const subPendingRealisasis = rxData.filter(r => r.status === 'Diajukan');
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
            variabelPenyebutVal: r.variabelPenyebutVal
          });
        });
      }

      setPendingTargets(allTargets);
      setPendingRealisasis(allRealisasis);
    } catch (e) {
      console.error('Failed to load Kabid validation items', e);
    } finally {
      setKabidLoading(false);
    }
  };

  useEffect(() => {
    if (activeRole === 'kabid') {
      loadKabidValidationItems();
    }
  }, [currentUser, activeRole, allEmployees]);

  const handleApproveTarget = async (employeeId, indicatorId, empName) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth('/api/renaksi/target/approve', {
        method: 'POST',
        body: JSON.stringify({ employeeId, indicatorId })
      });

      if (res.ok) {
        setSuccess(`Rencana target bulanan untuk ${empName} berhasil disetujui.`);
        loadKabidValidationItems();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyetujui target.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const handleApproveKabidRealisasi = async (id, empName, bulan) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth('/api/renaksi/approve', {
        method: 'POST',
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        setSuccess(`Realisasi bulan ${bulan} untuk ${empName} berhasil disetujui.`);
        loadKabidValidationItems();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyetujui realisasi.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const loadSubordinates = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Find direct subordinates (where parentId matches currentUser id)
      const subs = allEmployees.filter(emp => emp.parentId === currentUser.id && emp.isActive !== false);
      setSubordinates(subs);

      // Load all Renja indicators for details lookup
      const nodesRes = await fetch('/api/renja/2026');
      if (nodesRes.ok) {
        setAnnualNodes(await nodesRes.json());
      }
    } catch (e) {
      console.error('Failed to load subordinate list', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSupervisor) {
      loadSubordinates();
    }
  }, [currentUser, activeRole, allEmployees]);

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
      const rxRes = await fetch(`/api/renaksi/${sub.id}/2026`);
      if (rxRes.ok) {
        const rxData = await rxRes.json();
        // Filter those submitted (Diajukan) or Approved (Disetujui) for review
        setSubRenaksis(rxData.filter(r => r.status === 'Diajukan'));
      }

      // 2. Fetch Performance Evaluation Sheet
      const perfRes = await fetch(`/api/performance/${sub.id}/2026`);
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

  const handleApproveRenaksi = async (id) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth('/api/renaksi/approve', {
        method: 'POST',
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        setSuccess('Laporan realisasi bulanan berhasil disetujui.');
        // Refresh subordinate details
        if (selectedSub) {
          handleSelectSub(selectedSub);
        }
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyetujui laporan.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
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
          tahun: 2026,
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

  if (activeRole === 'kabid') {
    return (
      <section>
        <div className="glass-panel">
          <div className="panel-header justify-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3><i className="fa-solid fa-user-check text-orange"></i> Dashboard Validasi Kepala Bidang</h3>
              <p className="text-muted">Gunakan perangkat seluler atau desktop untuk memvalidasi Rencana Aksi (Renaksi) dan Realisasi bawahan Anda.</p>
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
                  Tidak ada usulan target renaksi yang perlu divalidasi.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {pendingTargets.map((item, idx) => (
                    <div key={idx} className="glass-panel" style={{
                      margin: 0,
                      border: '1px solid rgba(255, 107, 0, 0.2)',
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
                            opacity: (item.crossCuttingType === 'split' && Math.abs(item.totalTargetAllSubs - parseFloat(item.yearlyTarget)) >= 0.05) ? 0.5 : 1,
                            cursor: (item.crossCuttingType === 'split' && Math.abs(item.totalTargetAllSubs - parseFloat(item.yearlyTarget)) >= 0.05) ? 'not-allowed' : 'pointer'
                          }}
                          disabled={item.crossCuttingType === 'split' && Math.abs(item.totalTargetAllSubs - parseFloat(item.yearlyTarget)) >= 0.05}
                          onClick={() => handleApproveTarget(item.employeeId, item.indicatorId, item.employeeNama)}
                        >
                          <i className="fa-solid fa-circle-check"></i> Setujui Rencana Target
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // Tab Realisations
              pendingRealisasis.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  Tidak ada usulan realisasi bulanan yang perlu divalidasi.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {pendingRealisasis.map((item, idx) => {
                    const isUnderperform = item.realisasiBulanan < item.targetBulanan;
                    const isPercentage = item.metodePenghitungan === 'Persentase';
                    const isJumlah = item.metodePenghitungan === 'Jumlah';

                    return (
                      <div key={item.id} className="glass-panel" style={{
                        margin: 0,
                        border: '1px solid rgba(16, 185, 129, 0.2)',
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

                          {item.buktiDukung && (
                            <div>
                              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Bukti Dukung:</label>
                              <a href={item.buktiDukung} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary" style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                marginTop: '4px',
                                width: 'auto'
                              }}>
                                <i className="fa-solid fa-up-right-from-square"></i> Buka Link Dokumen
                              </a>
                            </div>
                          )}

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
                            style={{ marginTop: '8px', padding: '8px', background: '#10B981', borderColor: '#10B981', width: '100%' }}
                            onClick={() => handleApproveKabidRealisasi(item.id, item.employeeNama, item.bulan)}
                          >
                            <i className="fa-solid fa-circle-check"></i> Setujui Realisasi
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
      </section>
    );
  }

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
                <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Persetujuan Realisasi Bulanan (Pending)</h4>
                {subRenaksis.length === 0 ? (
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '13px', marginBottom: '30px' }}>
                    Tidak ada laporan bulanan yang memerlukan persetujuan saat ini.
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
                                {rx.buktiDukung && (
                                  <a href={rx.buktiDukung} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary" style={{ padding: '2px 8px' }}>
                                    Open Link
                                  </a>
                                )}
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
                                <button className="btn btn-sm btn-orange" onClick={() => handleApproveRenaksi(rx.id)}>Setujui</button>
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

                  <button type="submit" className="btn btn-orange">
                    <i className="fa-solid fa-save"></i> Simpan Evaluasi Akhir
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

      </div>
    </section>
  );
}
