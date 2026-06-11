'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function AdminMasterPage() {
  const { fetchWithAuth, activeRole } = useSimulation();
  
  const [programs, setPrograms] = useState([]);
  const [kegiatans, setKegiatans] = useState([]);
  const [subkegiatans, setSubkegiatans] = useState([]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [globalSearch, setGlobalSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  
  const [importPreview, setImportPreview] = useState(null);
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSubkegDetails, setSelectedSubkegDetails] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showImportModal || showDetailModal) return;

      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT' || 
        activeEl.isContentEditable
      )) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showImportModal, showDetailModal]);

  const hasAccess = activeRole === 'admin' || activeRole === 'perencana';

  const loadData = useCallback(async () => {
    try {
      const pRes = await fetchWithAuth('/api/master/program');
      let loadedPrograms = [];
      if (pRes.ok) {
        loadedPrograms = await pRes.json();
        setPrograms(loadedPrograms);
      }

      const kRes = await fetchWithAuth('/api/master/kegiatan');
      if (kRes.ok) setKegiatans(await kRes.json());

      const sRes = await fetchWithAuth('/api/master/subkegiatan');
      if (sRes.ok) setSubkegiatans(await sRes.json());

      // Auto-expand Urusans by default
      const defaultExpanded = new Set();
      loadedPrograms.forEach(p => {
        let urusanName = p.urusan || '';
        if (!urusanName) {
          if (p.nama.toUpperCase().includes('PENUNJANG')) {
            urusanName = '1.01.02 URUSAN PENUNJANG PEMERINTAHAN DAERAH';
          } else {
            urusanName = '1.05 URUSAN PEMERINTAHAN BIDANG KETENTERAMAN DAN KETERTIBAN UMUM SERTA PERLINDUNGAN MASYARAKAT';
          }
        }
        defaultExpanded.add(urusanName);
      });
      setExpandedNodes(defaultExpanded);
    } catch (e) {
      console.error('Failed to load master data libraries', e);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      const timer = setTimeout(() => {
        loadData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [hasAccess, loadData]);

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

  // Delete handler
  const handleDeleteItem = async (type, id) => {
    if (!confirm(`Yakin ingin menghapus item master ${type} ini? Tindakan ini tidak dapat dibatalkan.`)) return;
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
        const err = await res.json();
        setError(err.error || `Gagal menghapus data master ${type}.`);
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Group and filter data into hierarchy
  const getHierarchy = () => {
    const urusans = {};
    const query = globalSearch.toLowerCase().trim();

    programs.forEach(p => {
      let urusanName = p.urusan || '';
      if (!urusanName) {
        if (p.nama.toUpperCase().includes('PENUNJANG')) {
          urusanName = '1.01.02 URUSAN PENUNJANG PEMERINTAHAN DAERAH';
        } else {
          urusanName = '1.05 URUSAN PEMERINTAHAN BIDANG KETENTERAMAN DAN KETERTIBAN UMUM SERTA PERLINDUNGAN MASYARAKAT';
        }
      }
      if (!urusans[urusanName]) {
        urusans[urusanName] = [];
      }
      urusans[urusanName].push(p);
    });

    const hierarchy = [];

    Object.keys(urusans).forEach(urusanName => {
      const uPrograms = urusans[urusanName];
      const matchedPrograms = [];

      uPrograms.forEach(p => {
        const pKegiatans = kegiatans.filter(k => k.programId === p.id);
        const matchedKegiatans = [];

        pKegiatans.forEach(k => {
          const kSubkegiatans = subkegiatans.filter(s => s.kegiatanId === k.id);
          const matchedSubkegiatans = kSubkegiatans.filter(s => {
            if (!query) return true;
            return s.nama.toLowerCase().includes(query) ||
                   s.id.toLowerCase().includes(query) ||
                   s.indikator.toLowerCase().includes(query) ||
                   (s.bidang && s.bidang.toLowerCase().includes(query));
          });

          const isKegiatanMatch = !query || 
                                  k.nama.toLowerCase().includes(query) || 
                                  k.id.toLowerCase().includes(query);

          if (matchedSubkegiatans.length > 0 || isKegiatanMatch) {
            matchedKegiatans.push({
              ...k,
              subkegiatans: matchedSubkegiatans
            });
          }
        });

        const isProgramMatch = !query || 
                               p.nama.toLowerCase().includes(query) || 
                               p.id.toLowerCase().includes(query);

        if (matchedKegiatans.length > 0 || isProgramMatch) {
          matchedPrograms.push({
            ...p,
            kegiatans: matchedKegiatans
          });
        }
      });

      const isUrusanMatch = !query || urusanName.toLowerCase().includes(query);

      if (matchedPrograms.length > 0 || isUrusanMatch) {
        hierarchy.push({
          name: urusanName,
          programs: matchedPrograms
        });
      }
    });

    return hierarchy;
  };

  const hierarchy = getHierarchy();

  const expandAll = (currentHierarchy) => {
    const next = new Set();
    currentHierarchy.forEach(u => {
      next.add(u.name);
      u.programs.forEach(p => {
        next.add(p.id);
        p.kegiatans.forEach(k => {
          next.add(k.id);
        });
      });
    });
    setExpandedNodes(next);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
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
          Mutakhirkan database Master Urusan, Program, Kegiatan, dan Subkegiatan. Unggah berkas Excel (.xlsx atau .xls) dari perangkat Anda untuk memproses dan memperbarui data master.
        </p>

        <div style={{ background: 'rgba(15, 23, 42, 0.3)', padding: '20px', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
          <div>
            <h4 style={{ fontSize: '14px', margin: '0 0 8px 0', color: 'white' }}>Unggah File Excel</h4>
            <p className="text-muted" style={{ fontSize: '12px', margin: '0 0 16px 0', lineHeight: '1.4' }}>
              Pilih file Excel yang berisi daftar Program, Kegiatan, dan Subkegiatan beserta Urusan, Indikator, Satuan, dan Bidang Pelaksana.
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
                  <strong>Perhatian:</strong> Perubahan nama/indikator pada data master yang sedang digunakan di Indikator Renja atau Indikator Renstra akan memicu peringatan pemutakhiran data pada dashboard Admin Bidang pengampu.
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
                            <td style={{ padding: '6px' }}>Nomenklatur Program: <strong>{p.nama}</strong><br /><span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Urusan: {p.urusan}</span></td>
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
                              <div>
                                Nomenklatur Program: <span className="text-danger" style={{ textDecoration: 'line-through' }}>{p.oldNama}</span>
                                <i className="fa-solid fa-arrow-right" style={{ margin: '0 6px', color: 'var(--text-muted)' }}></i>
                                <span className="text-success">{p.newNama}</span>
                              </div>
                              {p.oldUrusan !== p.newUrusan && (
                                <div style={{ fontSize: '11px', marginTop: '2px' }}>
                                  Urusan: <span className="text-danger" style={{ textDecoration: 'line-through' }}>{p.oldUrusan || '(kosong)'}</span>
                                  <i className="fa-solid fa-arrow-right" style={{ margin: '0 4px', color: 'var(--text-muted)' }}></i>
                                  <span className="text-success">{p.newUrusan}</span>
                                </div>
                              )}
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
                            <td style={{ padding: '6px' }}>Nomenklatur Kegiatan: <strong>{k.nama}</strong></td>
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
                                  Nomenklatur Kegiatan: <span className="text-danger" style={{ textDecoration: 'line-through' }}>{k.oldNama}</span>
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
                              <div>Nomenklatur Subkegiatan: <strong>{s.nama}</strong></div>
                              <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>Indikator: {s.indikator} ({s.satuan})</div>
                              {s.bidang && <div style={{ fontSize: '10.5px', marginTop: '2px', color: '#10B981' }}>Pelaksana: {s.bidang}</div>}
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
                                  Nomenklatur Subkegiatan: <span className="text-danger" style={{ textDecoration: 'line-through' }}>{s.oldNama}</span>
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
                              {s.oldBidang !== s.newBidang && (
                                <div style={{ marginTop: '2px' }}>
                                  Pelaksana: <span className="text-danger" style={{ textDecoration: 'line-through' }}>{s.oldBidang || '(kosong)'}</span>
                                  <i className="fa-solid fa-arrow-right" style={{ margin: '0 4px', color: 'var(--text-muted)' }}></i>
                                  <span className="text-success">{s.newBidang}</span>
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

      {/* Global Hierarchical Library View */}
      <div className="glass-panel">
        <div className="panel-header justify-between" style={{ padding: '16px 20px' }}>
          <h3 style={{ margin: 0 }}><i className="fa-solid fa-sitemap text-orange"></i> Hierarki Pustaka Data Master (SIPD)</h3>
          <span className="badge badge-score">{subkegiatans.length} Subkegiatan</span>
        </div>
        
        <div className="panel-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls Panel */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.01)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div style={{ position: 'relative', flexGrow: 1, maxWidth: '500px' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
              <input
                ref={searchInputRef}
                type="text"
                className="form-control"
                style={{ paddingLeft: '35px', margin: 0 }}
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Cari Urusan, Program, Kegiatan, Subkegiatan, Indikator... (Tekan '/')"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch('')}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ width: 'auto', fontSize: '13px' }} onClick={() => expandAll(hierarchy)}>
                <i className="fa-solid fa-folder-open mr-2"></i> Buka Semua
              </button>
              <button className="btn btn-secondary" style={{ width: 'auto', fontSize: '13px' }} onClick={collapseAll}>
                <i className="fa-solid fa-folder mr-2"></i> Tutup Semua
              </button>
            </div>
          </div>

          {/* Tree View */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            {hierarchy.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                <i className="fa-solid fa-circle-info" style={{ fontSize: '32px', marginBottom: '12px' }}></i>
                <p>Tidak ada data master ditemukan yang cocok dengan pencarian Anda.</p>
              </div>
            ) : (
              hierarchy.map(u => {
                const isUExpanded = expandedNodes.has(u.name);
                return (
                  <div key={u.name} className="glass-panel" style={{ padding: 0, overflow: 'hidden', borderLeft: '4px solid var(--primary-orange)', margin: 0 }}>
                    <div
                      className="panel-header justify-between"
                      style={{ cursor: 'pointer', padding: '12px 20px', background: 'rgba(255, 255, 255, 0.02)' }}
                      onClick={() => toggleNode(u.name)}
                    >
                      <h3 style={{ margin: 0, fontSize: '14px', color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '10px', lineHeight: '1.4' }}>
                        <i className={`fa-solid ${isUExpanded ? 'fa-folder-open' : 'fa-folder'} text-orange`} style={{ fontSize: '14px' }}></i>
                        {u.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="badge badge-draft" style={{ fontSize: '10px' }}>{u.programs.length} Program</span>
                        <i className={`fa-solid fa-chevron-${isUExpanded ? 'down' : 'up'}`} style={{ color: 'var(--text-muted)', fontSize: '11px' }}></i>
                      </div>
                    </div>

                    {isUExpanded && (
                      <div className="panel-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.1)' }}>
                        {u.programs.map(p => {
                          const isPExpanded = expandedNodes.has(p.id);
                          return (
                            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '1px dashed rgba(255,255,255,0.08)', paddingLeft: '16px', marginLeft: '6px' }}>
                              <div
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}
                                onClick={() => toggleNode(p.id)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <i className={`fa-solid ${isPExpanded ? 'fa-folder-open' : 'fa-folder'} text-warning`} style={{ fontSize: '13px' }}></i>
                                  <span style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--primary-orange)', fontFamily: 'monospace', marginRight: '6px' }}>{p.id}</span>
                                    {p.nama}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span className="badge badge-score" style={{ fontSize: '9px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>{p.kegiatans.length} Kegiatan</span>
                                  <i className={`fa-solid fa-chevron-${isPExpanded ? 'down' : 'up'}`} style={{ color: 'var(--text-muted)', fontSize: '10px' }}></i>
                                </div>
                              </div>

                              {isPExpanded && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '12px' }}>
                                  {p.kegiatans.map(k => {
                                    const isKExpanded = expandedNodes.has(k.id);
                                    return (
                                      <div key={k.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1px dashed rgba(255,255,255,0.06)', paddingLeft: '14px' }}>
                                        <div
                                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '6px 10px', background: 'rgba(255,255,255,0.01)', borderRadius: '4px' }}
                                          onClick={() => toggleNode(k.id)}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <i className="fa-solid fa-list-check text-info" style={{ fontSize: '12px' }}></i>
                                            <span style={{ color: '#d1d5db', fontSize: '12.5px' }}>
                                              <span style={{ color: '#3B82F6', fontFamily: 'monospace', marginRight: '6px' }}>{k.id}</span>
                                              {k.nama}
                                            </span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span className="badge badge-draft" style={{ fontSize: '9px', background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}>{k.subkegiatans.length} Subkegiatan</span>
                                            <i className={`fa-solid fa-chevron-${isKExpanded ? 'down' : 'up'}`} style={{ color: 'var(--text-muted)', fontSize: '10px' }}></i>
                                          </div>
                                        </div>

                                        {isKExpanded && (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '12px' }}>
                                            {k.subkegiatans.map(s => (
                                              <div
                                                key={s.id}
                                                style={{
                                                  background: 'rgba(255,255,255,0.01)',
                                                  border: '1px solid rgba(255,255,255,0.03)',
                                                  padding: '10px 14px',
                                                  borderRadius: '6px',
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  alignItems: 'center',
                                                  gap: '16px'
                                                }}
                                              >
                                                <div style={{ flexGrow: 1 }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '10.5px', background: 'rgba(255,107,0,0.12)', color: 'var(--primary-orange)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'bold' }}>{s.id}</span>
                                                    <strong style={{ color: '#f3f4f6', fontSize: '12.5px' }}>{s.nama}</strong>
                                                  </div>
                                                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                                    <span>Indikator Default: <strong style={{ color: '#9ca3af' }}>{s.indikator}</strong></span>
                                                    <span>Satuan: <strong style={{ color: '#9ca3af' }}>{s.satuan}</strong></span>
                                                  </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                  <button
                                                    className="btn btn-sm btn-secondary"
                                                    style={{ padding: '3px 8px', fontSize: '10px', width: 'auto', background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)' }}
                                                    onClick={() => {
                                                      setSelectedSubkegDetails(s);
                                                      setShowDetailModal(true);
                                                    }}
                                                  >
                                                    <i className="fa-solid fa-circle-info mr-1"></i> Detail
                                                  </button>
                                                  <button className="btn btn-sm btn-danger" style={{ padding: '3px 8px', fontSize: '10px', width: 'auto' }} onClick={() => handleDeleteItem('subkegiatan', s.id)}>Hapus</button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Subkegiatan Detail Modal */}
      {showDetailModal && selectedSubkegDetails && (
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
            maxWidth: '600px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,107,0,0.3)'
          }}>
            <div className="panel-header justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <h3 style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-circle-info text-orange"></i> Detail Subkegiatan
              </h3>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            
            <div className="panel-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kode Subkegiatan</span>
                <div style={{ fontSize: '13px', color: 'white', fontWeight: 'bold', marginTop: '3px', fontFamily: 'monospace' }}>
                  {selectedSubkegDetails.id}
                </div>
              </div>

              <div>
                <span className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nomenklatur Subkegiatan</span>
                <div style={{ fontSize: '14px', color: '#f3f4f6', fontWeight: 600, marginTop: '3px', lineHeight: '1.4' }}>
                  {selectedSubkegDetails.nama}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sasaran Subkegiatan (Kinerja)</span>
                  <div style={{ fontSize: '13px', color: '#34D399', fontWeight: 600, marginTop: '4px', lineHeight: '1.4' }}>
                    {selectedSubkegDetails.kinerja || '-'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  <div>
                    <span className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Indikator</span>
                    <div style={{ fontSize: '13px', color: 'white', marginTop: '4px', fontWeight: 600 }}>
                      {selectedSubkegDetails.indikator || '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Satuan</span>
                    <div style={{ fontSize: '13px', color: 'white', marginTop: '4px', fontWeight: 600 }}>
                      {selectedSubkegDetails.satuan || '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)' }}>
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)} style={{ width: 'auto', padding: '6px 16px', fontSize: '13px' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
