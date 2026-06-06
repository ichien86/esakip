'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function AdminCascading5YearsPage() {
  const { fetchWithAuth, activeRole, activeBidang, refreshMetadata } = useSimulation();

  const [nodes, setNodes] = useState([]);
  const [masterPrograms, setMasterPrograms] = useState([]);
  const [masterKegiatans, setMasterKegiatans] = useState([]);
  const [masterSubkegiatans, setMasterSubkegiatans] = useState([]);

  // Form states
  const [formId, setFormId] = useState('');
  const [level, setLevel] = useState('tujuan');
  const [parentId, setParentId] = useState('');
  
  // Text content or Master selection
  const [text, setText] = useState('');
  const [selectedMasterId, setSelectedMasterId] = useState(''); // Stores the picked master ID (mp_X, mk_X, msk_X)
  
  const [indikator, setIndikator] = useState('');
  const [satuan, setSatuan] = useState('');
  const [tipeTarget, setTipeTarget] = useState('Kondisi Akhir Naik');
  const [selectedBidangs, setSelectedBidangs] = useState([]);
  
  // Operational definition and sub-activity fields
  const [sasaranSubkegiatan, setSasaranSubkegiatan] = useState('');
  const [definisiOperasional, setDefinisiOperasional] = useState('');
  const [metodePenghitungan, setMetodePenghitungan] = useState('Jumlah'); // Jumlah, Persentase, Lainnya
  const [variabelJumlah, setVariabelJumlah] = useState('');
  const [variabelPembilang, setVariabelPembilang] = useState('');
  const [variabelPenyebut, setVariabelPenyebut] = useState('');

  // Cross-cutting states
  const [crossCuttingType, setCrossCuttingType] = useState('shared');
  const [splitTargets, setSplitTargets] = useState({}); // { "Bidang A": target, ... }

  // Target inputs
  const [t2025, setT2025] = useState('0');
  const [t2026, setT2026] = useState('0');
  const [t2027, setT2027] = useState('0');
  const [t2028, setT2028] = useState('0');
  const [t2029, setT2029] = useState('0');
  const [t2030, setT2030] = useState('0');
  const [targetAkhir, setTargetAkhir] = useState('0');

  // Budget (Anggaran) inputs
  const [b2025, setB2025] = useState('0');
  const [b2026, setB2026] = useState('0');
  const [b2027, setB2027] = useState('0');
  const [b2028, setB2028] = useState('0');
  const [b2029, setB2029] = useState('0');
  const [b2030, setB2030] = useState('0');
  const [budgetAkhir, setBudgetAkhir] = useState('0');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch('/api/cascading5years');
      if (res.ok) setNodes(await res.json());

      const mpRes = await fetch('/api/master/program');
      if (mpRes.ok) setMasterPrograms(await mpRes.json());

      const mkRes = await fetch('/api/master/kegiatan');
      if (mkRes.ok) setMasterKegiatans(await mkRes.json());

      const mskRes = await fetch('/api/master/subkegiatan');
      if (mskRes.ok) setMasterSubkegiatans(await mskRes.json());
    } catch (e) {
      console.error('Failed to load cascading data', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1. Auto calculate Target Akhir based on selected tipeTarget
  useEffect(() => {
    const val2025 = parseFloat(t2025) || 0;
    const val2026 = parseFloat(t2026) || 0;
    const val2027 = parseFloat(t2027) || 0;
    const val2028 = parseFloat(t2028) || 0;
    const val2029 = parseFloat(t2029) || 0;
    const val2030 = parseFloat(t2030) || 0;

    if (tipeTarget === 'Akumulatif') {
      const sum = val2025 + val2026 + val2027 + val2028 + val2029 + val2030;
      setTargetAkhir(sum.toString());
    } else {
      // Kondisi Akhir Naik / Kondisi Akhir Menurun -> equals the target of year 2030
      setTargetAkhir(t2030);
    }
  }, [t2025, t2026, t2027, t2028, t2029, t2030, tipeTarget]);

  // 2. Auto calculate Budget Akhir (always the sum of 2025-2030 budgets)
  useEffect(() => {
    const val2025 = parseFloat(b2025) || 0;
    const val2026 = parseFloat(b2026) || 0;
    const val2027 = parseFloat(b2027) || 0;
    const val2028 = parseFloat(b2028) || 0;
    const val2029 = parseFloat(b2029) || 0;
    const val2030 = parseFloat(b2030) || 0;
    const sum = val2025 + val2026 + val2027 + val2028 + val2029 + val2030;
    setBudgetAkhir(sum.toString());
  }, [b2025, b2026, b2027, b2028, b2029, b2030]);

  // 3. Handle level switch: reset fields
  useEffect(() => {
    if (!isEditing) {
      setParentId('');
      setText('');
      setSelectedMasterId('');
      setIndikator('');
      setSatuan('');
    }
  }, [level]);

  // 4. Handle Master dropdown selection change
  const handleMasterChange = (masterId) => {
    setSelectedMasterId(masterId);
    if (!masterId) {
      setText('');
      setIndikator('');
      setSatuan('');
      return;
    }

    if (level === 'program') {
      const item = masterPrograms.find(p => p.id === masterId);
      if (item) setText(item.nama);
    } else if (level === 'kegiatan') {
      const item = masterKegiatans.find(k => k.id === masterId);
      if (item) setText(item.nama);
    } else if (level === 'subkegiatan') {
      const item = masterSubkegiatans.find(s => s.id === masterId);
      if (item) {
        setText(item.nama);
        // Lock these default fields
        setIndikator(item.indikator);
        setSatuan(item.satuan);
        // Automatically trigger suggestions based on the master indicator
        setTimeout(() => triggerIndikatorSuggestions(item.indikator), 50);
      }
    }
  };

  const triggerIndikatorSuggestions = (textVal) => {
    if (!textVal) return;
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
    } else {
      setMetodePenghitungan('Jumlah');
      setVariabelJumlah(textVal);
    }
  };

  const handleIndikatorBlur = () => {
    if (!indikator) return;
    // Only auto-fill if variables are currently empty
    const lower = indikator.toLowerCase();
    const isPercent = lower.includes('persen') || lower.includes('%') || lower.includes('persentase');
    
    if (isPercent) {
      if (metodePenghitungan !== 'Persentase') {
        setMetodePenghitungan('Persentase');
      }
      let subject = indikator.replace(/persentase|persen|%/gi, '').trim();
      if (subject) {
        subject = subject.charAt(0).toUpperCase() + subject.slice(1);
      } else {
        subject = "Kegiatan";
      }
      if (!variabelPembilang) {
        setVariabelPembilang(`Jumlah ${subject} yang terealisasi/selesai`);
      }
      if (!variabelPenyebut) {
        setVariabelPenyebut(`Jumlah total target ${subject} yang direncanakan`);
      }
    } else {
      if (metodePenghitungan === 'Persentase') {
        setMetodePenghitungan('Jumlah');
      }
      if (!variabelJumlah) {
        setVariabelJumlah(indikator);
      }
    }
  };

  const handleBidangChange = (bidang) => {
    if (selectedBidangs.includes(bidang)) {
      setSelectedBidangs(selectedBidangs.filter(b => b !== bidang));
    } else {
      setSelectedBidangs([...selectedBidangs, bidang]);
    }
  };

  const handleSplitTargetChange = (bidang, val) => {
    setSplitTargets({
      ...splitTargets,
      [bidang]: val
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (selectedBidangs.length === 0) {
      setError('Pilih minimal satu bidang pengampu.');
      return;
    }

    if (level !== 'tujuan' && !parentId) {
      setError('Pilih induk node (parent) untuk level ini.');
      return;
    }

    const payload = {
      id: formId,
      level,
      text,
      indikator,
      satuan,
      tipeTarget,
      parentId: level === 'tujuan' ? null : parentId,
      bidangPengampu: selectedBidangs,
      crossCuttingType,
      splitTargets,
      target2025: t2025,
      target2026: t2026,
      target2027: t2027,
      target2028: t2028,
      target2029: t2029,
      target2030: t2030,
      targetAkhir,
      anggaran2025: b2025,
      anggaran2026: b2026,
      anggaran2027: b2027,
      anggaran2028: b2028,
      anggaran2029: b2029,
      anggaran2030: b2030,
      anggaranAkhir: budgetAkhir,
      requesterRole: activeRole,
      requesterBidang: activeBidang,
      sasaranSubkegiatan,
      definisiOperasional,
      metodePenghitungan,
      variabelJumlah,
      variabelPembilang,
      variabelPenyebut
    };

    try {
      const res = await fetchWithAuth('/api/cascading5years', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSuccess('Item cascading 5 tahunan berhasil disimpan.');
        resetForm();
        loadData();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan data.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const editNode = (node) => {
    setIsEditing(true);
    setFormId(node.id);
    setLevel(node.level);
    setParentId(node.parentId || '');
    setText(node.text);
    setIndikator(node.indikator);
    setSatuan(node.satuan);
    setTipeTarget(node.tipeTarget);
    setSelectedBidangs(node.bidangPengampu || []);
    setCrossCuttingType(node.crossCuttingType || 'shared');
    setSplitTargets(node.splitTargets || {});
    
    setT2025(node.target2025 || '0');
    setT2026(node.target2026 || '0');
    setT2027(node.target2027 || '0');
    setT2028(node.target2028 || '0');
    setT2029(node.target2029 || '0');
    setT2030(node.target2030 || '0');
    
    setB2025(node.anggaran2025 || '0');
    setB2026(node.anggaran2026 || '0');
    setB2027(node.anggaran2027 || '0');
    setB2028(node.anggaran2028 || '0');
    setB2029(node.anggaran2029 || '0');
    setB2030(node.anggaran2030 || '0');

    setSasaranSubkegiatan(node.sasaranSubkegiatan || '');
    setDefinisiOperasional(node.definisiOperasional || '');
    setMetodePenghitungan(node.metodePenghitungan || 'Jumlah');
    setVariabelJumlah(node.variabelJumlah || '');
    setVariabelPembilang(node.variabelPembilang || '');
    setVariabelPenyebut(node.variabelPenyebut || '');
  };

  const deleteNode = async (id) => {
    if (!confirm('Yakin ingin menghapus node ini beserta semua turunannya?')) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetchWithAuth(`/api/cascading5years/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSuccess('Node beserta turunannya berhasil dihapus.');
        loadData();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menghapus node.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setFormId('');
    setLevel('tujuan');
    setParentId('');
    setText('');
    setSelectedMasterId('');
    setIndikator('');
    setSatuan('');
    setTipeTarget('Kondisi Akhir Naik');
    setSelectedBidangs([]);
    setCrossCuttingType('shared');
    setSplitTargets({});
    
    setT2025('0');
    setT2026('0');
    setT2027('0');
    setT2028('0');
    setT2029('0');
    setT2030('0');
    
    setB2025('0');
    setB2026('0');
    setB2027('0');
    setB2028('0');
    setB2029('0');
    setB2030('0');

    setSasaranSubkegiatan('');
    setDefinisiOperasional('');
    setMetodePenghitungan('Jumlah');
    setVariabelJumlah('');
    setVariabelPembilang('');
    setVariabelPenyebut('');
  };

  // Filter parent choices based on hierarchy levels
  const getParentChoices = () => {
    if (level === 'sasaran') return nodes.filter(n => n.level === 'tujuan');
    if (level === 'program') return nodes.filter(n => n.level === 'sasaran');
    if (level === 'kegiatan') return nodes.filter(n => n.level === 'program');
    if (level === 'subkegiatan') return nodes.filter(n => n.level === 'kegiatan');
    if (level === 'aktivitas') return nodes.filter(n => n.level === 'subkegiatan');
    return [];
  };

  // Master options based on level
  const getMasterOptions = () => {
    if (level === 'program') return masterPrograms;
    if (level === 'kegiatan') return masterKegiatans;
    if (level === 'subkegiatan') return masterSubkegiatans;
    return [];
  };

  const isSubkegiatanLocked = level === 'subkegiatan' && selectedMasterId !== '';

  const bidangOptions = [
    'Pimpinan',
    'Sekretariat',
    'Pencegahan & Kesiapsiagaan',
    'Kedaruratan & Logistik',
    'Rehabilitasi & Rekonstruksi'
  ];

  // Render tree recursively
  const renderTreeNodes = (parentId = null) => {
    const levelNodes = nodes.filter(n => n.parentId === parentId);
    if (levelNodes.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {levelNodes.map(node => (
          <div key={node.id} className="tree-node">
            <div className="tree-node-header">
              <div className="tree-node-info">
                <h4>
                  <span style={{
                    fontSize: '11px',
                    background: 'var(--primary-orange-light)',
                    color: 'var(--primary-orange)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginRight: '8px',
                    textTransform: 'uppercase'
                  }}>{node.level}</span>
                  {node.text}
                </h4>
                <p className="text-muted" style={{ marginTop: '4px' }}>
                  Indikator: <strong>{node.indikator}</strong> | Target Akhir: <strong>{node.targetAkhir} {node.satuan}</strong>
                  {parseFloat(node.anggaranAkhir) > 0 && (
                    <span> | Total Anggaran: <strong>Rp {parseFloat(node.anggaranAkhir).toLocaleString('id-ID')}</strong></span>
                  )}
                </p>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  {node.bidangPengampu.map(b => (
                    <span key={b} className="badge badge-draft" style={{ fontSize: '9px' }}>{b}</span>
                  ))}
                  {node.bidangPengampu.length > 1 && (
                    <span className="badge badge-score" style={{ fontSize: '9px' }}>
                      Cross-cutting: {node.crossCuttingType === 'split' ? 'Split' : 'Shared'}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => editNode(node)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteNode(node.id)}>Hapus</button>
              </div>
            </div>
            {renderTreeNodes(node.id)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <section>
      <div className="grid-two-columns" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        
        {/* Form Panel */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3>
              <i className="fa-solid fa-folder-tree text-orange"></i>
              {isEditing ? ' Edit Rencana 5 Tahunan' : ' Tambah Rencana 5 Tahunan'}
            </h3>
          </div>
          <div className="panel-body">
            {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
            {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group mb-3">
                <label>Level Cascading</label>
                <select className="select-sim" value={level} onChange={(e) => setLevel(e.target.value)} disabled={isEditing}>
                  <option value="tujuan">1. Tujuan Strategis</option>
                  <option value="sasaran">2. Sasaran Strategis</option>
                  <option value="program">3. Program</option>
                  <option value="kegiatan">4. Kegiatan</option>
                  <option value="subkegiatan">5. Subkegiatan (Wajib)</option>
                  <option value="aktivitas">6. Aktivitas (Opsional)</option>
                </select>
              </div>

              {level !== 'tujuan' && (
                <div className="form-group mb-3">
                  <label style={{ display: 'block', marginBottom: '6px' }}>
                    {level === 'sasaran' && 'Pilih Tujuan Strategis Induk (Parent)'}
                    {level === 'program' && 'Pilih Sasaran Strategis Induk (Parent)'}
                    {level === 'kegiatan' && 'Pilih Program Induk (Parent)'}
                    {level === 'subkegiatan' && 'Pilih Kegiatan Induk (Parent)'}
                    {level === 'aktivitas' && 'Pilih Subkegiatan Induk (Parent)'}
                  </label>
                  <select className="select-sim" value={parentId} onChange={(e) => setParentId(e.target.value)} required>
                    <option value="">-- Pilih Induk --</option>
                    {getParentChoices().map(p => (
                      <option key={p.id} value={p.id}>({p.level.toUpperCase()}) {p.text}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Master Data Dropdown for Program/Kegiatan/Subkegiatan */}
              {['program', 'kegiatan', 'subkegiatan'].includes(level) && (
                <div className="form-group mb-3" style={{ background: 'rgba(255, 107, 0, 0.05)', padding: '10px', borderRadius: '8px', border: '1px dashed var(--primary-orange)' }}>
                  <label>Pilih Dari Kamus Data Master</label>
                  <select className="select-sim" value={selectedMasterId} onChange={(e) => handleMasterChange(e.target.value)}>
                    <option value="">-- Buat Uraian Kustom (Ketik di bawah) --</option>
                    {getMasterOptions().map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.nama}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group mb-3">
                <label>
                  {level === 'tujuan' && 'Uraian / Deskripsi Tujuan Strategis'}
                  {level === 'sasaran' && 'Uraian / Deskripsi Sasaran Strategis'}
                  {level === 'program' && 'Nama Program'}
                  {level === 'kegiatan' && 'Nama Kegiatan'}
                  {level === 'subkegiatan' && 'Nama Subkegiatan'}
                  {level === 'aktivitas' && 'Nama Aktivitas'}
                </label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={selectedMasterId !== ''}
                  required
                  placeholder="Masukkan uraian rencana..."
                />
              </div>

              {level === 'subkegiatan' && (
                <div className="form-group mb-3" style={{ background: 'rgba(255, 107, 0, 0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 107, 0, 0.15)' }}>
                  <label style={{ fontWeight: 600 }}>Sasaran Subkegiatan</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={sasaranSubkegiatan}
                    onChange={(e) => setSasaranSubkegiatan(e.target.value)}
                    placeholder="Masukkan sasaran subkegiatan (tujuan taktis dari subkegiatan ini)..."
                  />
                </div>
              )}

              <div className="form-group mb-3 row" style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label>
                    {level === 'tujuan' && 'Indikator Kinerja Tujuan'}
                    {level === 'sasaran' && 'Indikator Kinerja Sasaran'}
                    {level === 'program' && 'Indikator Kinerja Program'}
                    {level === 'kegiatan' && 'Indikator Kinerja Kegiatan'}
                    {level === 'subkegiatan' && 'Indikator Kinerja Subkegiatan'}
                    {level === 'aktivitas' && 'Indikator Kinerja Aktivitas'}
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={indikator}
                    onChange={(e) => setIndikator(e.target.value)}
                    onBlur={handleIndikatorBlur}
                    disabled={isSubkegiatanLocked}
                    required
                    placeholder="Contoh: Persentase gedung ramah bencana"
                  />
                </div>
                <div style={{ width: '130px' }}>
                  <label>Satuan</label>
                  <input
                    type="text"
                    className="form-control"
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    disabled={isSubkegiatanLocked}
                    required
                    placeholder="dokumen / %"
                  />
                </div>
              </div>



              <div className="form-group mb-3">
                <label>Tipe Target Kinerja</label>
                <select className="select-sim" value={tipeTarget} onChange={(e) => setTipeTarget(e.target.value)}>
                  <option value="Kondisi Akhir Naik">Kondisi Akhir Naik (Semakin tinggi semakin baik)</option>
                  <option value="Kondisi Akhir Menurun">Kondisi Akhir Menurun (Semakin rendah semakin baik)</option>
                  <option value="Akumulatif">Akumulatif (Jumlah penjumlahan dari setiap tahun)</option>
                </select>
              </div>

              {/* Multi Bidang Pengampu */}
              <div className="form-group mb-3">
                <label>Bidang Pengampu (Mendukung Cross-cutting)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(15,23,42,0.4)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  {bidangOptions.map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedBidangs.includes(opt)}
                        onChange={() => handleBidangChange(opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              {/* Cross-cutting options if >1 bidang selected */}
              {selectedBidangs.length > 1 && (
                <div className="form-group mb-3" style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <label style={{ fontWeight: 'bold', color: 'var(--info)' }}>Pengaturan Kolaborasi Cross-cutting</label>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="radio" name="crossCutting" checked={crossCuttingType === 'shared'} onChange={() => setCrossCuttingType('shared')} />
                      Digabung (Shared)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="radio" name="crossCutting" checked={crossCuttingType === 'split'} onChange={() => setCrossCuttingType('split')} />
                      Dipecah (Split)
                    </label>
                  </div>
                  {crossCuttingType === 'split' && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bagi porsi target ke masing-masing bidang pengampu:</p>
                      {selectedBidangs.map(bidang => (
                        <div key={bidang} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '12px' }}>{bidang}</span>
                          <input
                            type="text"
                            className="form-control"
                            style={{ width: '80px', padding: '4px 8px' }}
                            value={splitTargets[bidang] || ''}
                            onChange={(e) => handleSplitTargetChange(bidang, e.target.value)}
                            placeholder="Target"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Targets per year */}
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <i className="fa-solid fa-calendar text-orange"></i> Target & Anggaran Kinerja 5 Tahunan
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
                  {['2025', '2026', '2027', '2028', '2029', '2030'].map(year => {
                    const tState = year === '2025' ? t2025 : year === '2026' ? t2026 : year === '2027' ? t2027 : year === '2028' ? t2028 : year === '2029' ? t2029 : t2030;
                    const setTState = year === '2025' ? setT2025 : year === '2026' ? setT2026 : year === '2027' ? setT2027 : year === '2028' ? setT2028 : year === '2029' ? setT2029 : setT2030;
                    
                    const bState = year === '2025' ? b2025 : year === '2026' ? b2026 : year === '2027' ? b2027 : year === '2028' ? b2028 : year === '2029' ? b2029 : b2030;
                    const setBState = year === '2025' ? setB2025 : year === '2026' ? setB2026 : year === '2027' ? setB2027 : year === '2028' ? setB2028 : year === '2029' ? setB2029 : setB2030;

                    return (
                      <div key={year} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                        <strong style={{ fontSize: '12px', color: 'var(--primary-orange)' }}>Tahun {year}</strong>
                        <div className="form-group mt-1">
                          <label style={{ fontSize: '10px', margin: 0 }}>Target</label>
                          <input type="text" className="form-control" style={{ padding: '4px 8px', fontSize: '11px' }} value={tState} onChange={(e) => setTState(e.target.value)} />
                        </div>
                        <div className="form-group mt-1">
                          <label style={{ fontSize: '10px', margin: 0 }}>Anggaran (Rp)</label>
                          <input type="text" className="form-control" style={{ padding: '4px 8px', fontSize: '11px' }} value={bState} onChange={(e) => setBState(e.target.value)} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.04)', padding: '10px', borderRadius: '8px' }}>
                  <div className="form-group">
                    <label>Target Akhir Periode</label>
                    <input type="text" className="form-control" value={targetAkhir} readOnly style={{ background: 'rgba(0,0,0,0.3)', fontWeight: 'bold' }} />
                  </div>
                  <div className="form-group">
                    <label>Total Anggaran Akhir</label>
                    <input type="text" className="form-control" value={parseFloat(budgetAkhir).toLocaleString('id-ID')} readOnly style={{ background: 'rgba(0,0,0,0.3)', fontWeight: 'bold' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-orange w-full">
                  <i className="fa-solid fa-save"></i> Simpan Rencana 5 Tahunan
                </button>
                {isEditing && (
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>Batal</button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Tree Panel */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3><i className="fa-solid fa-folder-tree text-orange"></i> Struktur Rencana Strategis 5 Tahunan</h3>
          </div>
          <div className="panel-body">
            <div className="cascading-tree-editor">
              {nodes.filter(n => n.parentId === null).length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Belum ada data perencanaan 5 tahunan.</div>
              ) : (
                renderTreeNodes(null)
              )}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
