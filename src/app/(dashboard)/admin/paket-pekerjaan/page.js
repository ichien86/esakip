'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useUI } from '@/context/UIContext';

const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_KEY = ['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];

function formatRp(val) {
  return `Rp${Number(val||0).toLocaleString('id-ID')}`;
}

export default function PaketPekerjaanPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { activeYear } = useUI();
  const [pakets, setPakets] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('master'); // master | realisasi
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1);

  // Smart import state
  const [importType, setImportType] = useState('master');
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const fileRef = useRef();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/paket-pekerjaan?tahun=${activeYear}`);
      if (res.ok) {
        const data = await res.json();
        setPakets(data.pakets || []);
        setIsLocked(data.isLocked || false);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, activeYear]);

  useEffect(() => { loadData(); }, [loadData]);

  // Group pakets by subkegiatan
  const grouped = pakets.reduce((acc, p) => {
    const key = p.subkegiatanId;
    if (!acc[key]) acc[key] = { namaSubkegiatan: p.namaSubkegiatan, items: [] };
    acc[key].items.push(p);
    return acc;
  }, {});

  const handleDownloadTemplate = async (type) => {
    const res = await fetchWithAuth(`/api/admin/paket-pekerjaan/import?type=${type}&tahun=${activeYear}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_${type}_${activeYear}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImportFile(f);
    setImportPreview(null);
    setImportMsg('');
  };

  const handlePreview = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportMsg('');
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('type', importType);
      fd.append('tahun', activeYear);
      fd.append('bulan', selectedBulan);
      fd.append('action', 'preview');
      const res = await fetchWithAuth('/api/admin/paket-pekerjaan/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) setImportPreview(data.preview);
      else setImportMsg(data.error || 'Gagal membaca file');
    } finally {
      setImportLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!importFile || !importPreview) return;
    setImportLoading(true);
    setImportMsg('');
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('type', importType);
      fd.append('tahun', activeYear);
      fd.append('bulan', selectedBulan);
      fd.append('action', 'commit');
      const res = await fetchWithAuth('/api/admin/paket-pekerjaan/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setImportMsg(data.message);
        setImportPreview(null);
        setImportFile(null);
        if (fileRef.current) fileRef.current.value = '';
        await loadData();
        setTimeout(() => { setShowImportModal(false); setImportMsg(''); }, 1500);
      } else {
        setImportMsg(data.error || 'Gagal menyimpan data');
      }
    } finally {
      setImportLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus paket pekerjaan ini?')) return;
    await fetchWithAuth(`/api/admin/paket-pekerjaan?id=${id}`, { method: 'DELETE' });
    await loadData();
  };

  const bulanKey = BULAN_KEY[selectedBulan - 1];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--primary-orange)', marginRight: '10px' }} />
            Manajemen Paket Pekerjaan
          </h1>
          <p className="text-muted">Admin Perencana — Kelola paket pekerjaan dan realisasi anggaran bulanan</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => { setImportType('master'); setShowImportModal(true); }}>
            <i className="fa-solid fa-file-import" /> Import Master Paket
          </button>
          <button className="btn btn-secondary" onClick={() => { setImportType('realisasi'); setShowImportModal(true); }}>
            <i className="fa-solid fa-money-bill-trend-up" /> Import Realisasi Anggaran
          </button>
        </div>
      </div>

      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[['master', 'Daftar Paket Pekerjaan'], ['realisasi', 'Realisasi Anggaran Bulanan']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '13px' }}
          >
            {label}
          </button>
        ))}
        {tab === 'realisasi' && (
          <select className="form-input" value={selectedBulan} onChange={e => setSelectedBulan(parseInt(e.target.value))} style={{ width: 'auto', padding: '6px 12px' }}>
            {BULAN_NAMES.map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-circle-notch fa-spin" /> Memuat data...
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-inbox" style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }} />
          <p>Belum ada paket pekerjaan. Gunakan tombol Import Master Paket untuk menambahkan data awal tahun.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(grouped).map(([subId, group]) => {
            const totalPagu = group.items.reduce((s, p) => s + (p.paguAnggaran || 0), 0);
            const totalRealisasi = group.items.reduce((s, p) => s + (p.realisasiAnggaran?.[bulanKey] || 0), 0);
            const serapan = totalPagu > 0 ? ((totalRealisasi / totalPagu) * 100).toFixed(1) : 0;

            return (
              <div key={subId} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      {group.namaSubkegiatan || subId}
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>ID: {subId}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontSize: '11px' }}>
                      Total Pagu: {formatRp(totalPagu)}
                    </span>
                    {tab === 'realisasi' && (
                      <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', fontSize: '11px' }}>
                        Realisasi {BULAN_NAMES[selectedBulan-1]}: {formatRp(totalRealisasi)} ({serapan}%)
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>Nama Paket</th>
                        <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>Pagu</th>
                        {tab === 'realisasi' && <>
                          <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>Realisasi {BULAN_NAMES[selectedBulan-1]}</th>
                          <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>Serapan</th>
                        </>}
                        <th style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(p => {
                        const ral = p.realisasiAnggaran?.[bulanKey] || 0;
                        const srap = p.paguAnggaran > 0 ? ((ral / p.paguAnggaran) * 100).toFixed(1) : 0;
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{p.namaPaket}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatRp(p.paguAnggaran)}</td>
                            {tab === 'realisasi' && <>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#10b981' }}>{formatRp(ral)}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                <span style={{ color: parseFloat(srap) >= 100 ? '#10b981' : parseFloat(srap) >= 50 ? '#f59e0b' : 'var(--danger)', fontWeight: 600 }}>
                                  {srap}%
                                </span>
                              </td>
                            </>}
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <button onClick={() => handleDelete(p.id)} className="btn btn-danger" style={{ fontSize: '11px', padding: '4px 10px' }}>
                                <i className="fa-solid fa-trash" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Smart Import Modal */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                <i className="fa-solid fa-file-import" style={{ color: 'var(--primary-orange)', marginRight: '8px' }} />
                Smart Import — {importType === 'master' ? 'Master Paket Pekerjaan' : 'Realisasi Anggaran'}
              </h2>
              <button onClick={() => { setShowImportModal(false); setImportPreview(null); setImportFile(null); setImportMsg(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                {importType === 'master'
                  ? '📋 Upload file Excel berisi daftar Subkegiatan, Paket Pekerjaan, dan Pagu Anggaran untuk tahun berjalan.'
                  : '💰 Upload file Excel berisi Realisasi Anggaran per Paket Pekerjaan untuk bulan yang dipilih.'}
              </p>
            </div>

            {importType === 'realisasi' && (
              <div className="form-group">
                <label className="form-label">Bulan Realisasi</label>
                <select className="form-input" value={selectedBulan} onChange={e => setSelectedBulan(parseInt(e.target.value))}>
                  {BULAN_NAMES.map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Unduh Template</label>
              <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => handleDownloadTemplate(importType)}>
                <i className="fa-solid fa-download" /> Download Template Excel
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Pilih File Excel (.xlsx)</label>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="form-input" />
            </div>

            {importFile && !importPreview && (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handlePreview} disabled={importLoading}>
                {importLoading ? <><i className="fa-solid fa-circle-notch fa-spin" /> Membaca file...</> : <><i className="fa-solid fa-eye" /> Pratinjau Data</>}
              </button>
            )}

            {/* Smart Preview Card */}
            {importPreview && (
              <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', color: '#10b981', fontWeight: 700 }}>
                  <i className="fa-solid fa-circle-check" /> Pratinjau Data Berhasil Dibaca
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Jumlah Data</p>
                    <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{importPreview.totalData}</p>
                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>paket pekerjaan</p>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{importType === 'master' ? 'Total Pagu Anggaran' : `Total Realisasi ${BULAN_NAMES[selectedBulan-1]}`}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 700, color: '#f59e0b' }}>
                      {formatRp(importType === 'master' ? importPreview.totalPagu : importPreview.totalRealisasi)}
                    </p>
                  </div>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-muted)' }}>5 baris pertama:</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr>
                        {importType === 'master'
                          ? ['Subkegiatan', 'Nama Paket', 'Pagu'].map(h => <th key={h} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', textAlign: 'left' }}>{h}</th>)
                          : ['ID/Nama Paket', 'Realisasi'].map(h => <th key={h} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', textAlign: 'left' }}>{h}</th>)
                        }
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                          {importType === 'master' ? <>
                            <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{item.namaSubkegiatan}</td>
                            <td style={{ padding: '4px 8px', color: 'var(--text-primary)' }}>{item.namaPaket}</td>
                            <td style={{ padding: '4px 8px', color: '#10b981' }}>{formatRp(item.paguAnggaran)}</td>
                          </> : <>
                            <td style={{ padding: '4px 8px', color: 'var(--text-primary)' }}>{item.namaPaket || item.id}</td>
                            <td style={{ padding: '4px 8px', color: '#10b981' }}>{formatRp(item.realisasi)}</td>
                          </>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setImportPreview(null); setImportFile(null); if(fileRef.current) fileRef.current.value=''; }}>
                    <i className="fa-solid fa-arrow-left" /> Ganti File
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCommit} disabled={importLoading}>
                    {importLoading ? <><i className="fa-solid fa-circle-notch fa-spin" /> Menyimpan...</> : <><i className="fa-solid fa-cloud-arrow-up" /> Konfirmasi & Simpan</>}
                  </button>
                </div>
              </div>
            )}

            {importMsg && (
              <p style={{ marginTop: '12px', padding: '10px', borderRadius: '8px', background: importMsg.includes('berhasil') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: importMsg.includes('berhasil') ? '#10b981' : 'var(--danger)', fontSize: '13px' }}>
                <i className={`fa-solid ${importMsg.includes('berhasil') ? 'fa-circle-check' : 'fa-circle-exclamation'}`} /> {importMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
