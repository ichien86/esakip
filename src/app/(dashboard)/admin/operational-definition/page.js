'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useUI } from '@/context/UIContext';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const METODE_CONFIG = {
  'Tunggal':     { label: 'Tunggal',      icon: 'fa-solid fa-1',              color: '#6366f1' },
  'Jumlah':      { label: 'Tunggal',      icon: 'fa-solid fa-1',              color: '#6366f1' },
  'Persentase':  { label: 'Persentase',   icon: 'fa-solid fa-percent',        color: '#f59e0b' },
  'Rata-rata':   { label: 'Rata-rata',    icon: 'fa-solid fa-calculator',     color: '#10b981' },
  'Penjumlahan': { label: 'Penjumlahan',  icon: 'fa-solid fa-plus',           color: '#3b82f6' },
  'Pembobotan':  { label: 'Pembobotan',   icon: 'fa-solid fa-scale-balanced', color: '#ec4899' },
};

const METODE_OPTIONS = [
  { value: 'Tunggal',     label: 'Tunggal — 1 variabel langsung' },
  { value: 'Persentase',  label: 'Persentase — (Pembilang / Penyebut) × 100%' },
  { value: 'Rata-rata',   label: 'Rata-rata — rerata dari beberapa variabel' },
  { value: 'Penjumlahan', label: 'Penjumlahan — jumlah dari beberapa variabel' },
  { value: 'Pembobotan',  label: 'Penjumlahan Berbobot — Σ (variabel × bobot)' },
];

