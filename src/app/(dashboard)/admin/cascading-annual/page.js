'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function AdminCascadingAnnualPage() {
  const { fetchWithAuth, activeRole, activeBidang } = useSimulation();

  const [nodes, setNodes] = useState([]);
  const [fiveYearNodes, setFiveYearNodes] = useState([]);
  const [masterPrograms, setMasterPrograms] = useState([]);
  const [masterKegiatans, setMasterKegiatans] = useState([]);
  const [masterSubkegiatans, setMasterSubkegiatans] = useState([]);

  // Form states
  const [formId, setFormId] = useState('');
  const [level, setLevel] = useState('tujuan');
  const [parentId, setParentId] = useState('');
  const [text, setText] = useState('');
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [indikator, setIndikator] = useState('');
  const [satuan, setSatuan] = useState('');
  const [tipeTarget, setTipeTarget] = useState('Kondisi Akhir Naik');
  const [selectedBidangs, setSelectedBidangs] = useState([]);
  const [crossCuttingType, setCrossCuttingType] = useState('shared');
  const [splitTargets, setSplitTargets] = useState({});
  const [target, setTarget] = useState('0');
  const [tahun, setTahun] = useState(2026);
  const [anggaran, setAnggaran] = useState(0);

  // Operational definition and sub-activity fields
  const [sasaranSubkegiatan, setSasaranSubkegiatan] = useState('');
  const [definisiOperasional, setDefinisiOperasional] = useState('');
  const [metodePenghitungan, setMetodePenghitungan] = useState('Jumlah'); // Jumlah, Persentase, Lainnya
  const [variabelJumlah, setVariabelJumlah] = useState('');
  const [variabelPembilang, setVariabelPembilang] = useState('');
  const [variabelPenyebut, setVariabelPenyebut] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const levelLabels = {
    tujuan: '1. Tujuan Strategis',
    indikator_tujuan: '2. Indikator Tujuan',
    sasaran: '3. Sasaran Strategis',
    indikator_sasaran: '4. Indikator Sasaran',
    sasaran_program: '5. Sasaran Program',
    program: '6. Program (Uraian & Indikator)',
    sasaran_kegiatan: '7. Sasaran Kegiatan',
    kegiatan: '8. Kegiatan (Uraian & Indikator)',
    sasaran_subkegiatan: '9. Sasaran Subkegiatan',
    subkegiatan: '10. Subkegiatan (Uraian, Indikator & Anggaran)',
    aktivitas: '11. Aktivitas (Uraian & Indikator)'
  };

  const levelColors = {
    tujuan: '#1e3a8a',
    indikator_tujuan: '#3b82f6',
    sasaran: '#065f46',
    indikator_sasaran: '#10b981',
    sasaran_program: '#78350f',
    program: '#d97706',
    sasaran_kegiatan: '#581c87',
    kegiatan: '#8b5cf6',
    sasaran_subkegiatan: '#831843',
    subkegiatan: '#ec4899',
    aktivitas: '#64748b'
  };

  const isTextOnlyLevel = (lvl) => {
    return ['tujuan', 'sasaran', 'sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan'].includes(lvl);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
  };

  const calculateNodeBudget = (nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return 0;
    
    if (node.level === 'subkegiatan') {
      return node.anggaran || 0;
    }
    
    const children = nodes.filter(n => n.parentId === nodeId);
    return children.reduce((sum, child) => sum + calculateNodeBudget(child.id), 0);
  };

  const loadData = async () => {
    try {
      const res = await fetch(`/api/renja/${tahun}`);
      if (res.ok) setNodes(await res.json());

      const fRes = await fetch('/api/cascading5years');
      if (fRes.ok) setFiveYearNodes(await fRes.json());

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
  }, [tahun]);

  useEffect(() => {
    if (!isEditing) {
      setParentId('');
      setText('');
      setSelectedMasterId('');
      setIndikator('');
      setSatuan('');
      setAnggaran(0);
    }
  }, [level, isEditing]);

  useEffect(() => {
    if (!isEditing && parentId) {
      const parentNode = nodes.find(n => n.id === parentId);
      if (parentNode && parentNode.bidangPengampu) {
        setSelectedBidangs(parentNode.bidangPengampu);
      }
    }
  }, [parentId, isEditing, nodes]);

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
        setIndikator(item.indikator);
        setSatuan(item.satuan);
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

    const isTextOnly = isTextOnlyLevel(level);

    const isIndicatorOnly = ['indikator_tujuan', 'indikator_sasaran'].includes(level);

    const payload = {
      id: formId,
      level,
      text: isIndicatorOnly ? indikator : text,
      indikator: isTextOnly ? '-' : indikator,
      satuan: isTextOnly ? '-' : satuan,
      tipeTarget: isTextOnly ? 'Kondisi Akhir Naik' : tipeTarget,
      parentId: level === 'tujuan' ? null : parentId,
      bidangPengampu: selectedBidangs,
      crossCuttingType,
      splitTargets,
      target: isTextOnly ? '0' : target,
      tahun,
      requesterRole: activeRole,
      requesterBidang: activeBidang,
      sasaranSubkegiatan: level === 'subkegiatan' ? sasaranSubkegiatan : '',
      definisiOperasional,
      metodePenghitungan,
      variabelJumlah,
      variabelPembilang,
      variabelPenyebut,
      masterId: ['program', 'kegiatan', 'subkegiatan'].includes(level) ? (selectedMasterId || null) : null,
      anggaran: level === 'subkegiatan' ? (Number(anggaran) || 0) : 0
    };

    try {
      const res = await fetchWithAuth('/api/cascading', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSuccess('Item cascading tahunan berhasil disimpan.');
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
    setTarget(node.target || '0');
    setSelectedMasterId(node.masterId || '');
    setAnggaran(node.anggaran || 0);

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
      const res = await fetchWithAuth(`/api/cascading/${id}`, {
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
    setTarget('0');
    setAnggaran(0);

    setSasaranSubkegiatan('');
    setDefinisiOperasional('');
    setMetodePenghitungan('Jumlah');
    setVariabelJumlah('');
    setVariabelPembilang('');
    setVariabelPenyebut('');
  };

  const getParentChoices = () => {
    if (level === 'indikator_tujuan') return nodes.filter(n => n.level === 'tujuan');
    if (level === 'sasaran') return nodes.filter(n => n.level === 'tujuan');
    if (level === 'indikator_sasaran') return nodes.filter(n => n.level === 'sasaran');
    if (level === 'sasaran_program') return nodes.filter(n => n.level === 'sasaran');
    if (level === 'program') return nodes.filter(n => n.level === 'sasaran_program');
    if (level === 'sasaran_kegiatan') return nodes.filter(n => n.level === 'sasaran_program');
    if (level === 'kegiatan') return nodes.filter(n => n.level === 'sasaran_kegiatan');
    if (level === 'sasaran_subkegiatan') return nodes.filter(n => n.level === 'sasaran_kegiatan');
    if (level === 'subkegiatan') return nodes.filter(n => n.level === 'sasaran_subkegiatan');
    if (level === 'aktivitas') return nodes.filter(n => n.level === 'sasaran_subkegiatan');
    return [];
  };

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

  const hasAccess = activeRole === 'admin' || activeRole === 'perencana';

  if (!hasAccess) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa-solid fa-ban text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Akses Ditolak</h2>
        <p className="text-muted" style={{ marginTop: '8px' }}>Hanya Administrator atau Admin Perencana yang diperbolehkan mengelola data cascading tahunan.</p>
      </div>
    );
  }

  const renderTreeNodes = (parentId = null) => {
    const levelNodes = nodes.filter(n => n.parentId === parentId);
    if (levelNodes.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: parentId ? '16px' : '0', borderLeft: parentId ? '1px dashed var(--glass-border)' : 'none' }}>
        {levelNodes.map(node => (
          <div key={node.id} className="tree-node" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div className="tree-node-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div className="tree-node-info">
                <h4>
                  <span style={{
                    fontSize: '10px',
                    background: levelColors[node.level] || 'var(--primary-orange)',
                    color: ['indikator_program', 'indikator_subkegiatan'].includes(node.level) ? '#000' : '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginRight: '8px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>{levelLabels[node.level] || node.level}</span>
                  {node.text}
                </h4>
                <p className="text-muted" style={{ marginTop: '6px', fontSize: '12px' }}>
                  {['indikator_tujuan', 'indikator_sasaran'].includes(node.level) && (
                    <>
                      Target Tahunan: <strong>{node.target} {node.satuan}</strong>
                    </>
                  )}
                  {['program', 'kegiatan', 'subkegiatan', 'aktivitas'].includes(node.level) && (
                    <>
                      Indikator: <strong>{node.indikator}</strong> | Target Tahunan: <strong>{node.target} {node.satuan}</strong>
                    </>
                  )}
                  {node.level === 'subkegiatan' && (
                    <span style={{ marginLeft: '12px', color: 'var(--success)' }}>
                      Anggaran: <strong>{formatCurrency(node.anggaran || 0)}</strong>
                    </span>
                  )}
                  {['tujuan', 'sasaran', 'sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan'].includes(node.level) && (
                    <span style={{ marginLeft: '12px', color: 'var(--info)' }}>
                      Anggaran Akumulasi: <strong>{formatCurrency(calculateNodeBudget(node.id))}</strong>
                    </span>
                  )}
                  {node.target5Tahun && (
                    <span style={{ marginLeft: '12px', color: 'var(--info)' }}>
                      <i className="fa-solid fa-layer-group"></i> Target RPJMD 5-Tahun: <strong>{node.target5Tahun} {node.satuan}</strong>
                    </span>
                  )}
                </p>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  {node.bidangPengampu && node.bidangPengampu.map(b => (
                    <span key={b} className="badge badge-draft" style={{ fontSize: '9px' }}>{b}</span>
                  ))}
                  {node.bidangPengampu && node.bidangPengampu.length > 1 && (
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
      <div className="glass-panel print-exclude" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <label style={{ fontWeight: 'bold' }}>Tahun Rencana (Renja):</label>
        <select className="select-sim" style={{ width: '120px' }} value={tahun} onChange={(e) => setTahun(parseInt(e.target.value))}>
          <option value="2025">2025</option>
          <option value="2026">2026</option>
          <option value="2027">2027</option>
          <option value="2028">2028</option>
          <option value="2029">2029</option>
          <option value="2030">2030</option>
        </select>
      </div>

      <div className="grid-two-columns" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        {/* Form Panel */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3>
              <i className="fa-solid fa-diagram-project text-orange"></i>
              {isEditing ? ` Edit Renja ${tahun}` : ` Tambah Renja ${tahun}`}
            </h3>
          </div>
          <div className="panel-body">
            {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
            {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group mb-3">
                <label>Level Cascading</label>
                <select className="select-sim" value={level} onChange={(e) => setLevel(e.target.value)} disabled={isEditing}>
                  {Object.entries(levelLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {level !== 'tujuan' && (
                <div className="form-group mb-3">
                  <label style={{ display: 'block', marginBottom: '6px' }}>
                    Pilih Node Induk (Parent)
                  </label>
                  <select className="select-sim" value={parentId} onChange={(e) => setParentId(e.target.value)} required>
                    <option value="">-- Pilih Induk --</option>
                    {getParentChoices().map(p => (
                      <option key={p.id} value={p.id}>({levelLabels[p.level] || p.level}) {p.text}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Master Data Dropdown */}
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

              {!['indikator_tujuan', 'indikator_sasaran'].includes(level) && (
                <div className="form-group mb-3">
                  <label>
                    Uraian / Deskripsi Nama Node ({levelLabels[level] || level})
                  </label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={selectedMasterId !== ''}
                    required
                    placeholder="Ketik uraian rencana..."
                  />
                </div>
              )}

              {level === 'subkegiatan' && (
                <>
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

                  <div className="form-group mb-3" style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '10px', borderRadius: '8px', border: '1px dashed var(--success)' }}>
                    <label style={{ fontWeight: 600, color: 'var(--success)' }}>Anggaran Subkegiatan (Rupiah)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={anggaran}
                      onChange={(e) => setAnggaran(e.target.value)}
                      required
                      placeholder="Contoh: 150000000"
                    />
                  </div>
                </>
              )}

              {!isTextOnlyLevel(level) && (
                <>
                  <div className="form-group mb-3 row" style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label>
                        Indikator Kinerja ({levelLabels[level] || level})
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={indikator}
                        onChange={(e) => setIndikator(e.target.value)}
                        onBlur={handleIndikatorBlur}
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
                        required
                        placeholder="dokumen / %"
                      />
                    </div>
                  </div>

                  <div className="form-group mb-3 row" style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label>Target Kinerja Tahunan</label>
                      <input
                        type="text"
                        className="form-control"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        required
                        placeholder="Target untuk tahun ini"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>Tipe Target</label>
                      <select className="select-sim" value={tipeTarget} onChange={(e) => setTipeTarget(e.target.value)}>
                        <option value="Kondisi Akhir Naik">Kondisi Akhir Naik</option>
                        <option value="Kondisi Akhir Menurun">Kondisi Akhir Menurun</option>
                        <option value="Akumulatif">Akumulatif</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

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

              {/* Cross-cutting config if >1 bidang selected OR level is kegiatan/subkegiatan/aktivitas */}
              {(selectedBidangs.length > 1 || ['kegiatan', 'subkegiatan', 'aktivitas'].includes(level)) && (
                <div className="form-group mb-3" style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <label style={{ fontWeight: 'bold', color: 'var(--info)' }}>Pengaturan Kolaborasi (Cross-cutting / Multi-pengampu)</label>
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
                  {crossCuttingType === 'split' && selectedBidangs.length > 1 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bagi porsi target tahunan ke masing-masing bidang pengampu:</p>
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

              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-orange w-full">
                  <i className="fa-solid fa-save"></i> Simpan Target Renja {tahun}
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
            <h3><i className="fa-solid fa-network-wired text-orange"></i> Struktur Rencana Tahunan (Renja) {tahun}</h3>
          </div>
          <div className="panel-body">
            <div className="cascading-tree-editor">
              {nodes.filter(n => n.parentId === null).length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Belum ada data perencanaan tahun {tahun}.</div>
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
