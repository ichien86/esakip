'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function OperationalDefinitionPage() {
  const { fetchWithAuth, activeRole } = useSimulation();

  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Editor States
  const [definisiOperasional, setDefinisiOperasional] = useState('');
  const [metodePenghitungan, setMetodePenghitungan] = useState('Jumlah'); // Jumlah, Persentase
  const [variabelJumlah, setVariabelJumlah] = useState('');
  const [variabelPembilang, setVariabelPembilang] = useState('');
  const [variabelPenyebut, setVariabelPenyebut] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('Semua');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const loadNodes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cascading5years');
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

  const handleSelectNode = (node) => {
    setSelectedNode(node);
    setSuccess('');
    setError('');
    
    setDefinisiOperasional(node.definisiOperasional || '');
    // Ensure we fallback to 'Jumlah' if a deprecated method like 'Lainnya' was used previously
    const method = (node.metodePenghitungan === 'Persentase' || node.metodePenghitungan === 'Jumlah') 
                   ? node.metodePenghitungan 
                   : 'Jumlah';
    setMetodePenghitungan(method);
    setVariabelJumlah(node.variabelJumlah || '');
    setVariabelPembilang(node.variabelPembilang || '');
    setVariabelPenyebut(node.variabelPenyebut || '');
  };

  const handleAutoSuggest = () => {
    if (!selectedNode || !selectedNode.indikator) return;
    const textVal = selectedNode.indikator;
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
    if (!selectedNode) return;
    setSuccess('');
    setError('');

    const payload = {
      definisiOperasional,
      metodePenghitungan,
      variabelJumlah: metodePenghitungan === 'Jumlah' ? variabelJumlah : '',
      variabelPembilang: metodePenghitungan === 'Persentase' ? variabelPembilang : '',
      variabelPenyebut: metodePenghitungan === 'Persentase' ? variabelPenyebut : ''
    };

    try {
      const res = await fetchWithAuth(`/api/cascading5years/${selectedNode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccess('Definisi operasional indikator berhasil diperbarui.');
        
        // Update local list state
        setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, ...payload } : n));
        setSelectedNode({ ...selectedNode, ...payload });
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
      program: 'Program',
      kegiatan: 'Kegiatan',
      subkegiatan: 'Subkegiatan',
      aktivitas: 'Aktivitas'
    };
    return labels[level] || level;
  };

  const filteredNodes = nodes.filter(node => {
    const matchesSearch = node.indikator.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          node.text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = filterLevel === 'Semua' || node.level === filterLevel;
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
      <div className="grid-two-columns" style={{ gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
        
        {/* Left Panel: List of Indicators */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3>
              <i className="fa-solid fa-list text-orange"></i> Indikator Strategis 5 Tahunan
            </h3>
          </div>
          <div className="panel-body">
            
            {/* Search & Filter */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Cari indikator/deskripsi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <select
                className="form-control"
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                style={{ width: '150px' }}
              >
                <option value="Semua">Semua Level</option>
                <option value="tujuan">Tujuan</option>
                <option value="sasaran">Sasaran</option>
                <option value="program">Program</option>
                <option value="kegiatan">Kegiatan</option>
                <option value="subkegiatan">Subkegiatan</option>
                <option value="aktivitas">Aktivitas</option>
              </select>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                <i className="fa-solid fa-circle-notch fa-spin"></i> Memuat data indikator...
              </div>
            ) : filteredNodes.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                Tidak ada indikator yang cocok.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredNodes.map(node => (
                  <div
                    key={node.id}
                    onClick={() => handleSelectNode(node)}
                    style={{
                      background: selectedNode?.id === node.id ? 'rgba(255, 107, 0, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid',
                      borderColor: selectedNode?.id === node.id ? 'var(--primary-orange)' : 'var(--glass-border)',
                      padding: '12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{
                        fontSize: '9px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)'
                      }}>{getLevelLabel(node.level)}</span>
                      
                      {node.definisiOperasional ? (
                        <span className="badge badge-finished" style={{ fontSize: '9px', padding: '2px 6px' }}>Terdefinisi</span>
                      ) : (
                        <span className="badge badge-none" style={{ fontSize: '9px', padding: '2px 6px' }}>Belum Diisi</span>
                      )}
                    </div>
                    
                    <h4 style={{ fontSize: '13px', fontWeight: 600, marginTop: '8px' }}>
                      {node.indikator}
                    </h4>
                    
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Uraian: {node.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Operational Definition Editor */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3>
              <i className="fa-solid fa-pen-to-square text-orange"></i> Edit Definisi Operasional
            </h3>
          </div>
          <div className="panel-body">
            {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
            {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

            {!selectedNode ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>
                <i className="fa-solid fa-hand-pointer fa-3x text-muted" style={{ marginBottom: '16px', display: 'block' }}></i>
                <h4>Pilih Indikator di Sebelah Kiri</h4>
                <p style={{ fontSize: '12px' }}>Pilih salah satu indikator dari daftar untuk mengelola definisi operasional dan metode penghitungannya secara rinci.</p>
              </div>
            ) : (
              <form onSubmit={handleSave}>
                {/* Node Details (Read-only Context) */}
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '14px', borderRadius: '8px', border: '1px solid var(--glass-border)', marginBottom: '20px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--primary-orange)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {getLevelLabel(selectedNode.level)}
                  </span>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '4px 0 8px 0' }}>
                    {selectedNode.indikator}
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                    <strong>Deskripsi Rencana:</strong> {selectedNode.text}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <strong>Satuan:</strong> {selectedNode.satuan} | <strong>Tipe Target:</strong> {selectedNode.tipeTarget}
                  </p>
                </div>

                {/* operational fields */}
                <div className="form-group mb-3">
                  <label>Definisi Operasional Indikator</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={definisiOperasional}
                    onChange={(e) => setDefinisiOperasional(e.target.value)}
                    placeholder="Jelaskan secara rinci apa arti indikator ini dan bagaimana batasan/cakupan pengukurannya..."
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Metode Penghitungan</label>
                  <select
                    className="select-sim"
                    value={metodePenghitungan}
                    onChange={(e) => setMetodePenghitungan(e.target.value)}
                  >
                    <option value="Jumlah">Jumlah (Satu Variabel)</option>
                    <option value="Persentase">Persentase (Dua Variabel: Pembilang & Penyebut)</option>
                  </select>
                </div>

                {metodePenghitungan === 'Jumlah' && (
                  <div className="form-group mb-3">
                    <label>Nama Variabel Jumlah</label>
                    <input
                      type="text"
                      className="form-control"
                      value={variabelJumlah}
                      onChange={(e) => setVariabelJumlah(e.target.value)}
                      placeholder="Contoh: Jumlah sarana prasarana yang dibangun"
                      required
                    />
                  </div>
                )}

                {metodePenghitungan === 'Persentase' && (
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Variabel Pembilang (Numerator / Bagian Atas Pecahan)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={variabelPembilang}
                        onChange={(e) => setVariabelPembilang(e.target.value)}
                        placeholder="Contoh: Jumlah desa tangguh bencana yang terbentuk"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Variabel Penyebut (Denominator / Bagian Bawah Pecahan)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={variabelPenyebut}
                        onChange={(e) => setVariabelPenyebut(e.target.value)}
                        placeholder="Contoh: Jumlah keseluruhan desa rawan bencana"
                        required
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleAutoSuggest} style={{ flex: 1 }}>
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Rekomendasikan Variabel
                  </button>
                  <button type="submit" className="btn btn-orange" style={{ flex: 1.2 }}>
                    <i className="fa-solid fa-save"></i> Simpan Definisi Operasional
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>

      </div>
    </section>
  );
}
