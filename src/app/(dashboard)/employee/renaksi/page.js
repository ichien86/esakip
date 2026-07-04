'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useSimulationInternal } from '@/context/SimulationInternalContext';
import { useUI } from '@/context/UIContext';
import { useMetadata } from '@/context/MetadataContext';

export default function EmployeeRenaksiPage() {
  const router = useRouter();
  const { fetchWithAuth } = useFetchWithAuth();
  const { currentUser } = useSimulationInternal();
  const { activeBidang, activeYear } = useUI();
  const { systemSettings } = useMetadata();
  const [selectedIndicators, setSelectedIndicators] = useState([]);
  const [renaksiRecords, setRenaksiRecords] = useState([]);
  const [targetsMap, setTargetsMap] = useState({}); // { "indicatorId_bulan": value }
  const [supervisor, setSupervisor] = useState(null);
  const [profileInfo, setProfileInfo] = useState(null);
  
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
      if (nodesRes.ok) {
        const allNodes = await nodesRes.json();
        let matchedIndicators = [];
        allNodes.forEach(n => {
          if (n.indicators && n.indicators.length > 0) {
            n.indicators.forEach(ind => {
              if (selectedIds.includes(ind.id)) {
                matchedIndicators.push({
                  ...ind,
                  parentNode: n
                });
              }
            });
          } else if (selectedIds.includes(n.id)) {
            // Legacy fallback
            matchedIndicators.push({
              ...n,
              parentNode: null
            });
          }
        });
        setSelectedIndicators(matchedIndicators);
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

      // 5. Fetch profile info
      const profRes = await fetchWithAuth('/api/profile');
      if (profRes.ok) {
        setProfileInfo(await profRes.json());
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

  const autosaveTimerRef = React.useRef(null);

  const handleInputChange = (indicatorId, month, value) => {
    if (systemSettings?.renja_locked) return;
    const newMap = {
      ...targetsMap,
      [`${indicatorId}_${month}`]: value
    };
    setTargetsMap(newMap);

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    
    // Autosave after 1.5 seconds of inactivity
    autosaveTimerRef.current = setTimeout(() => {
      saveTargetsBackground(newMap);
    }, 1500);
  };

  const saveTargetsBackground = async (mapToSave) => {
    const targetsPayload = [];
    selectedIndicators.forEach(node => {
      for (let month = 1; month <= 12; month++) {
        const key = `${node.id}_${month}`;
        const val = parseFloat(mapToSave[key]) || 0;
        targetsPayload.push({ indicatorId: node.id, bulan: month, targetBulanan: val });
      }
    });

    try {
      await fetchWithAuth('/api/renaksi/target/batch', {
        method: 'POST',
        body: JSON.stringify({ employeeId: currentUser.id, targets: targetsPayload })
      });
      // Silent save in background
    } catch (e) {
      console.error('Autosave failed:', e);
    }
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
    // splitTargets disimpan di level indikator (ind), bukan parentNode
    const isSplit = node.crossCuttingType === 'split';
    if (isSplit && node.splitTargets && currentUser) {
      // Cari porsi berdasarkan employee ID
      let portion = parseFloat(node.splitTargets[currentUser.id]);
      // Jika tidak ditemukan via ID, cari via jabatan (jabatan:...)
      if (isNaN(portion) && currentUser.jabatan) {
        const jabatanKey = `jabatan:${currentUser.jabatan}`;
        portion = parseFloat(node.splitTargets[jabatanKey]);
      }
      if (!isNaN(portion)) {
        targetVal = portion;
      }
    }
    return targetVal;
  };

  const getTargetStatusText = () => {
    if (renaksiRecords.length === 0) return 'Draft';
    
    const hasRejected = renaksiRecords.some(r => r.status === 'Target_Ditolak');
    if (hasRejected) return 'Target_Ditolak';

    const hasPending = renaksiRecords.some(r => ['Target_Diajukan', 'Target_ACC_Admin'].includes(r.status));
    if (hasPending) return 'Menunggu Persetujuan';
    
    const hasApproved = renaksiRecords.some(r => r.status === 'Target_Disetujui');
    const hasDraft = renaksiRecords.some(r => r.status === 'Draft');
    if (hasApproved && !hasDraft && !hasPending) return 'Target Disetujui';
    
    return 'Draft';
  };

  const handleAjukanPerjakin = async () => {
    setError('');
    setSuccess('');
    
    // Validasi Frontend
    for (const node of selectedIndicators) {
      if (node.tipeTarget === 'Akumulatif') {
        const annualTarget = getEffectiveAnnualTarget(node);
        const monthlySum = getRowTotal(node.id);
        if (Math.abs(monthlySum - annualTarget) > 0.05) {
          setError(`Gagal: Indikator "${node.indikator || node.text}" bertipe Akumulatif. Target tahunan adalah ${annualTarget}, namun total isian bulanan Anda adalah ${monthlySum}.`);
          const el = document.getElementById(`indicator-row-${node.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.boxShadow = '0 0 0 2px var(--danger)';
            setTimeout(() => { el.style.boxShadow = 'none'; }, 3000);
          }
          return;
        }
      } else {
        let isComplete = true;
        for (let m = 1; m <= 12; m++) {
          const val = targetsMap[`${node.id}_${m}`];
          if (val === undefined || val === '') {
            isComplete = false; break;
          }
        }
        if (!isComplete) {
          setError(`Gagal: Indikator "${node.indikator || node.text}" bertipe Non-Akumulatif. Semua 12 bulan wajib diisi.`);
          const el = document.getElementById(`indicator-row-${node.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.boxShadow = '0 0 0 2px var(--danger)';
            setTimeout(() => { el.style.boxShadow = 'none'; }, 3000);
          }
          return;
        }
      }
    }

    try {
      const res = await fetchWithAuth('/api/renaksi/target/submit', {
        method: 'POST',
        body: JSON.stringify({ employeeId: currentUser.id })
      });

      if (res.ok) {
        setSuccess('Perjanjian Kinerja dan Rencana Target berhasil diajukan.');
        loadData();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal mengajukan.');
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan koneksi.');
    }
  };

  const handlePrintClick = () => {
    setError('');
    
    // 1. Cek apakah target sudah diisi
    if (renaksiRecords.length === 0) {
      setError('Anda belum mengisi target bulanan. Silakan isi dan simpan Rencana Aksi terlebih dahulu sebelum mencetak Perjakin.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    // 2. Cek apakah tanda tangan sudah diatur
    const hasSignature = profileInfo?.hasDigitalSignature || profileInfo?.signatureUrl;
    if (!hasSignature) {
      alert('Anda belum mengatur Tanda Tangan Digital. Anda akan dialihkan ke halaman Profil untuk mengaturnya.');
      router.push('/profile');
      return;
    }
    
    // 3. Print
    window.print();
  };

  const targetStatus = getTargetStatusText();
  const isTargetEditable = (targetStatus === 'Draft' || targetStatus === 'Target_Ditolak') && !systemSettings?.renja_locked;

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
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  {targetStatus === 'Draft' && <span className="badge badge-draft" style={{ fontSize: '11px' }}>Draft (Menunggu Diajukan)</span>}
                  {targetStatus === 'Target_Ditolak' && <span className="badge badge-danger" style={{ fontSize: '11px' }}>Target Ditolak (Perlu Revisi)</span>}
                  {targetStatus === 'Menunggu Persetujuan' && <span className="badge badge-warning" style={{ fontSize: '11px' }}>Menunggu Persetujuan</span>}
                  {targetStatus === 'Target Disetujui' && <span className="badge badge-success" style={{ fontSize: '11px' }}>Target Disetujui (Perjakin Sah)</span>}
                </div>
              </div>

              {targetStatus === 'Target_Ditolak' && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{ color: '#EF4444', fontWeight: 600, marginBottom: '8px' }}><i className="fa-solid fa-triangle-exclamation"></i> Ada target yang ditolak oleh Admin/Verifikator:</div>
                  <ul style={{ color: 'var(--text-primary)', margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                    {renaksiRecords.filter(r => r.status === 'Target_Ditolak' && r.catatanAdmin).map(r => {
                      const ind = selectedIndicators.find(i => i.id === r.indicatorId);
                      return <li key={r.id}><strong>{ind?.indikator || 'Indikator'}:</strong> {r.catatanAdmin}</li>;
                    })}
                  </ul>
                  <div style={{ color: '#F59E0B', fontSize: '12px', marginTop: '12px' }}><i className="fa-solid fa-info-circle"></i> Silakan perbaiki inputan target Anda di bawah, sistem akan menyimpan otomatis secara berkala, lalu klik <strong>Ajukan Perjakin</strong> kembali.</div>
                </div>
              )}

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
                      const tipeTarget = node.tipeTarget || node.parentNode?.tipeTarget || 'Kondisi Akhir Menurun';
                      const isAccumulative = tipeTarget === 'Akumulatif';
                      const isSumValid = !isAccumulative || Math.abs(totalSum - effectiveTarget) < 0.05;

                      return (
                        <tr key={node.id} id={`indicator-row-${node.id}`} style={{ transition: 'box-shadow 0.3s' }}>
                          <td>
                            <strong>{node.indikator}</strong>
                            <div className="text-muted" style={{ fontSize: '11px', marginTop: '6px', borderLeft: '2px solid rgba(255,107,0,0.5)', paddingLeft: '6px' }}>
                              <span style={{color: 'var(--primary-orange)'}}>{node.parentNode?.level?.replace('_', ' ').toUpperCase() || 'KEGIATAN'}:</span> {node.parentNode?.text || node.text}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '10px' }}>{tipeTarget}</span>
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
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" onClick={handleAjukanPerjakin}>
                    <i className="fa-solid fa-paper-plane"></i> Ajukan Perjakin & Rencana Target
                  </button>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: '10px' }}>
                    *Sistem menyimpan inputan target Anda secara otomatis. Jika sudah sesuai dengan target tahunan, klik tombol ajukan.
                  </span>
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
            <button className="btn btn-secondary" onClick={handlePrintClick}>
              <i className="fa-solid fa-print"></i> Cetak Dokumen Resmi
            </button>
          </div>

          <div className="print-only-layout" id="pkPrintTemplate" style={{ display: 'block', padding: '30px', background: 'white', color: 'black', position: 'relative', overflow: 'hidden' }}>
            
            {/* Watermark DRAFT */}
            {targetStatus !== 'Target Disetujui' && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-45deg)',
                fontSize: '80px',
                fontWeight: 'bold',
                color: 'rgba(239, 68, 68, 0.15)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                zIndex: 0
              }}>
                DRAFT - BELUM DISETUJUI
              </div>
            )}

            <div style={{ position: 'relative', zIndex: 1 }}>
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
                  <th rowSpan="2" style={{ border: '1px solid black', padding: '4px', textAlign: 'center', width: '30px' }}>No</th>
                  <th rowSpan="2" style={{ border: '1px solid black', padding: '4px', textAlign: 'left' }}>Indikator Kinerja</th>
                  <th colSpan="12" style={{ border: '1px solid black', padding: '4px', textAlign: 'center' }}>Target Bulanan</th>
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
