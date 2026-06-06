'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function AdminMasterPage() {
  const { fetchWithAuth, activeRole } = useSimulation();
  
  const [programs, setPrograms] = useState([]);
  const [kegiatans, setKegiatans] = useState([]);
  const [subkegiatans, setSubkegiatans] = useState([]);

  // Form states
  const [progNama, setProgNama] = useState('');
  const [kegProgramId, setKegProgramId] = useState('');
  const [kegNama, setKegNama] = useState('');
  const [subkegKegiatanId, setSubkegKegiatanId] = useState('');
  const [subkegNama, setSubkegNama] = useState('');
  const [subkegIndikator, setSubkegIndikator] = useState('');
  const [subkegSatuan, setSubkegSatuan] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [isProgCollapsed, setIsProgCollapsed] = useState(false);
  const [isKegCollapsed, setIsKegCollapsed] = useState(false);
  const [isSubkegCollapsed, setIsSubkegCollapsed] = useState(false);

  const [progSearch, setProgSearch] = useState('');
  const [kegSearch, setKegSearch] = useState('');
  const [subkegSearch, setSubkegSearch] = useState('');
  
  const [importPreview, setImportPreview] = useState(null);
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const hasAccess = activeRole === 'admin' || activeRole === 'perencana';

  const loadData = async () => {
    try {
      const pRes = await fetch('/api/master/program');
      if (pRes.ok) setPrograms(await pRes.json());

      const kRes = await fetch('/api/master/kegiatan');
      if (kRes.ok) setKegiatans(await kRes.json());

      const sRes = await fetch('/api/master/subkegiatan');
      if (sRes.ok) setSubkegiatans(await sRes.json());
    } catch (e) {
      console.error('Failed to load master data libraries', e);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [activeRole]);

  const handleLoadImportPreview = async (fileToUpload) => {
    if (!fileToUpload) {
      setError('Silakan pilih file Excel terlebih dahulu.');
      return;
    }
    setIsImportLoading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      const res = await fetchWithAuth('/api/admin/master/import-preview', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setImportPreview(data);
        setShowImportModal(true);
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal memuat preview data Excel.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleUpdateSingleItem = async (type, actionData, categoryKey, itemId) => {
    setIsImportLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth('/api/admin/master/import-apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, actionData })
      });

      if (res.ok) {
        setSuccess(`Item master ${type} berhasil diperbarui!`);
        
        // Remove item from importPreview state
        setImportPreview(prev => {
          if (!prev) return null;
          
          const newDetails = { ...prev.details };
          newDetails[categoryKey] = newDetails[categoryKey].filter(item => item.id !== itemId);
          
          const newSummary = { ...prev.summary };
          if (categoryKey === 'newPrograms') newSummary.newProgramsCount = newDetails.newPrograms.length;
          if (categoryKey === 'updatedPrograms') newSummary.updatedProgramsCount = newDetails.updatedPrograms.length;
          if (categoryKey === 'newKegiatans') newSummary.newKegiatansCount = newDetails.newKegiatans.length;
          if (categoryKey === 'updatedKegiatans') newSummary.updatedKegiatansCount = newDetails.updatedKegiatans.length;
          if (categoryKey === 'newSubkegiatans') newSummary.newSubkegiatansCount = newDetails.newSubkegiatans.length;
          if (categoryKey === 'updatedSubkegiatans') newSummary.updatedSubkegiatansCount = newDetails.updatedSubkegiatans.length;

          const totalLeft = newSummary.newProgramsCount + newSummary.updatedProgramsCount +
                            newSummary.newKegiatansCount + newSummary.updatedKegiatansCount +
                            newSummary.newSubkegiatansCount + newSummary.updatedSubkegiatansCount;
          
          if (totalLeft === 0) {
            setShowImportModal(false);
            return null;
          }

          return {
            ...prev,
            summary: newSummary,
            details: newDetails
          };
        });

        loadData();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal memperbarui item.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleApplyImport = async () => {
    if (!importPreview) return;
    setIsImportLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        bulk: true,
        data: {
          programs: [
            ...importPreview.details.newPrograms.map(p => p.actionData),
            ...importPreview.details.updatedPrograms.map(p => p.actionData)
          ],
          kegiatans: [
            ...importPreview.details.newKegiatans.map(k => k.actionData),
            ...importPreview.details.updatedKegiatans.map(k => k.actionData)
          ],
          subkegiatans: [
            ...importPreview.details.newSubkegiatans.map(s => s.actionData),
            ...importPreview.details.updatedSubkegiatans.map(s => s.actionData)
          ]
        }
      };

      const res = await fetchWithAuth('/api/admin/master/import-apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccess('Kamus data subkegiatan dari Excel berhasil diimpor sepenuhnya!');
        setShowImportModal(false);
        setImportPreview(null);
        setSelectedFile(null);
        loadData();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menerapkan impor data Excel.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    } finally {
      setIsImportLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa-solid fa-ban text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Akses Ditolak</h2>
        <p className="text-muted" style={{ marginTop: '8px' }}>Hanya Administrator atau Admin Perencana yang diperbolehkan mengelola pustaka data master.</p>
      </div>
    );
  }

  // Program submit
  const handleAddProgram = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth('/api/master/program', {
        method: 'POST',
        body: JSON.stringify({ nama: progNama })
      });
      if (res.ok) {
        setSuccess('Program master berhasil ditambahkan.');
        setProgNama('');
        loadData();
      } else {
        setError('Gagal menambahkan program.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  // Kegiatan submit
  const handleAddKegiatan = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!kegProgramId) {
      setError('Pilih program induk terlebih dahulu.');
      return;
    }
    try {
      const res = await fetchWithAuth('/api/master/kegiatan', {
        method: 'POST',
        body: JSON.stringify({ programId: kegProgramId, nama: kegNama })
      });
      if (res.ok) {
        setSuccess('Kegiatan master berhasil ditambahkan.');
        setKegNama('');
        loadData();
      } else {
        setError('Gagal menambahkan kegiatan.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  // Subkegiatan submit
  const handleAddSubkegiatan = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!subkegKegiatanId) {
      setError('Pilih kegiatan induk terlebih dahulu.');
      return;
    }
    try {
      const res = await fetchWithAuth('/api/master/subkegiatan', {
        method: 'POST',
        body: JSON.stringify({
          kegiatanId: subkegKegiatanId,
          nama: subkegNama,
          indikator: subkegIndikator,
          satuan: subkegSatuan
        })
      });
      if (res.ok) {
        setSuccess('Subkegiatan master berhasil ditambahkan.');
        setSubkegNama('');
        setSubkegIndikator('');
        setSubkegSatuan('');
        loadData();
      } else {
        setError('Gagal menambahkan subkegiatan.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  // Deletions
  const handleDeleteItem = async (type, id) => {
    if (!confirm(`Yakin ingin menghapus item master ${type} ini?`)) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(`/api/master/${type}/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSuccess(`Data master ${type} berhasil dihapus.`);
        loadData();
      } else {
        setError(`Gagal menghapus data master ${type}.`);
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const filteredPrograms = programs.filter(p => 
    p.nama.toLowerCase().includes(progSearch.toLowerCase()) || 
    p.id.toLowerCase().includes(progSearch.toLowerCase())
  );

  const filteredKegiatans = kegiatans.filter(k => {
    const prog = programs.find(p => p.id === k.programId);
    const progName = prog ? prog.nama : '';
    return k.nama.toLowerCase().includes(kegSearch.toLowerCase()) || 
           progName.toLowerCase().includes(kegSearch.toLowerCase()) ||
           k.id.toLowerCase().includes(kegSearch.toLowerCase());
  });

  const filteredSubkegiatans = subkegiatans.filter(s => {
    const keg = kegiatans.find(k => k.id === s.kegiatanId);
    const kegName = keg ? keg.nama : '';
    return s.nama.toLowerCase().includes(subkegSearch.toLowerCase()) || 
           s.indikator.toLowerCase().includes(subkegSearch.toLowerCase()) || 
           kegName.toLowerCase().includes(subkegSearch.toLowerCase()) ||
           s.id.toLowerCase().includes(subkegSearch.toLowerCase());
  });

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {error && <div className="glass-panel" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '15px', margin: 0 }}>{error}</div>}
      {success && <div className="glass-panel" style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '15px', margin: 0 }}>{success}</div>}

      {/* Excel Import Panel */}
      <div className="glass-panel" style={{ border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.03)', padding: '20px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-file-excel text-orange"></i> Impor Kamus Data Master Excel
        </h3>
        <p className="text-muted" style={{ fontSize: '13px', marginTop: '6px', marginBottom: '20px' }}>
          Mutakhirkan database Master Program, Kegiatan, dan Subkegiatan. Unggah berkas Excel (.xlsx atau .xls) dari perangkat Anda untuk memproses dan memperbarui data master.
        </p>

        <div style={{ background: 'rgba(15, 23, 42, 0.3)', padding: '20px', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
          <div>
            <h4 style={{ fontSize: '14px', margin: '0 0 8px 0', color: 'white' }}>Unggah File Excel</h4>
            <p className="text-muted" style={{ fontSize: '12px', margin: '0 0 16px 0', lineHeight: '1.4' }}>
              Pilih file Excel yang berisi daftar Program, Kegiatan, dan Subkegiatan beserta Indikator dan Satuan.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                style={{ fontSize: '13px', color: 'var(--text-muted)' }}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-orange"
            disabled={isImportLoading || !selectedFile}
            onClick={() => handleLoadImportPreview(selectedFile)}
            style={{ width: '100%', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isImportLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
            Proses & Preview File Unggahan
          </button>
        </div>
      </div>

      {/* Import Preview Modal */}
      {showImportModal && importPreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,107,0,0.3)'
          }}>
            <div className="panel-header justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <h3><i className="fa-solid fa-file-excel text-orange"></i> Preview Perubahan Kamus Data Excel</h3>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            
            <div className="panel-body" style={{ padding: '20px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px' }}>
                Berikut adalah ringkasan perbedaan data di file Excel dibandingkan dengan database kamus data saat ini. Anda dapat menyetujui perubahan satu per satu atau menerapkan seluruhnya sekaligus.
              </p>
              
              {/* Summary grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#10B981', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Data Baru (Akan Ditambahkan)</span>
                  <div style={{ fontSize: '12px', color: 'white', marginTop: '6px', lineHeight: '1.4' }}>
                    • Program Baru: <strong>{importPreview.summary.newProgramsCount}</strong><br />
                    • Kegiatan Baru: <strong>{importPreview.summary.newKegiatansCount}</strong><br />
                    • Subkegiatan Baru: <strong>{importPreview.summary.newSubkegiatansCount}</strong>
                  </div>
                </div>
                
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#F59E0B', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Data Update (Teks/Uraian Berubah)</span>
                  <div style={{ fontSize: '12px', color: 'white', marginTop: '6px', lineHeight: '1.4' }}>
                    • Program Update: <strong>{importPreview.summary.updatedProgramsCount}</strong><br />
                    • Kegiatan Update: <strong>{importPreview.summary.updatedKegiatansCount}</strong><br />
                    • Subkegiatan Update: <strong>{importPreview.summary.updatedSubkegiatansCount}</strong>
                  </div>
                </div>
              </div>

              {/* Warnings details */}
              {(importPreview.summary.updatedProgramsCount > 0 || importPreview.summary.updatedKegiatansCount > 0 || importPreview.summary.updatedSubkegiatansCount > 0) && (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '12px', borderRadius: '8px', color: '#EF4444', fontSize: '11px', lineHeight: '1.4' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
                  <strong>Perhatian:</strong> Perubahan nama/indikator pada data master yang sedang digunakan di cascading tahunan (Renja) atau 5 tahunan akan memicu peringatan pemutakhiran data pada dashboard Admin Bidang pengampu.
                </div>
              )}

              {/* Detailed Lists - Program */}
              {(importPreview.details.newPrograms.length > 0 || importPreview.details.updatedPrograms.length > 0) && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <h4 style={{ fontSize: '13px', color: 'white', margin: '0 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-folder text-orange"></i> Program Perubahan
                  </h4>
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    <table className="table" style={{ fontSize: '12px', width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px' }}>ID</th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>Tipe</th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>Perubahan</th>
                          <th style={{ textAlign: 'right', padding: '6px' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.details.newPrograms.map(p => (
                          <tr key={`new-prog-${p.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '6px' }}><code>{p.id}</code></td>
                            <td style={{ padding: '6px' }}><span className="badge" style={{ background: '#10B981', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Baru</span></td>
                            <td style={{ padding: '6px' }}>Nama: <strong>{p.nama}</strong></td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>
                              <button className="btn btn-sm btn-orange" style={{ padding: '2px 8px', fontSize: '11px', width: 'auto' }} onClick={() => handleUpdateSingleItem('program', p.actionData, 'newPrograms', p.id)}>Update</button>
                            </td>
                          </tr>
                        ))}
                        {importPreview.details.updatedPrograms.map(p => (
                          <tr key={`upd-prog-${p.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '6px' }}><code>{p.id}</code></td>
                            <td style={{ padding: '6px' }}><span className="badge" style={{ background: '#F59E0B', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Ubah</span></td>
                            <td style={{ padding: '6px' }}>
                              Nama: <span className="text-danger" style={{ textDecoration: 'line-through' }}>{p.oldNama}</span>
                              <i className="fa-solid fa-arrow-right" style={{ margin: '0 6px', color: 'var(--text-muted)' }}></i>
                              <span className="text-success">{p.newNama}</span>
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>
                              <button className="btn btn-sm btn-orange" style={{ padding: '2px 8px', fontSize: '11px', width: 'auto' }} onClick={() => handleUpdateSingleItem('program', p.actionData, 'updatedPrograms', p.id)}>Update</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detailed Lists - Kegiatan */}
              {(importPreview.details.newKegiatans.length > 0 || importPreview.details.updatedKegiatans.length > 0) && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <h4 style={{ fontSize: '13px', color: 'white', margin: '0 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-folder-open text-orange"></i> Kegiatan Perubahan
                  </h4>
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    <table className="table" style={{ fontSize: '12px', width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px' }}>ID / Program</th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>Tipe</th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>Perubahan</th>
                          <th style={{ textAlign: 'right', padding: '6px' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.details.newKegiatans.map(k => (
                          <tr key={`new-keg-${k.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '6px' }}><code>{k.id}</code><br /><span className="text-muted" style={{ fontSize: '10px' }}>Prog: {k.programId}</span></td>
                            <td style={{ padding: '6px' }}><span className="badge" style={{ background: '#10B981', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Baru</span></td>
                            <td style={{ padding: '6px' }}>Nama: <strong>{k.nama}</strong></td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>
                              <button className="btn btn-sm btn-orange" style={{ padding: '2px 8px', fontSize: '11px', width: 'auto' }} onClick={() => handleUpdateSingleItem('kegiatan', k.actionData, 'newKegiatans', k.id)}>Update</button>
                            </td>
                          </tr>
                        ))}
                        {importPreview.details.updatedKegiatans.map(k => (
                          <tr key={`upd-keg-${k.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '6px' }}><code>{k.id}</code><br /><span className="text-muted" style={{ fontSize: '10px' }}>Prog: {k.newProgramId}</span></td>
                            <td style={{ padding: '6px' }}><span className="badge" style={{ background: '#F59E0B', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Ubah</span></td>
                            <td style={{ padding: '6px' }}>
                              {k.oldNama !== k.newNama && (
                                <div>
                                  Nama: <span className="text-danger" style={{ textDecoration: 'line-through' }}>{k.oldNama}</span>
                                  <i className="fa-solid fa-arrow-right" style={{ margin: '0 6px', color: 'var(--text-muted)' }}></i>
                                  <span className="text-success">{k.newNama}</span>
                                </div>
                              )}
                              {k.oldProgramId !== k.newProgramId && (
                                <div style={{ marginTop: '2px', fontSize: '11px' }}>
                                  Program: <span className="text-danger">{k.oldProgramId}</span>
                                  <i className="fa-solid fa-arrow-right" style={{ margin: '0 4px', color: 'var(--text-muted)' }}></i>
                                  <span className="text-success">{k.newProgramId}</span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>
                              <button className="btn btn-sm btn-orange" style={{ padding: '2px 8px', fontSize: '11px', width: 'auto' }} onClick={() => handleUpdateSingleItem('kegiatan', k.actionData, 'updatedKegiatans', k.id)}>Update</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detailed Lists - Subkegiatan */}
              {(importPreview.details.newSubkegiatans.length > 0 || importPreview.details.updatedSubkegiatans.length > 0) && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <h4 style={{ fontSize: '13px', color: 'white', margin: '0 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-file-lines text-orange"></i> Subkegiatan Perubahan
                  </h4>
                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <table className="table" style={{ fontSize: '12px', width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px' }}>ID / Kegiatan</th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>Tipe</th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>Perubahan</th>
                          <th style={{ textAlign: 'right', padding: '6px' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.details.newSubkegiatans.map(s => (
                          <tr key={`new-sub-${s.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '6px' }}><code>{s.id}</code><br /><span className="text-muted" style={{ fontSize: '10px' }}>Keg: {s.kegiatanId}</span></td>
                            <td style={{ padding: '6px' }}><span className="badge" style={{ background: '#10B981', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Baru</span></td>
                            <td style={{ padding: '6px' }}>
                              <div>Nama: <strong>{s.nama}</strong></div>
                              <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>Indikator: {s.indikator} ({s.satuan})</div>
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>
                              <button className="btn btn-sm btn-orange" style={{ padding: '2px 8px', fontSize: '11px', width: 'auto' }} onClick={() => handleUpdateSingleItem('subkegiatan', s.actionData, 'newSubkegiatans', s.id)}>Update</button>
                            </td>
                          </tr>
                        ))}
                        {importPreview.details.updatedSubkegiatans.map(s => (
                          <tr key={`upd-sub-${s.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '6px' }}><code>{s.id}</code><br /><span className="text-muted" style={{ fontSize: '10px' }}>Keg: {s.actionData.kegiatanId}</span></td>
                            <td style={{ padding: '6px' }}><span className="badge" style={{ background: '#F59E0B', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Ubah</span></td>
                            <td style={{ padding: '6px' }}>
                              {s.oldNama !== s.newNama && (
                                <div>
                                  Nama: <span className="text-danger" style={{ textDecoration: 'line-through' }}>{s.oldNama}</span>
                                  <i className="fa-solid fa-arrow-right" style={{ margin: '0 4px', color: 'var(--text-muted)' }}></i>
                                  <span className="text-success">{s.newNama}</span>
                                </div>
                              )}
                              {s.oldIndikator !== s.newIndikator && (
                                <div style={{ marginTop: '2px' }}>
                                  Indikator: <span className="text-danger" style={{ textDecoration: 'line-through' }}>{s.oldIndikator}</span>
                                  <i className="fa-solid fa-arrow-right" style={{ margin: '0 4px', color: 'var(--text-muted)' }}></i>
                                  <span className="text-success">{s.newIndikator}</span>
                                </div>
                              )}
                              {s.oldSatuan !== s.newSatuan && (
                                <div style={{ marginTop: '2px' }}>
                                  Satuan: <span className="text-danger" style={{ textDecoration: 'line-through' }}>{s.oldSatuan}</span>
                                  <i className="fa-solid fa-arrow-right" style={{ margin: '0 4px', color: 'var(--text-muted)' }}></i>
                                  <span className="text-success">{s.newSatuan}</span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>
                              <button className="btn btn-sm btn-orange" style={{ padding: '2px 8px', fontSize: '11px', width: 'auto' }} onClick={() => handleUpdateSingleItem('subkegiatan', s.actionData, 'updatedSubkegiatans', s.id)}>Update</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowImportModal(false)} disabled={isImportLoading}>Batal</button>
              <button className="btn btn-orange" style={{ width: 'auto', background: '#10B981', borderColor: '#10B981' }} onClick={handleApplyImport} disabled={isImportLoading}>
                {isImportLoading ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Memproses...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check mr-2"></i> Update Semua
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Program Section */}
      <div className="glass-panel">
        <div className="panel-header justify-between" style={{ cursor: 'pointer', padding: '16px 20px' }} onClick={() => setIsProgCollapsed(!isProgCollapsed)}>
          <h3 style={{ margin: 0 }}><i className="fa-solid fa-folder text-orange"></i> Master Program ({programs.length} item)</h3>
          <i className={`fa-solid fa-chevron-${isProgCollapsed ? 'down' : 'up'}`} style={{ color: 'var(--text-muted)' }}></i>
        </div>
        {!isProgCollapsed && (
          <div className="panel-body" style={{ padding: '20px' }}>
            <form onSubmit={handleAddProgram} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', marginBottom: '24px' }}>
              <div className="form-group" style={{ flexGrow: 1 }}>
                <label>Nama Program Baru</label>
                <input type="text" className="form-control" value={progNama} onChange={(e) => setProgNama(e.target.value)} required placeholder="Contoh: Program Penanggulangan Bencana" />
              </div>
              <button type="submit" className="btn btn-orange" style={{ width: 'auto' }}>Tambah Program</button>
            </form>

            {/* Search Filter */}
            <div className="form-group mb-3" style={{ maxWidth: '350px' }}>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '35px' }}
                  value={progSearch}
                  onChange={(e) => setProgSearch(e.target.value)}
                  placeholder="Cari program berdasarkan nama/ID..."
                />
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel-header)', zIndex: 1 }}>
                  <tr><th>ID</th><th>Nama Program</th><th style={{ textAlign: 'right' }}>Aksi</th></tr>
                </thead>
                <tbody>
                  {filteredPrograms.length === 0 ? (
                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada program ditemukan</td></tr>
                  ) : (
                    filteredPrograms.map(p => (
                      <tr key={p.id}>
                        <td><code>{p.id}</code></td>
                        <td>{p.nama}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteItem('program', p.id)}>Hapus</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Kegiatan Section */}
      <div className="glass-panel">
        <div className="panel-header justify-between" style={{ cursor: 'pointer', padding: '16px 20px' }} onClick={() => setIsKegCollapsed(!isKegCollapsed)}>
          <h3 style={{ margin: 0 }}><i className="fa-solid fa-folder-open text-orange"></i> Master Kegiatan ({kegiatans.length} item)</h3>
          <i className={`fa-solid fa-chevron-${isKegCollapsed ? 'down' : 'up'}`} style={{ color: 'var(--text-muted)' }}></i>
        </div>
        {!isKegCollapsed && (
          <div className="panel-body" style={{ padding: '20px' }}>
            <form onSubmit={handleAddKegiatan} style={{ display: 'grid', gridTemplateColumns: '250px 1fr auto', gap: '16px', alignItems: 'flex-end', marginBottom: '24px' }}>
              <div className="form-group">
                <label>Pilih Program Induk</label>
                <select className="select-sim" value={kegProgramId} onChange={(e) => setKegProgramId(e.target.value)} required>
                  <option value="">-- Pilih Program --</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.nama}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Nama Kegiatan Baru</label>
                <input type="text" className="form-control" value={kegNama} onChange={(e) => setKegNama(e.target.value)} required placeholder="Contoh: Kegiatan Kesiapsiagaan Bencana" />
              </div>
              <button type="submit" className="btn btn-orange" style={{ width: 'auto' }}>Tambah Kegiatan</button>
            </form>

            {/* Search Filter */}
            <div className="form-group mb-3" style={{ maxWidth: '350px' }}>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '35px' }}
                  value={kegSearch}
                  onChange={(e) => setKegSearch(e.target.value)}
                  placeholder="Cari kegiatan berdasarkan nama/ID..."
                />
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel-header)', zIndex: 1 }}>
                  <tr><th>Program Induk</th><th>Nama Kegiatan</th><th style={{ textAlign: 'right' }}>Aksi</th></tr>
                </thead>
                <tbody>
                  {filteredKegiatans.length === 0 ? (
                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada kegiatan ditemukan</td></tr>
                  ) : (
                    filteredKegiatans.map(k => {
                      const prog = programs.find(p => p.id === k.programId);
                      return (
                        <tr key={k.id}>
                          <td>{prog ? prog.nama : <span className="text-muted">Tidak Diketahui</span>}</td>
                          <td>{k.nama}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteItem('kegiatan', k.id)}>Hapus</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Subkegiatan Section */}
      <div className="glass-panel">
        <div className="panel-header justify-between" style={{ cursor: 'pointer', padding: '16px 20px' }} onClick={() => setIsSubkegCollapsed(!isSubkegCollapsed)}>
          <h3 style={{ margin: 0 }}><i className="fa-solid fa-file-lines text-orange"></i> Master Subkegiatan ({subkegiatans.length} item)</h3>
          <i className={`fa-solid fa-chevron-${isSubkegCollapsed ? 'down' : 'up'}`} style={{ color: 'var(--text-muted)' }}></i>
        </div>
        {!isSubkegCollapsed && (
          <div className="panel-body" style={{ padding: '20px' }}>
            <form onSubmit={handleAddSubkegiatan} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr 150px auto', gap: '12px', alignItems: 'flex-end', marginBottom: '24px' }}>
              <div className="form-group">
                <label>Pilih Kegiatan Induk</label>
                <select className="select-sim" value={subkegKegiatanId} onChange={(e) => setSubkegKegiatanId(e.target.value)} required>
                  <option value="">-- Pilih Kegiatan --</option>
                  {kegiatans.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Nama Subkegiatan</label>
                <input type="text" className="form-control" value={subkegNama} onChange={(e) => setSubkegNama(e.target.value)} required placeholder="Contoh: Penyusunan Rencana Kontinjensi" />
              </div>
              <div className="form-group">
                <label>Indikator Default</label>
                <input type="text" className="form-control" value={subkegIndikator} onChange={(e) => setSubkegIndikator(e.target.value)} required placeholder="Contoh: Jumlah dokumen rencana kontinjensi tersusun" />
              </div>
              <div className="form-group">
                <label>Satuan Default</label>
                <input type="text" className="form-control" value={subkegSatuan} onChange={(e) => setSubkegSatuan(e.target.value)} required placeholder="Contoh: dokumen / kali" />
              </div>
              <button type="submit" className="btn btn-orange" style={{ width: 'auto' }}>Tambah Subkegiatan</button>
            </form>

            {/* Search Filter */}
            <div className="form-group mb-3" style={{ maxWidth: '350px' }}>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '35px' }}
                  value={subkegSearch}
                  onChange={(e) => setSubkegSearch(e.target.value)}
                  placeholder="Cari subkegiatan berdasarkan nama/ID..."
                />
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel-header)', zIndex: 1 }}>
                  <tr><th>Kegiatan Induk</th><th>Subkegiatan</th><th>Indikator Default</th><th>Satuan Default</th><th style={{ textAlign: 'right' }}>Aksi</th></tr>
                </thead>
                <tbody>
                  {filteredSubkegiatans.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada subkegiatan ditemukan</td></tr>
                  ) : (
                    filteredSubkegiatans.map(s => {
                      const keg = kegiatans.find(k => k.id === s.kegiatanId);
                      return (
                        <tr key={s.id}>
                          <td>{keg ? keg.nama : <span className="text-muted">Tidak Diketahui</span>}</td>
                          <td>{s.nama}</td>
                          <td>{s.indikator}</td>
                          <td><span className="badge badge-draft">{s.satuan}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteItem('subkegiatan', s.id)}>Hapus</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