export default function OperationalDefinitionPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { activeRole } = useUI();
  const [nodes, setNodes] = useState([]);
  const [selectedIndicator, setSelectedIndicator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [definisiOperasional, setDefinisiOperasional] = useState('');
  const [metodePenghitungan, setMetodePenghitungan] = useState('Tunggal');
  const [outputVariableAlias, setOutputVariableAlias] = useState('');
  const [variables, setVariables] = useState([{ name: '', weight: 100 }]);
  const [activeSuggestionField, setActiveSuggestionField] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const searchInputRef = useRef(null);

  const loadNodes = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/cascading5years');
      if (res.ok) { const data = await res.json(); setNodes(data); }
      else { setError('Gagal mengambil data indikator strategis'); }
    } catch (e) { setError('Kesalahan jaringan'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadNodes(); }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT' || activeEl.isContentEditable)) return;
      if (e.key === '/') { e.preventDefault(); if (searchInputRef.current) searchInputRef.current.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const uniqueVariables = useMemo(() => {
    const all = [];
    nodes.forEach(node => {
      if (node.indicators && Array.isArray(node.indicators)) {
        node.indicators.forEach(ind => {
          if (Array.isArray(ind.variables) && ind.variables.length > 0) {
            ind.variables.forEach(v => { if (v.name) all.push(v.name.trim()); });
          } else {
            if (ind.variabelJumlah) all.push(ind.variabelJumlah.trim());
            if (ind.variabelPembilang) all.push(ind.variabelPembilang.trim());
            if (ind.variabelPenyebut) all.push(ind.variabelPenyebut.trim());
          }
          if (ind.outputVariableAlias) all.push(ind.outputVariableAlias.trim());
        });
      }
    });
    return [...new Set(all)].filter(Boolean);
  }, [nodes]);

  const getSuggestions = (inputVal) => {
    if (!inputVal || inputVal.trim().length < 2) return [];
    const terms = inputVal.toLowerCase().split(/\s+/).filter(Boolean);
    return uniqueVariables.filter(v => {
      if (v.toLowerCase() === inputVal.trim().toLowerCase()) return false;
      return terms.every(t => v.toLowerCase().includes(t));
    }).slice(0, 5);
  };

  // Deteksi alias duplikat: cari indikator lain (bukan yang sedang diedit) yang pakai alias sama
  const duplicateAliasInfo = useMemo(() => {
    const trimmed = (outputVariableAlias || '').trim().toLowerCase();
    if (!trimmed || !selectedIndicator) return null;
    const duplicates = [];
    nodes.forEach(node => {
      if (!node.indicators) return;
      node.indicators.forEach((ind, idx) => {
        if (node.id === selectedIndicator.nodeId && idx === selectedIndicator.indicatorIndex) return; // skip diri sendiri
        if ((ind.outputVariableAlias || '').trim().toLowerCase() === trimmed) {
          duplicates.push({ indikator: ind.indikator, nodeText: node.text, nodeLevel: node.level });
        }
      });
    });
    return duplicates.length > 0 ? duplicates : null;
  }, [outputVariableAlias, nodes, selectedIndicator]);

  const normalizeMetode = (m) => (m === 'Jumlah' ? 'Tunggal' : (m || 'Tunggal'));

  const handleSelectIndicator = (ind) => {
    setSelectedIndicator(ind);
    setSuccess(''); setError('');
    setDefinisiOperasional(ind.definisiOperasional || '');
    setOutputVariableAlias(ind.outputVariableAlias || '');
    const normM = normalizeMetode(ind.metodePenghitungan);
    setMetodePenghitungan(normM);
    
    if (Array.isArray(ind.variables) && ind.variables.length > 0) {
      setVariables(ind.variables.map(v => ({ name: v.name || '', weight: v.weight ?? (normM==='Pembobotan'?0:100) })));
    } else {
      if (normM === 'Tunggal') {
        setVariables([{ name: ind.variabelJumlah || '', weight: 100 }]);
      } else if (normM === 'Persentase') {
        setVariables([
          { name: ind.variabelPembilang || '', weight: 50 },
          { name: ind.variabelPenyebut || '', weight: 50 }
        ]);
      } else {
        setVariables([{ name: '', weight: 100 }]);
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false); setSelectedIndicator(null);
    setSuccess(''); setError(''); setActiveSuggestionField(null);
  };

  const addVariable = () => setVariables(prev => [...prev, { name: '', weight: 1 }]);
  const removeVariable = (idx) => { if (variables.length <= 1) return; setVariables(prev => prev.filter((_, i) => i !== idx)); };
  const updateVariableName = (idx, name) => setVariables(prev => prev.map((v, i) => i === idx ? { ...v, name } : v));
  const updateVariableWeight = (idx, weight) => { const w = parseFloat(weight); setVariables(prev => prev.map((v, i) => i === idx ? { ...v, weight: isNaN(w) ? 0 : w } : v)); };

  const totalWeight = variables.reduce((sum, v) => sum + (parseFloat(v.weight) || 0), 0);

  const handleAutoSuggest = () => {
    if (!selectedIndicator || !selectedIndicator.indikator) return;
    const textVal = selectedIndicator.indikator;
    const lower = textVal.toLowerCase();
    const isPercent = lower.includes('persen') || lower.includes('%') || lower.includes('persentase');
    if (isPercent) {
      setMetodePenghitungan('Persentase');
      const subject = textVal.replace(/persentase|persen|%/gi, '').trim() || 'Kegiatan';
      const cap = subject.charAt(0).toUpperCase() + subject.slice(1);
      setVariables([
        { name: `Jumlah ${cap} yang terealisasi/selesai`, weight: 50 },
        { name: `Jumlah total target ${cap} yang direncanakan`, weight: 50 }
      ]);
    } else {
      setMetodePenghitungan('Tunggal');
      setVariables([{ name: textVal, weight: 100 }]);
    }
    setSuccess('Rekomendasi variabel berhasil dibuat.');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedIndicator) return;
    setSuccess(''); setError('');

    if (metodePenghitungan === 'Tunggal' && (!variables[0] || !variables[0].name.trim())) { setError('Nama variabel tunggal wajib diisi.'); return; }
    if (metodePenghitungan === 'Persentase' && (variables.length < 2 || !variables[0].name.trim() || !variables[1].name.trim())) { setError('Variabel Pembilang dan Penyebut wajib diisi untuk metode Persentase.'); return; }
    
    if (['Rata-rata', 'Penjumlahan', 'Pembobotan'].includes(metodePenghitungan)) {
      if (variables.length === 0 || variables.some(v => !v.name.trim())) { setError('Semua variabel harus memiliki nama.'); return; }
      if (metodePenghitungan === 'Pembobotan') {
        if (Math.abs(totalWeight - 100) > 0.001) { setError(`Total bobot harus 100. Saat ini: ${totalWeight.toFixed(1)}`); return; }
      }
    }

    const originalNode = nodes.find(n => n.id === selectedIndicator.nodeId);
    if (!originalNode) return;

    const updatedIndicators = [...(originalNode.indicators || [])];
    updatedIndicators[selectedIndicator.indicatorIndex] = {
      ...updatedIndicators[selectedIndicator.indicatorIndex],
      definisiOperasional,
      metodePenghitungan,
      variabelJumlah: metodePenghitungan === 'Tunggal' ? (variables[0]?.name || '') : '',
      variabelPembilang: metodePenghitungan === 'Persentase' ? (variables[0]?.name || '') : '',
      variabelPenyebut: metodePenghitungan === 'Persentase' ? (variables[1]?.name || '') : '',
      outputVariableAlias: outputVariableAlias || '',
      variables: variables.map(v => ({ name: v.name.trim(), weight: parseFloat(v.weight) || 0 }))
    };

    const payload = { ...originalNode, indicators: updatedIndicators, requesterRole: activeRole };

    setIsSaving(true);
    try {
      const res = await fetchWithAuth('/api/cascading5years', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSuccess('Definisi operasional indikator berhasil diperbarui.');
        // Optimistic UI update to avoid long wait
        setNodes(prev => prev.map(n => n.id === originalNode.id ? { ...n, indicators: updatedIndicators } : n));
        setTimeout(() => handleCloseModal(), 1200);
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan perubahan.');
      }
    } catch (e) { setError('Kesalahan jaringan saat menyimpan.'); }
    finally { setIsSaving(false); }
  };

  const getLevelLabel = (level) => {
    const labels = { tujuan: 'Tujuan Strategis', sasaran: 'Sasaran Strategis', sasaran_program: 'Sasaran Program', sasaran_kegiatan: 'Sasaran Kegiatan', sasaran_subkegiatan: 'Sasaran Subkegiatan', sasaran_aktivitas: 'Sasaran Aktivitas' };
    return labels[level] || level;
  };

  const allIndicators = [];
  const traversedNodeIds = new Set();
  
  const rootNodes = nodes.filter(n => !n.parentId);
  const getChildren = (parentId) => nodes.filter(n => n.parentId === parentId);
  
  const traverse = (node) => {
    traversedNodeIds.add(node.id);
    if (node.indicators && Array.isArray(node.indicators)) {
      node.indicators.forEach((ind, index) => {
        allIndicators.push({ nodeId: node.id, nodeText: node.text, nodeLevel: node.level, indicatorIndex: index, ...ind });
      });
    }
    const children = getChildren(node.id);
    children.forEach(child => traverse(child));
  };
  
  rootNodes.forEach(root => traverse(root));
  
  // Tangkap yatim piatu (orphan nodes) jika ada
  nodes.forEach(node => {
    if (!traversedNodeIds.has(node.id) && node.indicators && Array.isArray(node.indicators)) {
      node.indicators.forEach((ind, index) => {
        allIndicators.push({ nodeId: node.id, nodeText: node.text, nodeLevel: node.level, indicatorIndex: index, ...ind });
      });
    }
  });

  const filteredIndicators = allIndicators.filter(ind => {
    const matchesSearch = (ind.indikator || '').toLowerCase().includes(searchQuery.toLowerCase()) || (ind.nodeText || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = filterLevel === 'Semua' || ind.nodeLevel === filterLevel;
    const isFilled = !!ind.definisiOperasional;
    const matchesStatus = filterStatus === 'Semua' || (filterStatus === 'Sudah Diisi' && isFilled) || (filterStatus === 'Belum Diisi' && !isFilled);
    return matchesSearch && matchesLevel && matchesStatus;
  });

  useEffect(() => {
    if (nodes.length > 0 && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const editIndicatorId = params.get('indicatorId');
      if (editIndicatorId && !selectedIndicator) {
        let found = false;
        for (const node of nodes) {
          if (node.indicators && Array.isArray(node.indicators)) {
            const foundInd = node.indicators.find(ind => ind.id === editIndicatorId);
            if (foundInd) {
              handleSelectIndicator(foundInd);
              window.history.replaceState({}, '', window.location.pathname);
              found = true;
              break;
            }
          }
        }
        if (found) return;
      }
    }
  }, [nodes]); // Intentionally omitting handleSelectIndicator

  const hasAccess = activeRole === 'admin' || activeRole === 'perencana';
  const isDynamic = ['Rata-rata', 'Penjumlahan', 'Pembobotan'].includes(metodePenghitungan);

  if (!hasAccess) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa-solid fa-ban text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Akses Ditolak</h2>
        <p className="text-muted" style={{ marginTop: '8px' }}>Hanya Administrator atau Admin Perencana yang diperbolehkan mengelola data definisi operasional.</p>
      </div>
    );
  }

  return (
    <section>
      <style>{`
        @keyframes modalFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes modalSlideUp { from { transform:translateY(20px);opacity:0 } to { transform:translateY(0);opacity:1 } }
        .indicator-card { background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);padding:16px;border-radius:8px;cursor:pointer;transition:all 0.2s ease-in-out; }
        .indicator-card:hover { background:rgba(255,107,0,0.05);border-color:rgba(255,107,0,0.3);transform:translateY(-2px); }
        .suggestion-dropdown { position:absolute;top:100%;left:0;right:0;background:rgb(15,23,42);border:1px solid var(--glass-border);border-radius:6px;z-index:1010;max-height:180px;overflow-y:auto;box-shadow:0 10px 15px -3px rgba(0,0,0,0.7);margin-top:4px; }
        .suggestion-item { padding:8px 12px;font-size:12px;color:rgba(255,255,255,0.8);cursor:pointer;transition:background 0.15s ease;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .suggestion-item:hover { background:rgba(255,107,0,0.15);color:white; }
        .var-row { display:grid;gap:8px;align-items:center; }
        .var-row-3 { grid-template-columns:1fr 80px 32px; }
        .var-row-2 { grid-template-columns:1fr 32px; }
        .weight-bar { height:4px;background:var(--glass-border);border-radius:2px;margin-top:4px;overflow:hidden; }
        .weight-bar-fill { height:100%;border-radius:2px;transition:width 0.3s ease; }
        .metode-badge { display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px; }
      `}</style>

      <div className="glass-panel">
        <div className="panel-header" style={{ display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'16px' }}>
          <div>
            <h3><i className="fa-solid fa-book-bookmark text-orange"></i> Definisi Operasional Indikator Strategis Renstra</h3>
            <p className="text-muted">Kelola definisi operasional, metode perhitungan, dan variabel indikator kinerja dalam struktur cascading daerah.</p>
          </div>
        </div>

        <div className="panel-body">
          <div style={{ display:'flex',gap:'12px',marginBottom:'24px',flexWrap:'wrap' }}>
            <div style={{ flex:1,minWidth:'280px' }}>
              <input ref={searchInputRef} type="text" className="form-control" placeholder="Cari indikator atau deskripsi rencana induk... (Tekan '/')" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <select className="form-control" value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} style={{ width:'200px' }}>
              <option value="Semua">Semua Level Cascading</option>
              <option value="tujuan">Tujuan Strategis</option>
              <option value="sasaran">Sasaran Strategis</option>
              <option value="sasaran_program">Sasaran Program</option>
              <option value="sasaran_kegiatan">Sasaran Kegiatan</option>
              <option value="sasaran_subkegiatan">Sasaran Subkegiatan</option>
              <option value="sasaran_aktivitas">Sasaran Aktivitas</option>
            </select>
            <select className="form-control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width:'180px' }}>
              <option value="Semua">Semua Status</option>
              <option value="Belum Diisi">Belum Diisi</option>
              <option value="Sudah Diisi">Sudah Diisi</option>
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign:'center',color:'var(--text-muted)',padding:'60px 0' }}>
              <i className="fa-solid fa-circle-notch fa-spin fa-2x text-orange" style={{ marginBottom:'12px' }}></i>
              <p>Memuat data indikator strategis...</p>
            </div>
          ) : filteredIndicators.length === 0 ? (
            <div style={{ textAlign:'center',color:'var(--text-muted)',padding:'60px 0',border:'1px dashed var(--glass-border)',borderRadius:'12px' }}>
              <i className="fa-solid fa-magnifying-glass fa-2x text-muted" style={{ marginBottom:'12px' }}></i>
              <p>Tidak ada indikator yang cocok dengan pencarian Anda.</p>
            </div>
          ) : (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))',gap:'16px' }}>
              {filteredIndicators.map((ind, index) => {
                const normM = normalizeMetode(ind.metodePenghitungan);
                const mc = METODE_CONFIG[normM] || METODE_CONFIG['Tunggal'];
                return (
                  <div key={`${ind.nodeId}_${ind.indicatorIndex}_${index}`} className="indicator-card" onClick={() => handleSelectIndicator(ind)} style={{ display:'flex',flexDirection:'column',height:'100%',justifyContent:'space-between' }}>
                    <div>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px',marginBottom:'10px' }}>
                        <span style={{ fontSize:'9px',background:'rgba(255,255,255,0.06)',padding:'3px 8px',borderRadius:'4px',fontWeight:600,textTransform:'uppercase',color:'var(--text-muted)' }}>{getLevelLabel(ind.nodeLevel)}</span>
                        {ind.definisiOperasional ? (
                          <span className="badge badge-finished" style={{ fontSize:'9px',padding:'3px 8px' }}><i className="fa-solid fa-check" style={{ marginRight:'4px' }}></i>Terdefinisi</span>
                        ) : (
                          <span className="badge badge-none" style={{ fontSize:'9px',padding:'3px 8px' }}><i className="fa-solid fa-pen-nib" style={{ marginRight:'4px' }}></i>Belum Diisi</span>
                        )}
                      </div>
                      <h4 style={{ fontSize:'14px',fontWeight:600,color: 'var(--text-primary)',lineHeight:'1.4' }}>{ind.indikator}</h4>
                      {ind.definisiOperasional && (
                        <div 
                          style={{ fontSize:'12px',color:'var(--text-muted)',marginTop:'8px',display:'-webkit-box',WebkitLineClamp:'3',WebkitBoxOrient:'vertical',overflow:'hidden',lineHeight:'1.5' }}
                        >
                          {ind.definisiOperasional.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')}
                        </div>
                      )}
                    </div>
                    <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:'10px',marginTop:'14px',fontSize:'11px',color:'var(--text-muted)' }}>
                      <div style={{ whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}><strong>{getLevelLabel(ind.nodeLevel)}:</strong> {ind.nodeText}</div>
                      {ind.metodePenghitungan && (
                        <div style={{ marginTop:'6px' }}>
                          <span className="metode-badge" style={{ background:`${mc.color}22`,color:mc.color,border:`1px solid ${mc.color}44` }}>
                            <i className={mc.icon}></i> {mc.label}
                          </span>
                          <span style={{ marginLeft:'6px',color:'rgba(255,255,255,0.3)',fontSize:'10px' }}>
                            {normM === 'Tunggal' && Array.isArray(ind.variables) && ind.variables[0] && ind.variables[0].name}
                            {normM === 'Persentase' && Array.isArray(ind.variables) && ind.variables.length >= 2 && `${ind.variables[0].name} / ${ind.variables[1].name}`}
                            {['Rata-rata','Penjumlahan','Pembobotan'].includes(normM) && Array.isArray(ind.variables) && ind.variables.length > 0 && `${ind.variables.length} variabel`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && selectedIndicator && (
        <div style={{ position:'fixed',top:0,left:0,width:'100vw',height:'100vh',background:'rgba(15,23,42,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'20px' }}>
          <div className="glass-panel" style={{ width:'100%',maxWidth:'660px',maxHeight:'92vh',display:'flex',flexDirection:'column',padding:0 }}>
            <div className="panel-header justify-between" style={{ padding:'16px 20px',borderBottom:'1px solid var(--glass-border)',flexShrink:0 }}>
              <h3 style={{ fontSize:'16px',fontWeight:700,display:'flex',alignItems:'center',gap:'8px',margin:0 }}>
                <i className="fa-solid fa-pen-nib text-orange"></i> Edit Definisi Operasional
              </h3>
              <button onClick={handleCloseModal} style={{ background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'18px' }}><i className="fa-solid fa-xmark"></i></button>
            </div>

            <div style={{ padding:'20px',overflowY:'auto',flex:1 }}>
              {error && <div style={{ color:'var(--danger)',background:'rgba(239,68,68,0.1)',padding:'10px',borderRadius:'6px',marginBottom:'16px',fontSize:'13px' }}>{error}</div>}
              {success && <div style={{ color:'var(--success)',background:'rgba(16,185,129,0.1)',padding:'10px',borderRadius:'6px',marginBottom:'16px',fontSize:'13px' }}>{success}</div>}

              <form onSubmit={handleSave}>
                <div style={{ background:'rgba(15,23,42,0.4)',padding:'14px',borderRadius:'8px',border:'1px solid var(--glass-border)',marginBottom:'20px' }}>
                  <span style={{ fontSize:'9px',color:'var(--primary-orange)',fontWeight:700,textTransform:'uppercase' }}>Indikator</span>
                  <h4 style={{ fontSize:'14px',fontWeight:600,margin:'4px 0 8px 0',color: 'var(--text-primary)' }}>{selectedIndicator.indikator}</h4>
                  <div style={{ fontSize:'11.5px',color:'var(--text-muted)',borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:'8px' }}><strong>{getLevelLabel(selectedIndicator.nodeLevel)}:</strong> {selectedIndicator.nodeText}</div>
                  <div style={{ fontSize:'11.5px',color:'var(--text-muted)',marginTop:'4px' }}><strong>Satuan:</strong> {selectedIndicator.satuan} | <strong>Tipe Target:</strong> {selectedIndicator.tipeTarget}</div>
                </div>

                <div className="form-group mb-3">
                  <label style={{ fontSize:'12.5px',fontWeight:600,marginBottom:'6px',display:'block' }}>Definisi Operasional Indikator <span style={{ color:'red' }}>*</span></label>
                  <ReactQuill 
                    theme="snow"
                    value={definisiOperasional} 
                    onChange={setDefinisiOperasional} 
                    placeholder="Jelaskan secara rinci apa arti indikator ini dan bagaimana cakupan pengukurannya... (Bisa copy-paste tabel/gambar/rumus dari Word)"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', borderRadius: '4px' }}
                  />
                </div>

                <div className="form-group mb-3">
                  <label style={{ fontSize:'12.5px',fontWeight:600,marginBottom:'6px',display:'block' }}>Metode Penghitungan</label>
                  <select className="select-sim" value={metodePenghitungan} onChange={(e) => { 
                    const newMetode = e.target.value;
                    setMetodePenghitungan(newMetode); 
                    if (newMetode === 'Persentase') {
                      setVariables([{ name:'',weight:0 }, { name:'',weight:0 }]);
                    } else {
                      setVariables([{ name:'',weight:100 }]);
                    }
                  }}>
                    {METODE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <div style={{ marginTop:'8px',fontSize:'11px',color:'rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.02)',padding:'6px 10px',borderRadius:'4px',border:'1px solid var(--glass-border)' }}>
                    {metodePenghitungan === 'Tunggal' && 'Realisasi = V'}
                    {metodePenghitungan === 'Persentase' && 'Realisasi = (Pembilang / Penyebut) x 100'}
                    {metodePenghitungan === 'Rata-rata' && 'Realisasi = (V1 + V2 + ... + Vn) / n'}
                    {metodePenghitungan === 'Penjumlahan' && 'Realisasi = V1 + V2 + ... + Vn'}
                    {metodePenghitungan === 'Pembobotan' && 'Realisasi = (V1xW1) + (V2xW2) + ... + (VnxWn)'}
                  </div>
                </div>

                <div className="form-group mb-3" style={{ position: 'relative' }}>
                  <label style={{ fontSize:'12.5px',fontWeight:600,marginBottom:'6px',display:'block' }}>Alias Variabel Hasil Capaian (Opsional)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={outputVariableAlias} 
                    onChange={(e) => setOutputVariableAlias(e.target.value)} 
                    onFocus={() => setActiveSuggestionField('alias')}
                    onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                    placeholder="Contoh: Variabel X (Biarkan kosong jika hasil akhir tidak ingin diekspor sbg variabel)" 
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', borderRadius: '4px' }}
                    autoComplete="off"
                  />
                  {activeSuggestionField === 'alias' && getSuggestions(outputVariableAlias).length > 0 && (
                    <div className="suggestion-dropdown" style={{ top: '65px' }}>
                      {getSuggestions(outputVariableAlias).map((s, sidx) => (
                        <div key={sidx} className="suggestion-item" onMouseDown={() => { setOutputVariableAlias(s); setActiveSuggestionField(null); }}>
                          <i className="fa-solid fa-clock-rotate-left" style={{ marginRight:'8px',opacity:0.5 }}></i>{s}
                        </div>
                      ))}
                    </div>
                  )}
                  {duplicateAliasInfo && (
                    <div style={{ marginTop:'8px',background:'rgba(234,179,8,0.1)',border:'1px solid rgba(234,179,8,0.35)',borderRadius:'6px',padding:'10px 12px',fontSize:'11px',lineHeight:'1.6',display:'flex',gap:'10px',alignItems:'flex-start' }}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ color:'#eab308',marginTop:'2px',flexShrink:0 }}></i>
                      <div>
                        <strong style={{ color:'#eab308' }}>Alias sudah dipakai oleh {duplicateAliasInfo.length} indikator lain:</strong>
                        {duplicateAliasInfo.map((d, di) => (
                          <div key={di} style={{ color:'rgba(255,255,255,0.6)',marginTop:'2px' }}>• {d.indikator} <span style={{ opacity:0.5 }}>({d.nodeText})</span></div>
                        ))}
                        <div style={{ marginTop:'4px',color:'rgba(255,255,255,0.5)' }}>Nilai semua indikator dengan alias ini akan <strong style={{ color:'#eab308' }}>dijumlahkan otomatis</strong> saat digunakan oleh indikator lain.</div>
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop:'6px',fontSize:'11px',color:'rgba(255,255,255,0.4)' }}>
                    Jika diisi, nilai capaian indikator ini dapat ditarik otomatis oleh indikator lain menggunakan nama alias tersebut.
                  </div>
                </div>

                  <div style={{ background:'rgba(255,255,255,0.01)',border:'1px solid var(--glass-border)',padding:'14px',borderRadius:'8px',marginBottom:'16px' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px' }}>
                      <label style={{ fontSize:'12.5px',fontWeight:600 }}>
                        {metodePenghitungan === 'Tunggal' ? 'Definisi Variabel' : 'Daftar Variabel'} {metodePenghitungan === 'Pembobotan' && <span style={{ color:'var(--text-muted)',fontWeight:400,fontSize:'11px' }}>(Total bobot harus = 100)</span>}
                      </label>
                      {['Rata-rata', 'Penjumlahan', 'Pembobotan'].includes(metodePenghitungan) && (
                        <button type="button" onClick={addVariable} style={{ background:'rgba(255,107,0,0.12)',border:'1px solid rgba(255,107,0,0.3)',color:'var(--primary-orange)',borderRadius:'6px',padding:'4px 10px',cursor:'pointer',fontSize:'12px',display:'flex',alignItems:'center',gap:'4px' }}>
                          <i className="fa-solid fa-plus"></i> Tambah
                        </button>
                      )}
                    </div>

                    <div className={`var-row ${metodePenghitungan === 'Pembobotan' ? 'var-row-3' : 'var-row-2'}`} style={{ marginBottom:'6px' }}>
                      <span style={{ fontSize:'10px',color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase' }}>Nama Variabel <span style={{ color:'red' }}>*</span></span>
                      {metodePenghitungan === 'Pembobotan' && <span style={{ fontSize:'10px',color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase' }}>Bobot (0-100) <span style={{ color:'red' }}>*</span></span>}
                      <span></span>
                    </div>

                    <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
                      {variables.map((v, idx) => {
                        let placeholderText = `Variabel ${idx + 1} (contoh: Jumlah peserta pelatihan)`;
                        if (metodePenghitungan === 'Tunggal') placeholderText = 'Contoh: Jumlah sarana prasarana yang dibangun';
                        if (metodePenghitungan === 'Persentase' && idx === 0) placeholderText = 'Variabel Pembilang (Numerator)';
                        if (metodePenghitungan === 'Persentase' && idx === 1) placeholderText = 'Variabel Penyebut (Denominator)';
                        return (
                          <div key={idx} className={`var-row ${metodePenghitungan === 'Pembobotan' ? 'var-row-3' : 'var-row-2'}`} style={{ position: 'relative' }}>
                            <input type="text" className="form-control" style={{ fontSize:'12px',padding:'7px 10px' }} value={v.name} onChange={(e) => updateVariableName(idx, e.target.value)} onFocus={() => setActiveSuggestionField(`var_${idx}`)} onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)} placeholder={placeholderText} required autoComplete="off" />
                            {activeSuggestionField === `var_${idx}` && getSuggestions(v.name).length > 0 && (
                              <div className="suggestion-dropdown" style={{ top: '100%' }}>
                                {getSuggestions(v.name).map((s, sidx) => <div key={sidx} className="suggestion-item" onMouseDown={() => { updateVariableName(idx, s); setActiveSuggestionField(null); }}><i className="fa-solid fa-clock-rotate-left" style={{ marginRight:'8px',opacity:0.5 }}></i>{s}</div>)}
                              </div>
                            )}
                            {metodePenghitungan === 'Pembobotan' && (
                              <input type="number" className="form-control" style={{ fontSize:'12px',padding:'7px 10px',textAlign:'center' }} value={v.weight} step="0.1" min="0" max="100" onChange={(e) => updateVariableWeight(idx, e.target.value)} required />
                            )}
                            {['Rata-rata', 'Penjumlahan', 'Pembobotan'].includes(metodePenghitungan) ? (
                              <button type="button" onClick={() => removeVariable(idx)} disabled={variables.length <= 1} style={{ background:'transparent',border:'none',color:variables.length <= 1 ? 'rgba(255,255,255,0.1)' : 'var(--danger)',cursor:variables.length <= 1 ? 'not-allowed' : 'pointer',fontSize:'14px',padding:'4px',display:'flex',alignItems:'center' }}>
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            ) : <span></span>}
                          </div>
                        );
                      })}
                    </div>

                    {metodePenghitungan === 'Pembobotan' && (
                      <div style={{ marginTop:'12px' }}>
                        <div style={{ display:'flex',justifyContent:'space-between',fontSize:'11px',marginBottom:'4px' }}>
                          <span style={{ color:'var(--text-muted)' }}>Total Bobot:</span>
                          <span style={{ color:Math.abs(totalWeight - 100) < 0.001 ? 'var(--success)' : 'var(--danger)',fontWeight:700 }}>
                            {totalWeight.toFixed(1)} {Math.abs(totalWeight - 100) < 0.001 ? '✓' : `(sisa ${(100 - totalWeight).toFixed(1)})`}
                          </span>
                        </div>
                        <div className="weight-bar"><div className="weight-bar-fill" style={{ width:`${Math.min(totalWeight, 100)}%`,background:Math.abs(totalWeight - 100) < 0.001 ? 'var(--success)' : 'var(--primary-orange)' }}></div></div>
                      </div>
                    )}

                    {variables.some(v => v.name.trim()) && ['Rata-rata', 'Penjumlahan', 'Pembobotan'].includes(metodePenghitungan) && (
                      <div style={{ marginTop:'12px',fontSize:'11px',color:'rgba(255,255,255,0.5)',background:'rgba(255,255,255,0.02)',padding:'8px 10px',borderRadius:'4px',border:'1px solid var(--glass-border)',fontFamily:'monospace',wordBreak:'break-word' }}>
                        {metodePenghitungan === 'Rata-rata' && <>Realisasi = ({variables.filter(v => v.name.trim()).map(v => v.name.trim()).join(' + ')}) / {variables.filter(v => v.name.trim()).length}</>}
                        {metodePenghitungan === 'Penjumlahan' && <>Realisasi = {variables.filter(v => v.name.trim()).map(v => v.name.trim()).join(' + ')}</>}
                        {metodePenghitungan === 'Pembobotan' && <>Realisasi = {variables.filter(v => v.name.trim()).map(v => `(${v.name.trim()} x ${v.weight})`).join(' + ')} / 100</>}
                      </div>
                    )}
                  </div>

                <div style={{ display:'flex',gap:'12px',marginTop:'24px',borderTop:'1px solid var(--glass-border)',paddingTop:'16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleAutoSuggest} disabled={isSaving} style={{ flex:1 }}><i className="fa-solid fa-wand-magic-sparkles"></i> Rekomendasi</button>
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal} disabled={isSaving} style={{ flex:0.8 }}>Batal</button>
                  <button type="submit" className="btn btn-orange" disabled={isSaving} style={{ flex:1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {isSaving ? (
                      <>
                        <img src="/logo.png" alt="Loading" style={{ width: '14px', height: '14px', objectFit: 'contain', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                        <style dangerouslySetInnerHTML={{__html:`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}} />
                        Menyimpan...
                      </>
                    ) : (
                      <><i className="fa-solid fa-save"></i> Simpan Parameter</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
