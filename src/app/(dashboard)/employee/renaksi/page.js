'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function EmployeeRenaksiPage() {
  const { fetchWithAuth, currentUser, activeBidang, activeYear, systemSettings } = useSimulation();

  const [selectedIndicators, setSelectedIndicators] = useState([]);
  const [renaksiRecords, setRenaksiRecords] = useState([]);
  const [targetsMap, setTargetsMap] = useState({}); // { "indicatorId_bulan": value }
  const [supervisor, setSupervisor] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch selection list
      const selRes = await fetchWithAuth(`/api/selections/${currentUser.id}`);
      let selectedIds = [];
      if (selRes.ok) {
        const selData = await selRes.json();
        selectedIds = selData.selectedIndicators || [];
      }

      // 2. Fetch annual Renja nodes
      const nodesRes = await fetchWithAuth(`/api/renja/${activeYear}`);
      let matchedNodes = [];
      if (nodesRes.ok) {
        const allNodes = await nodesRes.json();
        matchedNodes = allNodes.filter(n => selectedIds.includes(n.id));
        setSelectedIndicators(matchedNodes);
      }

      // 3. Fetch existing Renaksi records
      const rxRes = await fetchWithAuth(`/api/renaksi/${currentUser.id}/${activeYear}`);
      if (rxRes.ok) {
        const records = await rxRes.json();
        setRenaksiRecords(records);

        // Prepopulate targetsMap
        const initialMap = {};
        records.forEach(r => {
          initialMap[`${r.indicatorId}_${r.bulan}`] = r.targetBulanan.toString();
        });
        setTargetsMap(initialMap);
      }

      // 4. Fetch supervisor details
      if (currentUser?.parentId) {
        const empRes = await fetchWithAuth('/api/employees');
        if (empRes.ok) {
          const emps = await empRes.json();
          const boss = emps.find(e => e.id === currentUser.parentId);
          setSupervisor(boss);
        }
      }
    } catch (e) {
      console.error('Failed to load renaksi spreadsheet data', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser, activeYear, fetchWithAuth]);

  useEffect(() => {
    if (currentUser) {
      const timer = setTimeout(() => {
        loadData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentUser, loadData]);

  const handleInputChange = (indicatorId, month, value) => {
    if (systemSettings?.renja_locked) return;
    setTargetsMap({
      ...targetsMap,
      [`${indicatorId}_${month}`]: value
    });
  };

  // Calculate row total sum for visualization
  const getRowTotal = (indicatorId) => {
    let sum = 0;
    for (let month = 1; month <= 12; month++) {
      const val = parseFloat(targetsMap[`${indicatorId}_${month}`]) || 0;
      sum += val;
    }
    return sum;
  };

  const getEffectiveAnnualTarget = (node) => {
    let targetVal = parseFloat(node.target);
    if (node.crossCuttingType === 'split' && node.splitTargets && currentUser) {
      const portion = parseFloat(node.splitTargets[currentUser.id]);
      if (!isNaN(portion)) {
        targetVal = portion;
      }
    }
    return targetVal;
  };

  const handleSaveTargets = async () => {
    setError('');
    setSuccess('');

    // Prepare payload
    const targetsPayload = [];
    selectedIndicators.forEach(node => {
      for (let month = 1; month <= 12; month++) {
        const key = `${node.id}_${month}`;
        const val = parseFloat(targetsMap[key]) || 0;
        targetsPayload.push({
          indicatorId: node.id,
          bulan: month,
          targetBulanan: val
        });
      }
    });

    try {
      const res = await fetchWithAuth('/api/renaksi/target/batch', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: currentUser.id,
          targets: targetsPayload
        })
      });

      if (res.ok) {
        setSuccess('Matriks target bulanan berhasil disimpan.');
        loadData();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan target.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const getTargetStatusText = () => {
    if (renaksiRecords.length === 0) return 'Draft';
    const hasPending = renaksiRecords.some(r => ['Target_Diajukan', 'Target_ACC_Admin'].includes(r.status));
    if (hasPending) return 'Menunggu Persetujuan';
    
    const hasApproved = renaksiRecords.some(r => r.status === 'Target_Disetujui');
    const hasDraft = renaksiRecords.some(r => r.status === 'Draft');
    if (hasApproved && !hasDraft && !hasPending) return 'Target Disetujui';
    
    return 'Draft';
  };

  const handleAjukanTarget = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth('/api/renaksi/target/submit', {
        method: 'POST',
        body: JSON.stringify({ employeeId: currentUser.id })
      });

      if (res.ok) {
        setSuccess('Matriks rencana target renaksi berhasil diajukan ke atasan.');
        loadData();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal mengajukan target.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const targetStatus = getTargetStatusText();
  const isTargetEditable = targetStatus === 'Draft' && !systemSettings?.renja_locked;

  const months = [
    { num: 1, label: 'Jan' },
    { num: 2, label: 'Feb' },
    { num: 3, label: 'Mar' },
    { num: 4, label: 'Apr' },
    { num: 5, label: 'Mei' },
    { num: 6, label: 'Jun' },
    { num: 7, label: 'Jul' },
    { num: 8, label: 'Ags' },
    { num: 9, label: 'Sep' },
    { num: 10, label: 'Okt' },
    { num: 11, label: 'Nov' },
    { num: 12, label: 'Des' }
  ];

  return (
    <section>
      {/* Target Setting Spreadsheet */}
      <div className="glass-panel print-exclude">
        <div className="panel-header justify-between">
          <div>
            <h3><i className="fa-solid fa-table text-orange"></i> Penyusunan Matriks Target Renaksi (Spreadsheet Model)</h3>
            <p className="text-muted">Masukkan target sasaran per bulan. Jumlah target bulanan untuk tipe &quot;Akumulatif&quot; wajib bernilai persis sama dengan target tahunan.</p>
          </div>
        </div>
        <div className="panel-body">
          {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
          {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}><i className="fa-solid fa-circle-notch fa-spin"></i> Memuat matriks target...</div>
          ) : selectedIndicators.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
              Anda belum memilih indikator IKU. Silakan masuk ke menu <strong>Pilih Indikator IKU</strong> terlebih dahulu.
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '12px',
                width: '100%'
              }}>
                <div>
                  <span className="text-muted" style={{ fontSize: '12px' }}>Status Rencana Target:</span>
                  {targetStatus === 'Draft' && (
                    <span className="badge" style={{ marginLeft: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '11px' }}>Draft Rencana</span>
                  )}
                  {targetStatus === 'Menunggu Persetujuan' && (
                    <span className="badge" style={{ marginLeft: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '11px' }}>Menunggu Persetujuan Atasan</span>
                  )}
                  {targetStatus === 'Target Disetujui' && (
                    <span className="badge" style={{ marginLeft: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '11px' }}>Rencana Target Disetujui</span>
                  )}
                </div>
                
                {targetStatus === 'Draft' && !systemSettings?.renja_locked && (
                  <button className="btn btn-orange" onClick={handleAjukanTarget} style={{ padding: '6px 14px', fontSize: '12px', width: 'auto' }}>
                    <i className="fa-solid fa-paper-plane"></i> Ajukan Target ke Atasan
                  </button>
                )}
              </div>

              <div className="table-responsive">
                <table className="table" style={{ fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <th>Indikator Sasaran</th>
                      <th width="100px">Tipe</th>
                      <th width="80px" style={{ textAlign: 'center' }}>Target</th>
                      {months.map(m => (
                        <th key={m.num} width="65px" style={{ textAlign: 'center' }}>{m.label}</th>
                      ))}
                      <th width="80px" style={{ textAlign: 'center' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedIndicators.map(node => {
                      const effectiveTarget = getEffectiveAnnualTarget(node);
                      const totalSum = getRowTotal(node.id);
                      const isAccumulative = node.tipeTarget === 'Akumulatif';
                      const isSumValid = !isAccumulative || Math.abs(totalSum - effectiveTarget) < 0.05;

                      return (
                        <tr key={node.id}>
                          <td>
                            <strong>{node.text}</strong>
                            <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                              Indikator: {node.indikator} ({node.satuan})
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '10px' }}>{node.tipeTarget}</span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {effectiveTarget}
                          </td>
                          {months.map(m => {
                            const val = targetsMap[`${node.id}_${m.num}`] || '0';
                            return (
                              <td key={m.num} style={{ padding: '4px' }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  style={{
                                    padding: '4px 6px',
                                    textAlign: 'center',
                                    fontSize: '11px',
                                    cursor: !isTargetEditable ? 'not-allowed' : 'text'
                                  }}
                                  disabled={!isTargetEditable}
                                  value={val}
                                  onChange={(e) => handleInputChange(node.id, m.num, e.target.value)}
                                />
                              </td>
                            );
                          })}
                          <td style={{
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: isSumValid ? 'var(--text-primary)' : 'var(--danger)',
                            background: isSumValid ? '' : 'rgba(239, 68, 68, 0.08)'
                          }}>
                            {totalSum}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {isTargetEditable && (
                <div style={{ marginTop: '20px' }}>
                  <button className="btn btn-orange" onClick={handleSaveTargets}>
                    <i className="fa-solid fa-floppy-disk"></i> Simpan Semua Target
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Official PK Print Document Section */}
      {selectedIndicators.length > 0 && (
        <div className="glass-panel" style={{ marginTop: '24px' }}>
          <div className="panel-header justify-between print-exclude">
            <h3><i className="fa-solid fa-file-signature text-orange"></i> Cetak Dokumen Resmi Perjanjian Kinerja (PK)</h3>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              <i className="fa-solid fa-print"></i> Cetak Dokumen Resmi
            </button>
          </div>

          <div className="print-only-layout" id="pkPrintTemplate" style={{ display: 'block', padding: '30px', background: 'white', color: 'black' }}>
            <div className="kop-surat" style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase' }}>Pemerintah Kabupaten Boyolali</h3>
              <h2 style={{ margin: '4px 0', fontSize: '18px', textTransform: 'uppercase' }}>Badan Penanggulangan Bencana Daerah (BPBD)</h2>
              <p style={{ margin: 0, fontSize: '10px' }}>Kompleks Perkantoran Terpadu Kabupaten Boyolali, Jawa Tengah</p>
            </div>

            <h3 style={{ textAlign: 'center', textDecoration: 'underline', fontSize: '14px', margin: '0 0 4px 0' }}>PERJANJIAN KINERJA INDIVIDU</h3>
            <p style={{ textAlign: 'center', fontSize: '12px', margin: '0 0 20px 0' }}>TAHUN ANGGARAN {activeYear}</p>

            <p style={{ fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
              Dalam rangka mewujudkan manajemen pemerintahan yang efektif, transparan dan akuntabel serta berorientasi pada hasil, kami yang bertanda tangan di bawah ini berjanji akan mewujudkan target kinerja tahunan sesuai lampiran perjanjian ini.
            </p>

            <table style={{ width: '100%', fontSize: '12px', marginBottom: '24px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td width="150px" style={{ padding: '4px 0' }}><strong>Nama Pegawai</strong></td>
                  <td width="15px" style={{ padding: '4px 0' }}>:</td>
                  <td style={{ padding: '4px 0' }}>{currentUser?.nama}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0' }}><strong>NIP</strong></td>
                  <td style={{ padding: '4px 0' }}>:</td>
                  <td style={{ padding: '4px 0' }}>{currentUser?.nip}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0' }}><strong>Jabatan</strong></td>
                  <td style={{ padding: '4px 0' }}>:</td>
                  <td style={{ padding: '4px 0' }}>{currentUser?.jabatan}</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '12px', margin: '0 0 6px 0' }}>A. Sasaran Kinerja Utama</h4>
            <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
              <thead>
                <tr style={{ background: '#f2f2f2' }}>
                  <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px', width: '40px' }}>No</th>
                  <th style={{ border: '1px solid black', padding: '6px', textAlign: 'left', fontSize: '11px' }}>Sasaran Kinerja / Aktivitas</th>
                  <th style={{ border: '1px solid black', padding: '6px', textAlign: 'left', fontSize: '11px' }}>Indikator Kinerja Utama (IKU)</th>
                  <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px', width: '100px' }}>Target</th>
                  <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px', width: '100px' }}>Satuan</th>
                </tr>
              </thead>
              <tbody>
                {selectedIndicators.map((node, index) => (
                  <tr key={node.id}>
                    <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px' }}>{index + 1}</td>
                    <td style={{ border: '1px solid black', padding: '6px', fontSize: '11px' }}>{node.text}</td>
                    <td style={{ border: '1px solid black', padding: '6px', fontSize: '11px' }}>{node.indikator}</td>
                    <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                      {getEffectiveAnnualTarget(node)}
                    </td>
                    <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px' }}>{node.satuan}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ fontSize: '12px', margin: '0 0 6px 0' }}>B. Rencana Aksi Bulanan (Renaksi)</h4>
            <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px !important' }}>
              <thead>
                <tr style={{ background: '#f2f2f2' }}>
                  <th rowspan="2" style={{ border: '1px solid black', padding: '4px', textAlign: 'center', width: '30px' }}>No</th>
                  <th rowspan="2" style={{ border: '1px solid black', padding: '4px', textAlign: 'left' }}>Indikator Kinerja</th>
                  <th colspan="12" style={{ border: '1px solid black', padding: '4px', textAlign: 'center' }}>Target Bulanan</th>
                </tr>
                <tr style={{ background: '#f2f2f2' }}>
                  {months.map(m => (
                    <th key={m.num} style={{ border: '1px solid black', padding: '4px', textAlign: 'center', width: '35px' }}>B{m.num}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedIndicators.map((node, index) => (
                  <tr key={node.id}>
                    <td style={{ border: '1px solid black', padding: '4px', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ border: '1px solid black', padding: '4px' }}>{node.indikator}</td>
                    {months.map(m => {
                      const val = targetsMap[`${node.id}_${m.num}`] || '0';
                      return (
                        <td key={m.num} style={{ border: '1px solid black', padding: '4px', textAlign: 'center' }}>{val}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <div style={{ textAlign: 'center', width: '250px' }}>
                <p>Pihak Kedua (Pegawai),</p>
                <br /><br /><br />
                <p><strong><u>{currentUser?.nama}</u></strong></p>
                <p>NIP. {currentUser?.nip}</p>
              </div>
              <div style={{ textAlign: 'center', width: '250px' }}>
                <p>Boyolali, 5 Januari {activeYear}</p>
                <p>Pihak Kesatu (Atasan Langsung),</p>
                <br /><br /><br />
                <p><strong><u>{supervisor ? supervisor.nama : '-'}</u></strong></p>
                <p>NIP. {supervisor ? supervisor.nip : '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
