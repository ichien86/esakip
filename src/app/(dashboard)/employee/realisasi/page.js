'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function EmployeeRealisasiPage() {
  const { fetchWithAuth, currentUser, activeBidang } = useSimulation();

  const [selectedIndicators, setSelectedIndicators] = useState([]);
  const [renaksiRecords, setRenaksiRecords] = useState([]);

  // Selections
  const [selectedId, setSelectedId] = useState('');
  const [selectedBulan, setSelectedBulan] = useState('1');

  // Input states
  const [realisasiValue, setRealisasiValue] = useState('');
  const [buktiDukung, setBuktiDukung] = useState('');
  const [verifyStatus, setVerifyStatus] = useState(null); // { isDrive, isPublic, message }
  const [checkingLink, setCheckingLink] = useState(false);

  // Operational variables inputs
  const [variabelJumlahVal, setVariabelJumlahVal] = useState('');
  const [variabelPembilangVal, setVariabelPembilangVal] = useState('');
  const [variabelPenyebutVal, setVariabelPenyebutVal] = useState('');

  const [kendala, setKendala] = useState('');
  const [solusi, setSolusi] = useState('');
  const [pendorong, setPendorong] = useState('');
  const [inovasi, setInovasi] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      // 1. Fetch selection list
      const selRes = await fetch(`/api/selections/${currentUser.id}`);
      let selectedIds = [];
      if (selRes.ok) {
        const selData = await selRes.json();
        selectedIds = selData.selectedIndicators || [];
      }

      // 2. Fetch annual Renja nodes
      const nodesRes = await fetch('/api/renja/2026');
      let matchedNodes = [];
      if (nodesRes.ok) {
        const allNodes = await nodesRes.json();
        matchedNodes = allNodes.filter(n => selectedIds.includes(n.id));
        setSelectedIndicators(matchedNodes);
        if (matchedNodes.length > 0) {
          setSelectedId(matchedNodes[0].id);
        }
      }

      // 3. Fetch existing Renaksi records
      const rxRes = await fetch(`/api/renaksi/${currentUser.id}/2026`);
      if (rxRes.ok) {
        setRenaksiRecords(await rxRes.json());
      }
    } catch (e) {
      console.error('Failed to load realisasi data sources', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  // Load existing realization values when indicator or month changes
  const activeRecord = renaksiRecords.find(
    r => r.indicatorId === selectedId && r.bulan === parseInt(selectedBulan)
  );

  const activeNode = selectedIndicators.find(n => n.id === selectedId);

  useEffect(() => {
    if (activeRecord) {
      setRealisasiValue(activeRecord.realisasiBulanan !== null ? activeRecord.realisasiBulanan.toString() : '');
      setVariabelJumlahVal(activeRecord.variabelJumlahVal !== null ? activeRecord.variabelJumlahVal.toString() : '');
      setVariabelPembilangVal(activeRecord.variabelPembilangVal !== null ? activeRecord.variabelPembilangVal.toString() : '');
      setVariabelPenyebutVal(activeRecord.variabelPenyebutVal !== null ? activeRecord.variabelPenyebutVal.toString() : '');
      setBuktiDukung(activeRecord.buktiDukung || '');
      setKendala(activeRecord.kendala || '');
      setSolusi(activeRecord.solusi || '');
      setPendorong(activeRecord.faktorPendorong || '');
      setInovasi(activeRecord.inovasi || '');
      setVerifyStatus(null);
    } else {
      setRealisasiValue('');
      setVariabelJumlahVal('');
      setVariabelPembilangVal('');
      setVariabelPenyebutVal('');
      setBuktiDukung('');
      setKendala('');
      setSolusi('');
      setPendorong('');
      setInovasi('');
      setVerifyStatus(null);
    }
  }, [selectedId, selectedBulan, renaksiRecords]);

  // Dynamic automatic calculation of Realisasi on the fly
  useEffect(() => {
    if (activeNode) {
      if (activeNode.metodePenghitungan === 'Persentase') {
        const p = parseFloat(variabelPembilangVal);
        const y = parseFloat(variabelPenyebutVal);
        if (!isNaN(p) && !isNaN(y) && y !== 0) {
          const calc = ((p / y) * 100).toFixed(2);
          setRealisasiValue(parseFloat(calc).toString());
        } else {
          setRealisasiValue('');
        }
      } else if (activeNode.metodePenghitungan === 'Jumlah') {
        const v = parseFloat(variabelJumlahVal);
        if (!isNaN(v)) {
          setRealisasiValue(v.toString());
        } else {
          setRealisasiValue('');
        }
      }
    }
  }, [variabelJumlahVal, variabelPembilangVal, variabelPenyebutVal, activeNode]);

  // Google Drive link verification
  const handleVerifyLink = async (url) => {
    setBuktiDukung(url);
    if (!url) {
      setVerifyStatus(null);
      return;
    }
    setCheckingLink(true);
    setVerifyStatus({ checking: true, message: 'Memverifikasi link...' });
    try {
      const res = await fetch('/api/verify-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (res.ok) {
        const result = await res.json();
        setVerifyStatus(result);
      } else {
        setVerifyStatus({ isDrive: false, isPublic: false, message: 'Gagal menghubungi server verifikasi.' });
      }
    } catch (e) {
      setVerifyStatus({ isDrive: false, isPublic: false, message: 'Kesalahan jaringan.' });
    } finally {
      setCheckingLink(false);
    }
  };

  const handleSaveRealisasi = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!activeRecord) {
      setError('Target bulanan untuk indikator dan bulan terpilih belum diatur.');
      return;
    }

    const target = activeRecord.targetBulanan;
    let realisasi = parseFloat(realisasiValue);

    // Validate variables on client-side too
    if (activeNode) {
      if (activeNode.metodePenghitungan === 'Persentase') {
        const p = parseFloat(variabelPembilangVal);
        const y = parseFloat(variabelPenyebutVal);
        if (isNaN(p) || isNaN(y)) {
          setError('Variabel pembilang dan penyebut wajib diisi angka.');
          return;
        }
        if (y === 0) {
          setError('Variabel penyebut tidak boleh bernilai 0.');
          return;
        }
        realisasi = parseFloat(((p / y) * 100).toFixed(2));
      } else if (activeNode.metodePenghitungan === 'Jumlah') {
        const v = parseFloat(variabelJumlahVal);
        if (isNaN(v)) {
          setError('Variabel jumlah wajib diisi angka.');
          return;
        }
        realisasi = v;
      } else {
        if (isNaN(realisasi)) {
          setError('Realisasi wajib berupa angka.');
          return;
        }
      }
    }

    // Validation condition
    const isDecreasing = activeNode && activeNode.tipeTarget === 'Kondisi Akhir Menurun';
    const isUnderperforming = isDecreasing ? realisasi > target : realisasi < target;

    const payload = {
      employeeId: currentUser.id,
      indicatorId: selectedId,
      bulan: parseInt(selectedBulan),
      realisasiBulanan: realisasi,
      buktiDukung,
      kendala: isUnderperforming ? kendala : '',
      solusi: isUnderperforming ? solusi : '',
      faktorPendorong: isUnderperforming ? '' : pendorong,
      inovasi: isUnderperforming ? '' : inovasi,
      status: 'Diajukan',
      variabelJumlahVal: activeNode?.metodePenghitungan === 'Jumlah' ? variabelJumlahVal : '',
      variabelPembilangVal: activeNode?.metodePenghitungan === 'Persentase' ? variabelPembilangVal : '',
      variabelPenyebutVal: activeNode?.metodePenghitungan === 'Persentase' ? variabelPenyebutVal : ''
    };

    try {
      const res = await fetchWithAuth('/api/renaksi/realisasi', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccess('Laporan realisasi bulanan berhasil diajukan.');
        // Refresh records list
        const rxRes = await fetch(`/api/renaksi/${currentUser.id}/2026`);
        if (rxRes.ok) {
          setRenaksiRecords(await rxRes.json());
        }
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan realisasi.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  // Determine which subform to render based on compliance
  const targetVal = activeRecord ? activeRecord.targetBulanan : 0;
  const currentReal = parseFloat(realisasiValue);
  const isDecreasing = activeNode && activeNode.tipeTarget === 'Kondisi Akhir Menurun';
  
  const showUnderperformSubform = !isNaN(currentReal) && (
    isDecreasing ? currentReal > targetVal : currentReal < targetVal
  );

  const showExceededSubform = !isNaN(currentReal) && (
    isDecreasing ? currentReal <= targetVal : currentReal >= targetVal
  );

  const getVerifyBadge = () => {
    if (!verifyStatus) return null;
    if (verifyStatus.checking) return <div className="verify-badge checking"><i className="fa-solid fa-spinner fa-spin"></i> {verifyStatus.message}</div>;
    
    if (verifyStatus.isDrive) {
      if (verifyStatus.isPublic) {
        return <div className="verify-badge verified-public"><i className="fa-solid fa-circle-check"></i> Link Publik (Siap diverifikasi)</div>;
      } else {
        return <div className="verify-badge verified-private"><i className="fa-solid fa-circle-xmark"></i> Link Privat (Butuh Akses / Login)</div>;
      }
    }
    return <div className="verify-badge verified-external"><i className="fa-solid fa-link"></i> {verifyStatus.message}</div>;
  };

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3><i className="fa-solid fa-circle-play text-orange"></i> Laporan Capaian Realisasi Bulanan</h3>
        <p className="text-muted">Laporkan realisasi bulanan Anda dan lampirkan link dokumen pendukung sebagai bukti verifikasi atasan.</p>
      </div>

      <div className="panel-body">
        {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
        {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}><i className="fa-solid fa-circle-notch fa-spin"></i> Memuat form...</div>
        ) : selectedIndicators.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
            Anda belum memilih indikator IKU. Silakan masuk ke menu <strong>Pilih Indikator IKU</strong> terlebih dahulu.
          </div>
        ) : (
          <form onSubmit={handleSaveRealisasi}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label>1. Pilih Indikator:</label>
                <select className="select-sim mt-1" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  {selectedIndicators.map(node => (
                    <option key={node.id} value={node.id}>{node.text}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>2. Pilih Bulan Laporan:</label>
                <select className="select-sim mt-1" value={selectedBulan} onChange={(e) => setSelectedBulan(e.target.value)}>
                  <option value="1">Januari</option>
                  <option value="2">Februari</option>
                  <option value="3">Maret</option>
                  <option value="4">April</option>
                  <option value="5">Mei</option>
                  <option value="6">Juni</option>
                  <option value="7">Juli</option>
                  <option value="8">Agustus</option>
                  <option value="9">September</option>
                  <option value="10">Oktober</option>
                  <option value="11">November</option>
                  <option value="12">Desember</option>
                </select>
              </div>
            </div>

            {activeRecord ? (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)', marginBottom: '20px' }}>
                <p style={{ fontSize: '14px' }}>
                  Target Bulan Ini: <strong style={{ color: 'var(--primary-orange)' }}>{targetVal}</strong> {activeNode?.satuan}
                  {activeNode?.tipeTarget === 'Kondisi Akhir Menurun' && (
                    <span className="badge badge-score" style={{ marginLeft: '10px' }}>Tipe: Target Menurun</span>
                  )}
                </p>
                {activeRecord.status === 'Disetujui' && (
                  <p style={{ marginTop: '6px', color: 'var(--success)', fontSize: '12px' }}>
                    <i className="fa-solid fa-circle-check"></i> Laporan ini telah disetujui oleh atasan langsung Anda.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--danger)', marginBottom: '20px', fontSize: '13px' }}>
                Target bulanan belum diset. Silakan isi matriks target terlebih dahulu.
              </div>
            )}

            {activeRecord && (
              <>
                {/* Operational variable inputs based on calculation method */}
                {activeNode?.metodePenghitungan === 'Persentase' ? (
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--primary-orange)', fontWeight: 600 }}>
                      <i className="fa-solid fa-calculator"></i> Penghitungan Persentase Indikator
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '12px' }}>
                        {activeNode.variabelPembilang || "Variabel Pembilang (Numerator)"}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        disabled={activeRecord.status === 'Disetujui'}
                        value={variabelPembilangVal}
                        onChange={(e) => setVariabelPembilangVal(e.target.value)}
                        required
                        placeholder="Masukkan nilai pembilang"
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '12px' }}>
                        {activeNode.variabelPenyebut || "Variabel Penyebut (Denominator)"}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        disabled={activeRecord.status === 'Disetujui'}
                        value={variabelPenyebutVal}
                        onChange={(e) => setVariabelPenyebutVal(e.target.value)}
                        required
                        placeholder="Masukkan nilai penyebut"
                      />
                    </div>
                    
                    {realisasiValue !== '' && (
                      <div style={{ marginTop: '8px', fontSize: '13px', background: 'rgba(59, 130, 246, 0.15)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                        Persentase Capaian Terhitung: <strong>{realisasiValue}%</strong>
                      </div>
                    )}
                  </div>
                ) : activeNode?.metodePenghitungan === 'Jumlah' ? (
                  <div className="form-group mb-3">
                    <label>{activeNode.variabelJumlah || "Jumlah Capaian"}</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      disabled={activeRecord.status === 'Disetujui'}
                      value={variabelJumlahVal}
                      onChange={(e) => setVariabelJumlahVal(e.target.value)}
                      required
                      placeholder="Masukkan angka capaian"
                    />
                  </div>
                ) : (
                  <div className="form-group mb-3">
                    <label>Angka Realisasi Capaian</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      disabled={activeRecord.status === 'Disetujui'}
                      value={realisasiValue}
                      onChange={(e) => setRealisasiValue(e.target.value)}
                      required
                      placeholder="Masukkan angka pencapaian"
                    />
                  </div>
                )}

                <div className="form-group mb-3">
                  <label>Link Data Dukung (Google Drive / Spreadsheet Publik)</label>
                  <div className="input-verify-wrapper">
                    <input
                      type="text"
                      className="form-control"
                      disabled={activeRecord.status === 'Disetujui'}
                      value={buktiDukung}
                      onChange={(e) => handleVerifyLink(e.target.value)}
                      placeholder="Contoh: https://drive.google.com/file/d/.../view"
                      required
                    />
                    {getVerifyBadge()}
                  </div>
                </div>

                {/* Case A: Underperform (requires Kendala & Solusi) */}
                {showUnderperformSubform && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '20px'
                  }}>
                    <h5 style={{ color: 'var(--warning)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <i className="fa-solid fa-triangle-exclamation"></i> Kinerja Di Bawah Target
                    </h5>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Realisasi Anda di bawah target (atau melebihi batas target menurun). Anda wajib mengisi hambatan kendala dan rencana perbaikan.
                    </p>
                    <div className="form-group mb-2">
                      <label style={{ fontSize: '12px' }}>Kendala / Hambatan Lapangan</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        disabled={activeRecord.status === 'Disetujui'}
                        value={kendala}
                        onChange={(e) => setKendala(e.target.value)}
                        required
                        placeholder="Jelaskan kendala apa yang terjadi..."
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '12px' }}>Rencana Solusi / Tindak Lanjut</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        disabled={activeRecord.status === 'Disetujui'}
                        value={solusi}
                        onChange={(e) => setSolusi(e.target.value)}
                        required
                        placeholder="Jelaskan perbaikan untuk bulan berikutnya..."
                      />
                    </div>
                  </div>
                )}

                {/* Case B: Met/Exceeded (requires Pendorong & Inovasi) */}
                {showExceededSubform && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '20px'
                  }}>
                    <h5 style={{ color: 'var(--success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <i className="fa-solid fa-circle-check"></i> Kinerja Memenuhi/Melampaui Target
                    </h5>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Kerja bagus! Silakan isi faktor pendukung keberhasilan serta inovasi taktis yang Anda lakukan.
                    </p>
                    <div className="form-group mb-2">
                      <label style={{ fontSize: '12px' }}>Faktor Pendorong Keberhasilan</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        disabled={activeRecord.status === 'Disetujui'}
                        value={pendorong}
                        onChange={(e) => setPendorong(e.target.value)}
                        required
                        placeholder="Jelaskan faktor pendukung (misal dukungan logistik, koordinasi cepat)..."
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '12px' }}>Inovasi Kinerja (Jika Ada)</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        disabled={activeRecord.status === 'Disetujui'}
                        value={inovasi}
                        onChange={(e) => setInovasi(e.target.value)}
                        required
                        placeholder="Jelaskan inovasi metode kerja baru yang Anda buat..."
                      />
                    </div>
                  </div>
                )}

                {activeRecord.status !== 'Disetujui' && (
                  <button type="submit" className="btn btn-orange w-full" style={{ marginTop: '10px' }}>
                    <i className="fa-solid fa-paper-plane"></i> Ajukan Laporan Realisasi
                  </button>
                )}
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
