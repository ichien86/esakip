'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function OperationalDefinitionPage() {
  const { fetchWithAuth, activeRole } = useSimulation();

  const [nodes, setNodes] = useState([]);
  const [selectedIndicator, setSelectedIndicator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Editor States
  const [definisiOperasional, setDefinisiOperasional] = useState('');
  const [metodePenghitungan, setMetodePenghitungan] = useState('Jumlah'); // Jumlah, Persentase
  const [variabelJumlah, setVariabelJumlah] = useState('');
  const [variabelPembilang, setVariabelPembilang] = useState('');
  const [variabelPenyebut, setVariabelPenyebut] = useState('');

  // Autocomplete Suggestions State
  const [activeSuggestionField, setActiveSuggestionField] = useState(null); // 'jumlah', 'pembilang', 'penyebut'

  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('Semua');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const searchInputRef = useRef(null);

  const loadNodes = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/cascading5years');
      if (res.ok) {
        const data = await res.json();
        setNodes(data);
      }
    } catch (e) {
      console.error('Failed to load cascading nodes', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNodes();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
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
  }, []);

  // Compute unique existing variables in the system
  const uniqueVariables = useMemo(() => {
    const all = [];
    nodes.forEach(node => {
      if (node.indicators && Array.isArray(node.indicators)) {
        node.indicators.forEach(ind => {
          if (ind.variabelJumlah) all.push(ind.variabelJumlah.trim());
          if (ind.variabelPembilang) all.push(ind.variabelPembilang.trim());
          if (ind.variabelPenyebut) all.push(ind.variabelPenyebut.trim());
        });
      }
    });
    return [...new Set(all)].filter(Boolean);
  }, [nodes]);

  // Hybrid keyword suggestion helper
  const getSuggestions = (inputVal) => {
    if (!inputVal || inputVal.trim().length < 2) return [];
    const terms = inputVal.toLowerCase().split(/\s+/).filter(Boolean);
    return uniqueVariables.filter(v => {
      if (v.toLowerCase() === inputVal.trim().toLowerCase()) return false;
      return terms.every(t => v.toLowerCase().includes(t));
    }).slice(0, 5); // Limit to 5 results
  };

  const handleSelectIndicator = (ind) => {
    setSelectedIndicator(ind);
    setSuccess('');
    setError('');
    
    setDefinisiOperasional(ind.definisiOperasional || '');
    const method = (ind.metodePenghitungan === 'Persentase' || ind.metodePenghitungan === 'Jumlah') 
                   ? ind.metodePenghitungan 
                   : 'Jumlah';
    setMetodePenghitungan(method);
    setVariabelJumlah(ind.variabelJumlah || '');
    setVariabelPembilang(ind.variabelPembilang || '');
    setVariabelPenyebut(ind.variabelPenyebut || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedIndicator(null);
    setSuccess('');
    setError('');
    setActiveSuggestionField(null);
  };

  const handleAutoSuggest = () => {
    if (!selectedIndicator || !selectedIndicator.indikator) return;
    const textVal = selectedIndicator.indikator;
    const lower = textVal.toLowerCase();
    const isPercent = lower.includes('persen') || lower.includes('%') || lower.includes('persentase');

    if (isPercent) {
      setMetodePenghitungan('Persentase');
      let subject = textVal.replace(/persentase|persen|%/gi, '').trim();
      if (subject) {
        subject = subject.charAt(0).toUpperCase() + subject.slice(1);
      } else {
        subject = "Kegiatan";
      }
      setVariabelPembilang(`Jumlah ${subject} yang terealisasi/selesai`);
      setVariabelPenyebut(`Jumlah total target ${subject} yang direncanakan`);
      setVariabelJumlah('');
    } else {
      setMetodePenghitungan('Jumlah');
      setVariabelJumlah(textVal);
      setVariabelPembilang('');
      setVariabelPenyebut('');
    }
    setSuccess('Rekomendasi variabel berhasil dibuat berdasarkan teks indikator.');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedIndicator) return;
    setSuccess('');
    setError('');

    // Prevent duplicate variables inside the same indicator in Persentase mode
    if (metodePenghitungan === 'Persentase' && variabelPembilang.trim().toLowerCase() === variabelPenyebut.trim().toLowerCase()) {
      setError('Variabel Pembilang dan Penyebut tidak boleh bernilai sama.');
      return;
    }

    const originalNode = nodes.find(n => n.id === selectedIndicator.nodeId);
    if (!originalNode) {
      setError('Node tidak ditemukan.');
      return;
    }

    const updatedIndicators = [...(originalNode.indicators || [])];
    updatedIndicators[selectedIndicator.indicatorIndex] = {
      ...updatedIndicators[selectedIndicator.indicatorIndex],
      definisiOperasional,
      metodePenghitungan,
      variabelJumlah: metodePenghitungan === 'Jumlah' ? variabelJumlah : '',
      variabelPembilang: metodePenghitungan === 'Persentase' ? variabelPembilang : '',
      variabelPenyebut: metodePenghitungan === 'Persentase' ? variabelPenyebut : ''
    };

    const payload = {
      ...originalNode,
      indicators: updatedIndicators,
      requesterRole: activeRole
    };

    try {
      const res = await fetchWithAuth('/api/cascading5years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccess('Definisi operasional indikator berhasil diperbarui.');
        await loadNodes();
        
        // Auto-close modal after delay so user sees success state
        setTimeout(() => {
          handleCloseModal();
        }, 1200);
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan perubahan.');
      }
    } catch (e) {
      setError('Kesalahan jaringan saat menyimpan.');
    }
  };

  const getLevelLabel = (level) => {
    const labels = {
      tujuan: 'Tujuan Strategis',
      sasaran: 'Sasaran Strategis',
      sasaran_program: 'Sasaran Program',
      sasaran_kegiatan: 'Sasaran Kegiatan',
      sasaran_subkegiatan: 'Sasaran Subkegiatan',
      sasaran_aktivitas: 'Sasaran Aktivitas'
    };
    return labels[level] || level;
  };

  // Extract all indicators
  const allIndicators = [];
  nodes.forEach(node => {
    if (node.indicators && Array.isArray(node.indicators)) {
      node.indicators.forEach((ind, index) => {
        allIndicators.push({
          nodeId: node.id,
          nodeText: node.text,
          nodeLevel: node.level,
          indicatorIndex: index,
          ...ind
        });
      });
    }
  });

  const filteredIndicators = allIndicators.filter(ind => {
    const matchesSearch = (ind.indikator || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (ind.nodeText || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = filterLevel === 'Semua' || ind.nodeLevel === filterLevel;
    return matchesSearch && matchesLevel;
  });

  const hasAccess = activeRole === 'admin' || activeRole === 'perencana';

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
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: modalFadeIn 0.2s ease-out;
        }
        .modal-container {
          background: rgba(22, 28, 45, 0.95);
          border: 1px solid var(--glass-border);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          border-radius: 16px;
          width: 95%;
          max-width: 650px;
          max-height: 90vh;
          overflow-y: auto;
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .indicator-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          padding: 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }
        .indicator-card:hover {
          background: rgba(255, 107, 0, 0.05);
          border-color: rgba(255, 107, 0, 0.3);
          transform: translateY(-2px);
        }
        .suggestion-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: rgb(15, 23, 42);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          z-index: 1010;
          max-height: 180px;
          overflow-y: auto;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.7);
          margin-top: 4px;
        }
        .suggestion-item {
          padding: 8px 12px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: background 0.15s ease;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .suggestion-item:hover {
          background: rgba(255, 107, 0, 0.15);
          color: white;
        }
      `}</style>

      {/* Main Panel */}
      <div className="glass-panel">
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3>
              <i className="fa-solid fa-book-bookmark text-orange"></i> Definisi Operasional Indikator Strategis Renstra
            </h3>
            <p className="text-muted">Kelola definisi operasional, metode perhitungan, dan variabel indikator kinerja dalam struktur cascading daerah.</p>
          </div>
        </div>

        <div className="panel-body">
          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
              <input
                ref={searchInputRef}
                type="text"
                className="form-control"
                placeholder="Cari indikator atau deskripsi rencana induk... (Tekan '/')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="form-control"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="Semua">Semua Level Cascading</option>
              <option value="tujuan">Tujuan Strategis</option>
              <option value="sasaran">Sasaran Strategis</option>
              <option value="sasaran_program">Sasaran Program</option>
              <option value="sasaran_kegiatan">Sasaran Kegiatan</option>
              <option value="sasaran_subkegiatan">Sasaran Subkegiatan</option>
              <option value="sasaran_aktivitas">Sasaran Aktivitas</option>
            </select>
          </div>

          {/* Indicators Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>
              <i className="fa-solid fa-circle-notch fa-spin fa-2x text-orange" style={{ marginBottom: '12px' }}></i>
              <p>Memuat data indikator strategis...</p>
            </div>
          ) : filteredIndicators.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
              <i className="fa-solid fa-magnifying-glass fa-2x text-muted" style={{ marginBottom: '12px' }}></i>
              <p>Tidak ada indikator yang cocok dengan pencarian Anda.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px'
            }}>
              {filteredIndicators.map((ind, index) => (
                <div
                  key={`${ind.nodeId}_${ind.indicatorIndex}_${index}`}
                  className="indicator-card"
                  onClick={() => handleSelectIndicator(ind)}
                  style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                      <span style={{
                        fontSize: '9px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)'
                      }}>{getLevelLabel(ind.nodeLevel)}</span>
                      
                      {ind.definisiOperasional ? (
                        <span className="badge badge-finished" style={{ fontSize: '9px', padding: '3px 8px' }}>
                          <i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i> Terdefinisi
                        </span>
                      ) : (
                        <span className="badge badge-none" style={{ fontSize: '9px', padding: '3px 8px' }}>
                          <i className="fa-solid fa-pen-nib" style={{ marginRight: '4px' }}></i> Belum Diisi
                        </span>
                      )}
                    </div>
                    
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', lineHeight: '1.4' }}>
                      {ind.indikator}
                    </h4>

                    {ind.definisiOperasional && (
                      <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '8px', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ind.definisiOperasional}
                      </p>
                    )}
                  </div>
                  
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong>{getLevelLabel(ind.nodeLevel)}:</strong> {ind.nodeText}
                    </div>
                    {ind.metodePenghitungan && (
                      <div style={{ marginTop: '4px', color: 'var(--primary-orange)' }}>
                        <strong>Metode:</strong> {ind.metodePenghitungan} 
                        {ind.metodePenghitungan === 'Jumlah' && ind.variabelJumlah && ` (${ind.variabelJumlah})`}
                        {ind.metodePenghitungan === 'Persentase' && ind.variabelPembilang && ` (${ind.variabelPembilang} / ${ind.variabelPenyebut})`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {isModalOpen && selectedIndicator && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div className="panel-header justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <i className="fa-solid fa-pen-nib text-orange"></i> Edit Definisi Operasional
              </h3>
              <button 
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto' }}>
              {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
              {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

              <form onSubmit={handleSave}>
                {/* Read-only Context */}
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '14px', borderRadius: '8px', border: '1px solid var(--glass-border)', marginBottom: '20px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--primary-orange)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {getLevelLabel(selectedIndicator.nodeLevel)}
                  </span>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '4px 0 8px 0', color: 'white' }}>
                    {selectedIndicator.indikator}
                  </h4>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                    <strong>{getLevelLabel(selectedIndicator.nodeLevel)}:</strong> {selectedIndicator.nodeText}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <strong>Satuan:</strong> {selectedIndicator.satuan} | <strong>Tipe Target:</strong> {selectedIndicator.tipeTarget}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="form-group mb-3">
                  <label style={{ fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    Definisi Operasional Indikator <span style={{ color: 'red' }}>*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={definisiOperasional}
                    onChange={(e) => setDefinisiOperasional(e.target.value)}
                    placeholder="Jelaskan secara rinci apa arti indikator ini dan bagaimana cakupan pengukurannya..."
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label style={{ fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    Metode Penghitungan
                  </label>
                  <select
                    className="select-sim"
                    value={metodePenghitungan}
                    onChange={(e) => setMetodePenghitungan(e.target.value)}
                  >
                    <option value="Jumlah">Jumlah (Satu Variabel)</option>
                    <option value="Persentase">Persentase (Dua Variabel)</option>
                  </select>
                </div>

                {metodePenghitungan === 'Jumlah' && (
                  <div className="form-group mb-3" style={{ position: 'relative' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                      Nama Variabel Jumlah <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={variabelJumlah}
                      onChange={(e) => setVariabelJumlah(e.target.value)}
                      onFocus={() => setActiveSuggestionField('jumlah')}
                      onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                      placeholder="Contoh: Jumlah sarana prasarana yang dibangun"
                      required
                      autoComplete="off"
                    />
                    {activeSuggestionField === 'jumlah' && getSuggestions(variabelJumlah).length > 0 && (
                      <div className="suggestion-dropdown">
                        {getSuggestions(variabelJumlah).map((suggestion, idx) => (
                          <div
                            key={idx}
                            className="suggestion-item"
                            onMouseDown={() => {
                              setVariabelJumlah(suggestion);
                              setActiveSuggestionField(null);
                            }}
                          >
                            <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', opacity: 0.5 }}></i>
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {metodePenghitungan === 'Persentase' && (
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                        Variabel Pembilang (Bagian Atas Pecahan) <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={variabelPembilang}
                        onChange={(e) => setVariabelPembilang(e.target.value)}
                        onFocus={() => setActiveSuggestionField('pembilang')}
                        onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                        placeholder="Contoh: Jumlah desa tangguh bencana yang terbentuk"
                        required
                        autoComplete="off"
                      />
                      {activeSuggestionField === 'pembilang' && getSuggestions(variabelPembilang).length > 0 && (
                        <div className="suggestion-dropdown">
                          {getSuggestions(variabelPembilang).map((suggestion, idx) => (
                            <div
                              key={idx}
                              className="suggestion-item"
                              onMouseDown={() => {
                                setVariabelPembilang(suggestion);
                                setActiveSuggestionField(null);
                              }}
                            >
                              <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', opacity: 0.5 }}></i>
                              {suggestion}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                        Variabel Penyebut (Bagian Bawah Pecahan) <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={variabelPenyebut}
                        onChange={(e) => setVariabelPenyebut(e.target.value)}
                        onFocus={() => setActiveSuggestionField('penyebut')}
                        onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                        placeholder="Contoh: Jumlah keseluruhan desa rawan bencana"
                        required
                        autoComplete="off"
                      />
                      {activeSuggestionField === 'penyebut' && getSuggestions(variabelPenyebut).length > 0 && (
                        <div className="suggestion-dropdown">
                          {getSuggestions(variabelPenyebut).map((suggestion, idx) => (
                            <div
                              key={idx}
                              className="suggestion-item"
                              onMouseDown={() => {
                                setVariabelPenyebut(suggestion);
                                setActiveSuggestionField(null);
                              }}
                            >
                              <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', opacity: 0.5 }}></i>
                              {suggestion}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Modal Footer Actions */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleAutoSuggest} style={{ flex: 1 }}>
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Rekomendasi
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal} style={{ flex: 0.8 }}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-orange" style={{ flex: 1.5 }}>
                    <i className="fa-solid fa-save"></i> Simpan Parameter
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
