'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef } from 'react';
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
  const [sasaran, setSasaran] = useState('');
  const [nomenklatur, setNomenklatur] = useState('');
  const [selectedMasterId, setSelectedMasterId] = useState(''); 
  const [selectedBidangs, setSelectedBidangs] = useState([]);
  
  // Cross-cutting states
  const [crossCuttingType, setCrossCuttingType] = useState('shared');
  const [splitTargets, setSplitTargets] = useState({}); 

  // Budget (Anggaran) inputs for subkegiatan
  const [b2025, setB2025] = useState('0');
  const [b2026, setB2026] = useState('0');
  const [b2027, setB2027] = useState('0');
  const [b2028, setB2028] = useState('0');
  const [b2029, setB2029] = useState('0');
  const [b2030, setB2030] = useState('0');
  const [budgetAkhir, setBudgetAkhir] = useState('0');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [printMode, setPrintMode] = useState('tree'); 
  const [viewMode, setViewMode] = useState('list'); // list or orgchart

  // Indicator Management Modal states
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [selectedNodeForIndicators, setSelectedNodeForIndicators] = useState(null);
  const [tempIndicators, setTempIndicators] = useState([]);

  // Operational Definition Modal states
  const [showOpDefModal, setShowOpDefModal] = useState(false);
  const [activeIndicatorIndex, setActiveIndicatorIndex] = useState(-1);
  const [opDefVal, setOpDefVal] = useState('');
  const [metodeVal, setMetodeVal] = useState('Jumlah');
  const [varJumlahVal, setVarJumlahVal] = useState('');
  const [varPembilangVal, setVarPembilangVal] = useState('');
  const [varPenyebutVal, setVarPenyebutVal] = useState('');

  // Alert Modal states
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('info'); // info, success, error

  const levelLabels = {
    tujuan: '1. Tujuan Strategis',
    sasaran: '2. Sasaran Strategis',
    sasaran_program: '3. Sasaran Program',
    sasaran_kegiatan: '4. Sasaran Kegiatan',
    sasaran_subkegiatan: '5. Sasaran Subkegiatan',
    sasaran_aktivitas: '6. Sasaran Aktivitas'
  };

  const levelColors = {
    tujuan: '#1e3a8a',
    sasaran: '#065f46',
    sasaran_program: '#d97706',
    sasaran_kegiatan: '#8b5cf6',
    sasaran_subkegiatan: '#ec4899',
    sasaran_aktivitas: '#64748b'
  };

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

  // Auto-close alert after 10 seconds
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => {
        setAlertMessage('');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  const showAlert = (msg, type = 'info') => {
    setAlertMessage(msg);
    setAlertType(type);
  };

  // Auto calculate Budget Akhir (always the sum of 2025-2030 budgets)
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showFormModal || showDeleteConfirmModal || showIndicatorModal || showOpDefModal) return;

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
  }, [showFormModal, showDeleteConfirmModal, showIndicatorModal, showOpDefModal]);

  // Handle level switch: reset fields
  useEffect(() => {
    if (!isEditing) {
      setParentId('');
      setText('');
      setSasaran('');
      setNomenklatur('');
      setSelectedMasterId('');
    }
  }, [level, isEditing]);

  // Inherit bidang from parent automatically when adding
  useEffect(() => {
    if (!isEditing && parentId) {
      const parentNode = nodes.find(n => n.id === parentId);
      if (parentNode && parentNode.bidangPengampu) {
        setSelectedBidangs(parentNode.bidangPengampu);
      }
    }
  }, [parentId, isEditing, nodes]);

  // Handle Master dropdown selection change
  const handleMasterChange = (masterId) => {
    setSelectedMasterId(masterId);
    if (!masterId) {
      setNomenklatur('');
      if (level === 'sasaran_subkegiatan') {
        setText('');
        setSasaran('');
      }
      return;
    }

    if (level === 'sasaran_program') {
      const item = masterPrograms.find(p => p.id === masterId);
      if (item) setNomenklatur(item.nama);
    } else if (level === 'sasaran_kegiatan') {
      const item = masterKegiatans.find(k => k.id === masterId);
      if (item) setNomenklatur(item.nama);
    } else if (level === 'sasaran_subkegiatan') {
      const item = masterSubkegiatans.find(s => s.id === masterId);
      if (item) {
        setNomenklatur(item.nama);
        setText(item.kinerja || item.nama);
        setSasaran(item.kinerja || item.nama);
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
    if (e && e.preventDefault) e.preventDefault();
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

    if (['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan'].includes(level) && !selectedMasterId) {
      setError('Pilih nomenklatur master data untuk level ini.');
      return;
    }

    // Prepare node indicators. Subkegiatan takes single indicator from master.
    let nodeIndicators = [];
    if (isEditing) {
      const existingNode = nodes.find(n => n.id === formId);
      nodeIndicators = existingNode ? (existingNode.indicators || []) : [];
    }

    if (level === 'sasaran_subkegiatan') {
      const item = masterSubkegiatans.find(s => s.id === selectedMasterId);
      if (item) {
        nodeIndicators = [{
          id: `ind_master_${selectedMasterId}`,
          indikator: item.indikator || '-',
          satuan: item.satuan || '-',
          tipeTarget: 'Kondisi Akhir Naik',
          target2025: '0',
          target2026: '0',
          target2027: '0',
          target2028: '0',
          target2029: '0',
          target2030: '0',
          targetAkhir: '0'
        }];
      }
    }

    const payload = {
      id: formId,
      level,
      text,
      indikator: '-',
      satuan: '-',
      tipeTarget: 'Kondisi Akhir Naik',
      parentId: level === 'tujuan' ? null : parentId,
      bidangPengampu: selectedBidangs,
      crossCuttingType,
      splitTargets,
      anggaran2025: level === 'sasaran_subkegiatan' ? b2025 : '0',
      anggaran2026: level === 'sasaran_subkegiatan' ? b2026 : '0',
      anggaran2027: level === 'sasaran_subkegiatan' ? b2027 : '0',
      anggaran2028: level === 'sasaran_subkegiatan' ? b2028 : '0',
      anggaran2029: level === 'sasaran_subkegiatan' ? b2029 : '0',
      anggaran2030: level === 'sasaran_subkegiatan' ? b2030 : '0',
      anggaranAkhir: level === 'sasaran_subkegiatan' ? budgetAkhir : '0',
      requesterRole: activeRole,
      requesterBidang: activeBidang,
      sasaran: level === 'sasaran_subkegiatan' ? sasaran : text,
      nomenklatur,
      indicators: nodeIndicators,
      masterId: selectedMasterId || null
    };

    try {
      const res = await fetchWithAuth('/api/cascading5years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSuccess('Item Indikator Renstra berhasil disimpan.');
        resetForm();
        loadData();
        if (refreshMetadata) refreshMetadata();
        setShowFormModal(false);
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
    setSasaran(node.sasaran || '');
    setNomenklatur(node.nomenklatur || '');
    setSelectedMasterId(node.masterId || '');
    setSelectedBidangs(node.bidangPengampu || []);
    setCrossCuttingType(node.crossCuttingType || 'shared');
    setSplitTargets(node.splitTargets || {});
    
    setB2025(node.anggaran2025 || '0');
    setB2026(node.anggaran2026 || '0');
    setB2027(node.anggaran2027 || '0');
    setB2028(node.anggaran2028 || '0');
    setB2029(node.anggaran2029 || '0');
    setB2030(node.anggaran2030 || '0');
  };

  const resetForm = () => {
    setIsEditing(false);
    setFormId('');
    setLevel('tujuan');
    setParentId('');
    setText('');
    setSasaran('');
    setNomenklatur('');
    setSelectedMasterId('');
    setSelectedBidangs([]);
    setCrossCuttingType('shared');
    setSplitTargets({});
    
    setB2025('0');
    setB2026('0');
    setB2027('0');
    setB2028('0');
    setB2029('0');
    setB2030('0');
  };

  const getValidChildLevels = (parentLevel) => {
    if (!parentLevel) return ['tujuan'];
    if (parentLevel === 'tujuan') return ['sasaran'];
    if (parentLevel === 'sasaran') return ['sasaran_program'];
    if (parentLevel === 'sasaran_program') return ['sasaran_kegiatan'];
    if (parentLevel === 'sasaran_kegiatan') return ['sasaran_subkegiatan'];
    if (parentLevel === 'sasaran_subkegiatan') return ['sasaran_aktivitas'];
    return [];
  };

  const getMasterOptions = () => {
    if (level === 'sasaran_program') {
      return masterPrograms;
    }
    if (level === 'sasaran_kegiatan') {
      const parentNode = nodes.find(n => n.id === parentId);
      const parentProgMasterId = parentNode ? parentNode.masterId : '';
      return masterKegiatans.filter(k => !parentProgMasterId || k.programId === parentProgMasterId);
    }
    if (level === 'sasaran_subkegiatan') {
      const parentNode = nodes.find(n => n.id === parentId);
      const parentKegMasterId = parentNode ? parentNode.masterId : '';
      
      // Filter out subkegiatans already used globally (except the one current editing)
      const usedMasterIds = nodes
        .filter(n => n.level === 'sasaran_subkegiatan' && n.id !== formId)
        .map(n => n.masterId);

      return masterSubkegiatans.filter(s => 
        (!parentKegMasterId || s.kegiatanId === parentKegMasterId) && 
        !usedMasterIds.includes(s.id)
      );
    }
    return [];
  };

  const bidangOptions = [
    'Pimpinan',
    'Sekretariat',
    'Pencegahan & Kesiapsiagaan',
    'Kedaruratan & Logistik',
    'Rehabilitasi & Rekonstruksi'
  ];

  const getChildButtonLabel = (lvl) => {
    if (lvl === 'sasaran') return 'Tambah Sasaran';
    if (lvl === 'sasaran_program') return 'Tambah Sasaran Program';
    if (lvl === 'sasaran_kegiatan') return 'Tambah Sasaran Kegiatan';
    if (lvl === 'sasaran_subkegiatan') return 'Tambah Sasaran Subkegiatan';
    if (lvl === 'sasaran_aktivitas') return 'Tambah Sasaran Aktivitas';
    return 'Tambah';
  };

  const handlePrintTree = () => {
    setPrintMode('tree');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintCascading = () => {
    setPrintMode('cascading');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintOrgChart = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showAlert('Gagal membuka jendela cetak. Mohon periksa pemblokir pop-up browser Anda.', 'error');
      return;
    }

    const buildHTMLString = (parentId = null) => {
      const levelNodes = nodes.filter(n => n.parentId === parentId);
      if (levelNodes.length === 0) return '';

      let html = '<ul>';
      levelNodes.forEach(node => {
        const badgeColor = levelColors[node.level] || '#666';
        const labelText = levelLabels[node.level]?.substring(3) || node.level;
        const titleText = node.level === 'tujuan' || node.level === 'sasaran' ? node.text : (node.sasaran || node.text);
        
        let indicatorsHtml = '';
        if (node.indicators && node.indicators.length > 0) {
          indicatorsHtml = '<div style="margin-top: 6px; border-top: 1px dashed #cbd5e1; padding-top: 4px; text-align: left;">';
          node.indicators.forEach(ind => {
            indicatorsHtml += `
              <div style="font-size: 8px; color: #475569; line-height: 1.2; margin-bottom: 2px;">
                • ${ind.indikator} (${ind.targetAkhir} ${ind.satuan})
              </div>
            `;
          });
          indicatorsHtml += '</div>';
        }

        let nomenklaturHtml = '';
        if (node.nomenklatur) {
          nomenklaturHtml = `
            <div style="font-size: 9px; font-style: italic; color: #64748b; margin-top: 4px; word-break: break-word; border-top: 1px solid #e2e8f0; padding-top: 4px;">
              ${node.nomenklatur}
            </div>
          `;
        }

        html += `
          <li>
            <div class="org-node-box" style="border: 2px solid ${badgeColor};">
              <div class="org-level-badge" style="background: ${badgeColor};">
                ${labelText}
              </div>
              <div class="org-node-title">
                ${titleText}
              </div>
              ${nomenklaturHtml}
              ${indicatorsHtml}
            </div>
            ${buildHTMLString(node.id)}
          </li>
        `;
      });
      html += '</ul>';
      return html;
    };

    const treeHtml = buildHTMLString(null);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Diagram Pohon Kinerja (Renstra) - BPBD Boyolali</title>
        <meta charset="utf-8">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <style>
          body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: white;
            color: black;
            margin: 0;
            padding: 30px;
          }
          .kop-surat {
            text-align: center;
            border-bottom: 3px double black;
            padding-bottom: 12px;
            margin-bottom: 24px;
          }
          .kop-surat h3 {
            margin: 0;
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .kop-surat h2 {
            margin: 4px 0;
            font-size: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .kop-surat p {
            margin: 0;
            font-size: 11px;
            color: #475569;
          }
          .title-doc {
            text-align: center;
            text-decoration: underline;
            font-size: 16px;
            font-weight: bold;
            margin: 0 0 4px 0;
          }
          .subtitle-doc {
            text-align: center;
            font-size: 12px;
            margin: 0 0 24px 0;
            color: #475569;
          }
          .org-chart-wrapper {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            width: 100%;
            overflow-x: auto;
            padding-bottom: 40px;
          }
          .org-chart {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .org-chart ul {
            padding-top: 24px;
            position: relative;
            display: flex;
            justify-content: center;
            margin: 0;
            padding-left: 0;
          }
          .org-chart li {
            text-align: center;
            list-style-type: none;
            position: relative;
            padding: 24px 8px 0 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .org-chart li::before, .org-chart li::after {
            content: '';
            position: absolute;
            top: 0;
            right: 50%;
            border-top: 2px solid #64748b;
            width: 50%;
            height: 24px;
          }
          .org-chart li::after {
            right: auto;
            left: 50%;
            border-left: 2px solid #64748b;
          }
          .org-chart li:only-child::after, .org-chart li:only-child::before {
            display: none;
          }
          .org-chart li:only-child {
            padding-top: 0;
          }
          .org-chart li:first-child::before, .org-chart li:last-child::after {
            border: 0 none;
          }
          .org-chart li:last-child::before {
            border-right: 2px solid #64748b;
            border-radius: 0 8px 0 0;
          }
          .org-chart li:first-child::after {
            border-radius: 8px 0 0 0;
          }
          .org-chart ul ul::before {
            content: '';
            position: absolute;
            top: 0;
            left: 50%;
            border-left: 2px solid #64748b;
            width: 0;
            height: 24px;
          }
          .org-node-box {
            background: white;
            color: black;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.08);
            min-width: 160px;
            max-width: 240px;
            text-align: center;
            display: inline-block;
            position: relative;
            transition: all 0.2s;
          }
          .org-level-badge {
            font-size: 8px;
            font-weight: bold;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            margin-bottom: 8px;
            text-transform: uppercase;
            display: inline-block;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .org-node-title {
            font-size: 11px;
            font-weight: 600;
            line-height: 1.4;
            word-break: break-word;
          }
          
          .floating-actions {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            gap: 12px;
          }
          .btn-print {
            background: #f97316;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
            transition: all 0.2s;
          }
          .btn-print:hover {
            background: #ea580c;
            transform: translateY(-1px);
          }
          .btn-png {
            background: #10b981;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            transition: all 0.2s;
          }
          .btn-png:hover {
            background: #059669;
            transform: translateY(-1px);
          }
          .btn-png:disabled {
            background: #a7f3d0;
            cursor: not-allowed;
          }
          .btn-pdf {
            background: #ef4444;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            transition: all 0.2s;
          }
          .btn-pdf:hover {
            background: #dc2626;
            transform: translateY(-1px);
          }
          .btn-pdf:disabled {
            background: #fca5a5;
            cursor: not-allowed;
          }
          .btn-close {
            background: #64748b;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(100, 116, 139, 0.3);
            transition: all 0.2s;
          }
          .btn-close:hover {
            background: #475569;
            transform: translateY(-1px);
          }
          
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              padding: 0;
            }
            @page {
              size: landscape;
              margin: 10mm;
            }
            .org-chart-wrapper {
              overflow: visible;
            }
          }
        </style>
      </head>
      <body>
        <div class="floating-actions no-print">
          <button class="btn-print" onclick="window.print()">Cetak Halaman Ini</button>
          <button class="btn-png" onclick="downloadPNG()">Unduh PNG (Gambar)</button>
          <button class="btn-pdf" onclick="downloadPDF()">Ekspor PDF (1 Halaman Penuh)</button>
          <button class="btn-close" onclick="window.close()">Tutup Jendela</button>
        </div>

        <div class="kop-surat">
          <h3>Pemerintah Kabupaten Boyolali</h3>
          <h2>Badan Penanggulangan Bencana Daerah (BPBD)</h2>
          <p>Kompleks Perkantoran Terpadu Kabupaten Boyolali, Jawa Tengah</p>
        </div>

        <h3 class="title-doc">DIAGRAM POHON KINERJA (RENSTRA)</h3>
        <p class="subtitle-doc">PERIODE 2025 - 2030</p>

        <div class="org-chart-wrapper">
          <div class="org-chart">
            ${treeHtml}
          </div>
        </div>

        <script>
          function downloadPNG() {
            const element = document.querySelector('.org-chart');
            if (!element) return;
            
            const btnPng = document.querySelector('.btn-png');
            const originalText = btnPng.innerText;
            btnPng.innerText = 'Memproses...';
            btnPng.disabled = true;

            html2canvas(element, {
              backgroundColor: '#ffffff',
              scale: 2,
              logging: false,
              useCORS: true
            }).then(canvas => {
              const link = document.createElement('a');
              link.download = 'pohon-kinerja-renstra.png';
              link.href = canvas.toDataURL('image/png');
              link.click();
              
              btnPng.innerText = originalText;
              btnPng.disabled = false;
            }).catch(err => {
              console.error(err);
              alert('Gagal mengunduh gambar');
              btnPng.innerText = originalText;
              btnPng.disabled = false;
            });
          }

          function downloadPDF() {
            const element = document.querySelector('.org-chart');
            if (!element) return;

            const btnPdf = document.querySelector('.btn-pdf');
            const originalText = btnPdf.innerText;
            btnPdf.innerText = 'Memproses...';
            btnPdf.disabled = true;

            html2canvas(element, {
              backgroundColor: '#ffffff',
              scale: 2,
              logging: false,
              useCORS: true
            }).then(canvas => {
              const imgData = canvas.toDataURL('image/png');
              const { jsPDF } = window.jspdf;
              
              const imgWidth = canvas.width / 2;
              const imgHeight = canvas.height / 2;
              
              const pdf = new jsPDF({
                orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [imgWidth, imgHeight]
              });
              
              pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
              pdf.save('pohon-kinerja-renstra.pdf');

              btnPdf.innerText = originalText;
              btnPdf.disabled = false;
            }).catch(err => {
              console.error(err);
              alert('Gagal mengekspor PDF');
              btnPdf.innerText = originalText;
              btnPdf.disabled = false;
            });
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getFlatPaths5Y = () => {
    const paths = [];
    
    const traverse = (node, currentPath) => {
      const children = nodes.filter(n => n.parentId === node.id);
      
      const newPath = { ...currentPath };
      newPath[node.level] = node;
      
      if (children.length === 0) {
        paths.push(newPath);
        return;
      }
      
      children.forEach(child => {
        traverse(child, newPath);
      });
    };
    
    const tujuans = nodes.filter(n => n.parentId === null && n.level === 'tujuan');
    tujuans.forEach(t => {
      traverse(t, {});
    });
    
    return paths;
  };

  const openAddModal = (parentNode = null, targetLevel = null) => {
    resetForm();
    if (parentNode) {
      setParentId(parentNode.id);
      if (targetLevel) {
        setLevel(targetLevel);
      } else {
        const childLevels = getValidChildLevels(parentNode.level);
        setLevel(childLevels[0] || 'tujuan');
      }
      setSelectedBidangs(parentNode.bidangPengampu || []);
    } else {
      setParentId('');
      setLevel('tujuan');
      setSelectedBidangs([]);
    }
    setShowFormModal(true);
  };

  const openEditModal = (node) => {
    editNode(node);
    setShowFormModal(true);
  };

  const openDeleteConfirmModal = (node) => {
    setNodeToDelete(node);
    setDeleteConfirmInput('');
    setShowDeleteConfirmModal(true);
  };

  const executeDelete = async () => {
    if (!nodeToDelete) return;
    setError('');
    setSuccess('');
    setShowDeleteConfirmModal(false);
    try {
      const res = await fetchWithAuth(`/api/cascading5years/${nodeToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSuccess('Node beserta turunannya berhasil dihapus.');
        loadData();
        if (refreshMetadata) refreshMetadata();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menghapus node.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    } finally {
      setNodeToDelete(null);
    }
  };

  const countDescendants = (nodeId) => {
    let count = 0;
    const children = nodes.filter(n => n.parentId === nodeId);
    count += children.length;
    children.forEach(c => {
      count += countDescendants(c.id);
    });
    return count;
  };

  const calculateNodeBudget5Y = (nodeId, year = 'Akhir') => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return 0;

    if (node.level === 'sasaran_subkegiatan' || node.level === 'subkegiatan') {
      if (year === 'Akhir') return parseFloat(node.anggaranAkhir) || 0;
      return parseFloat(node[`anggaran${year}`]) || 0;
    }

    const children = nodes.filter(n => n.parentId === nodeId);
    return children.reduce((sum, child) => sum + calculateNodeBudget5Y(child.id, year), 0);
  };

  const openIndicatorModal = (node) => {
    setSelectedNodeForIndicators(node);
    setTempIndicators(node.indicators || []);
    setShowIndicatorModal(true);
  };

  const addTempIndicator = () => {
    setTempIndicators([
      ...tempIndicators,
      {
        id: `ind_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        indikator: '',
        satuan: '',
        tipeTarget: 'Kondisi Akhir Naik',
        target2025: '0',
        target2026: '0',
        target2027: '0',
        target2028: '0',
        target2029: '0',
        target2030: '0',
        targetAkhir: '0'
      }
    ]);
  };

  const updateTempIndicator = (index, field, value) => {
    const updated = [...tempIndicators];
    updated[index][field] = value;
    
    // Auto calculate targetAkhir
    const ind = updated[index];
    const val2025 = parseFloat(ind.target2025) || 0;
    const val2026 = parseFloat(ind.target2026) || 0;
    const val2027 = parseFloat(ind.target2027) || 0;
    const val2028 = parseFloat(ind.target2028) || 0;
    const val2029 = parseFloat(ind.target2029) || 0;
    const val2030 = parseFloat(ind.target2030) || 0;
    
    if (ind.tipeTarget === 'Akumulatif') {
      ind.targetAkhir = (val2025 + val2026 + val2027 + val2028 + val2029 + val2030).toString();
    } else {
      ind.targetAkhir = ind.target2030 || '0';
    }
    
    setTempIndicators(updated);
  };

  const removeTempIndicator = (index) => {
    setTempIndicators(tempIndicators.filter((_, i) => i !== index));
  };

  const openOpDefModal = (index) => {
    setActiveIndicatorIndex(index);
    const ind = tempIndicators[index];
    if (ind) {
      setOpDefVal(ind.definisiOperasional || '');
      setMetodeVal(ind.metodePenghitungan || 'Jumlah');
      setVarJumlahVal(ind.variabelJumlah || '');
      setVarPembilangVal(ind.variabelPembilang || '');
      setVarPenyebutVal(ind.variabelPenyebut || '');
    }
    setShowOpDefModal(true);
  };

  const handleSaveOpDef = () => {
    if (activeIndicatorIndex === -1) return;
    const updated = [...tempIndicators];
    updated[activeIndicatorIndex] = {
      ...updated[activeIndicatorIndex],
      definisiOperasional: opDefVal,
      metodePenghitungan: metodeVal,
      variabelJumlah: metodeVal === 'Jumlah' ? varJumlahVal : '',
      variabelPembilang: metodeVal === 'Persentase' ? varPembilangVal : '',
      variabelPenyebut: metodeVal === 'Persentase' ? varPenyebutVal : ''
    };
    setTempIndicators(updated);
    setShowOpDefModal(false);
  };

  const handleAutoSuggestOpDef = () => {
    const textVal = tempIndicators[activeIndicatorIndex]?.indikator || '';
    if (!textVal) return;
    const lower = textVal.toLowerCase();
    const isPercent = lower.includes('persen') || lower.includes('%') || lower.includes('persentase');

    if (isPercent) {
      setMetodeVal('Persentase');
      let subject = textVal.replace(/persentase|persen|%/gi, '').trim();
      if (subject) {
        subject = subject.charAt(0).toUpperCase() + subject.slice(1);
      } else {
        subject = "Kegiatan";
      }
      setVarPembilangVal(`Jumlah ${subject} yang terealisasi/selesai`);
      setVarPenyebutVal(`Jumlah total target ${subject} yang direncanakan`);
      setVarJumlahVal('');
    } else {
      setMetodeVal('Jumlah');
      setVarJumlahVal(textVal);
      setVarPembilangVal('');
      setVarPenyebutVal('');
    }
  };

  const handleSaveIndicators = async () => {
    if (!selectedNodeForIndicators) return;
    
    const invalid = tempIndicators.some(ind => !ind.indikator.trim() || !ind.satuan.trim());
    if (invalid) {
      showAlert('Semua indikator harus memiliki uraian indikator dan satuan.', 'error');
      return;
    }
    
    const payload = {
      ...selectedNodeForIndicators,
      indicators: tempIndicators,
      requesterRole: activeRole,
      requesterBidang: activeBidang
    };
    
    try {
      const res = await fetchWithAuth('/api/cascading5years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSuccess('Daftar indikator berhasil diperbarui.');
        setShowIndicatorModal(false);
        loadData();
      } else {
        const err = await res.json();
        showAlert(err.error || 'Gagal menyimpan indikator.', 'error');
      }
    } catch (e) {
      showAlert('Kesalahan jaringan.', 'error');
    }
  };

  const hasAccess = activeRole === 'admin' || activeRole === 'perencana';

  if (!hasAccess) {
    return (
      <div className="glass-panel text-center" style={{ padding: '40px' }}>
        <i className="fa-solid fa-ban text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Akses Ditolak</h2>
        <p className="text-muted" style={{ marginTop: '8px' }}>Hanya Administrator atau Admin Perencana yang diperbolehkan mengelola data Indikator Renstra.</p>
      </div>
    );
  }

  const getVisibleNodeIds = () => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase().trim();
    const visibleIds = new Set();

    nodes.forEach(node => {
      const matchText = (node.text || '').toLowerCase().includes(query);
      const matchNomenklatur = (node.nomenklatur || '').toLowerCase().includes(query);
      const matchSasaran = (node.sasaran || '').toLowerCase().includes(query);
      const matchIndicators = node.indicators && node.indicators.some(ind => 
        (ind.indikator || '').toLowerCase().includes(query) || 
        (ind.sasaran || '').toLowerCase().includes(query)
      );

      if (matchText || matchNomenklatur || matchSasaran || matchIndicators) {
        visibleIds.add(node.id);
        
        let parentId = node.parentId;
        while (parentId) {
          visibleIds.add(parentId);
          const parentNode = nodes.find(n => n.id === parentId);
          parentId = parentNode ? parentNode.parentId : null;
        }
      }
    });

    return visibleIds;
  };

  // Render tree recursively
  const renderTreeNodes = (parentId = null) => {
    const visibleIds = getVisibleNodeIds();
    let levelNodes = nodes.filter(n => n.parentId === parentId);
    if (visibleIds) {
      levelNodes = levelNodes.filter(n => visibleIds.has(n.id));
    }
    if (levelNodes.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: parentId ? '16px' : '0', borderLeft: parentId ? '1px dashed var(--glass-border)' : 'none' }}>
        {levelNodes.map(node => (
          <div key={node.id} className="tree-node" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div className="tree-node-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div className="tree-node-info" style={{ flexGrow: 1 }}>
                <h4>
                  <span style={{
                    fontSize: '10px',
                    background: levelColors[node.level] || 'var(--primary-orange)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginRight: '8px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>{levelLabels[node.level] || node.level}</span>
                  {node.nomenklatur && (
                    <span style={{ color: 'var(--primary-orange)', fontWeight: 'bold', marginRight: '6px' }}>
                      [{node.nomenklatur}]
                    </span>
                  )}
                  {node.text}
                </h4>
                
                {node.indicators && node.indicators.length > 0 ? (
                  <div style={{ marginTop: '6px', paddingLeft: '8px', borderLeft: '2px solid var(--primary-orange)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {node.indicators.map((ind, iIdx) => (
                      <div key={ind.id || iIdx} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        • Indikator: <strong>{ind.indikator}</strong> | Target: <strong>{ind.target2025}</strong> (2025) - <strong>{ind.target2026}</strong> (2026) - <strong>{ind.target2027}</strong> (2027) - <strong>{ind.target2028}</strong> (2028) - <strong>{ind.target2029}</strong> (2029) - <strong>{ind.target2030}</strong> (2030) | Akhir: <strong>{ind.targetAkhir} {ind.satuan}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  node.level !== 'sasaran_subkegiatan' && (
                    <p className="text-muted" style={{ marginTop: '6px', fontSize: '11px', fontStyle: 'italic' }}>
                      Belum ada indikator. Klik &quot;Atur Indikator&quot; untuk menambahkan.
                    </p>
                  )
                )}

                <p className="text-muted" style={{ marginTop: '6px', fontSize: '12px' }}>
                  {node.level === 'sasaran_subkegiatan' || node.level === 'subkegiatan' ? (
                    parseFloat(node.anggaranAkhir) > 0 && (
                      <span style={{ color: 'var(--success)' }}>
                        Total Anggaran 5-Thn: <strong>Rp {parseFloat(node.anggaranAkhir).toLocaleString('id-ID')}</strong>
                      </span>
                    )
                  ) : (
                    calculateNodeBudget5Y(node.id, 'Akhir') > 0 && (
                      <span style={{ color: 'var(--info)' }}>
                        Anggaran Akumulasi: <strong>Rp {calculateNodeBudget5Y(node.id, 'Akhir').toLocaleString('id-ID')}</strong>
                      </span>
                    )
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
              <div className="print-exclude" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
                {node.level !== 'sasaran_subkegiatan' && (
                  <button 
                    className="btn btn-sm btn-info" 
                    style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', width: 'auto', background: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)', color: '#60a5fa' }}
                    onClick={() => openIndicatorModal(node)}
                  >
                    <i className="fa-solid fa-list-check"></i> Atur Indikator
                  </button>
                )}
                {getValidChildLevels(node.level).map(childLvl => (
                  <button 
                    key={childLvl}
                    className="btn btn-sm btn-orange" 
                    style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', width: 'auto' }}
                    onClick={() => openAddModal(node, childLvl)}
                  >
                    <i className="fa-solid fa-plus-circle"></i> {getChildButtonLabel(childLvl)}
                  </button>
                ))}
                <button 
                  className="btn btn-sm btn-secondary" 
                  style={{ padding: '3px 8px', fontSize: '10px', width: 'auto', background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)' }}
                  onClick={() => openEditModal(node)}
                >
                  Edit
                </button>
                <button 
                  className="btn btn-sm btn-danger" 
                  style={{ padding: '3px 8px', fontSize: '10px', width: 'auto' }}
                  onClick={() => openDeleteConfirmModal(node)}
                >
                  Hapus
                </button>
              </div>
            </div>
            {renderTreeNodes(node.id)}
          </div>
        ))}
      </div>
    );
  };

  const renderOrgChartTree = (parentId = null) => {
    const visibleIds = getVisibleNodeIds();
    let levelNodes = nodes.filter(n => n.parentId === parentId);
    if (visibleIds) {
      levelNodes = levelNodes.filter(n => visibleIds.has(n.id));
    }
    if (levelNodes.length === 0) return null;

    return (
      <ul>
        {levelNodes.map(node => (
          <li key={node.id}>
            <div className="org-chart-node org-node-box" style={{
              border: `2px solid ${levelColors[node.level] || '#ccc'}`,
              padding: '10px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
              minWidth: '160px',
              maxWidth: '240px',
              textAlign: 'center',
              display: 'inline-block',
              position: 'relative'
            }}>
              {/* Level Badge */}
              <div className="org-level-badge" style={{
                fontSize: '8px',
                fontWeight: 'bold',
                color: '#ffffff',
                background: levelColors[node.level] || '#666',
                padding: '2px 6px',
                borderRadius: '4px',
                marginBottom: '6px',
                textTransform: 'uppercase',
                display: 'inline-block'
              }}>
                {levelLabels[node.level]?.substring(3) || node.level}
              </div>

              {/* Title / Description */}
              <div style={{ fontSize: '11px', fontWeight: '600', lineHeight: '1.3', wordBreak: 'break-word' }}>
                {node.level === 'tujuan' || node.level === 'sasaran' ? node.text : (node.sasaran || node.text)}
              </div>

              {/* Nomenklatur for program/kegiatan/subkegiatan */}
              {node.nomenklatur && (
                <div style={{ fontSize: '9px', fontStyle: 'italic', color: '#94a3b8', marginTop: '4px', wordBreak: 'break-word', borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: '4px' }}>
                  {node.nomenklatur}
                </div>
              )}

              {/* Indicators */}
              {node.indicators && node.indicators.length > 0 && (
                <div style={{ marginTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: '4px', textAlign: 'left' }}>
                  {node.indicators.map((ind, i) => (
                    <div key={i} style={{ fontSize: '8px', color: 'var(--text-muted)', lineHeight: '1.2', marginBottom: '2px' }}>
                      • {ind.indikator} ({ind.targetAkhir} {ind.satuan})
                    </div>
                  ))}
                </div>
              )}
            </div>
            {renderOrgChartTree(node.id)}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section>
      <div className="glass-panel print-exclude" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button 
          className="btn btn-secondary" 
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)' }}
          onClick={handlePrintCascading}
        >
          <i className="fa-solid fa-table"></i> Cetak Cascading
        </button>
        <button 
          className="btn btn-secondary" 
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)' }}
          onClick={handlePrintTree}
        >
          <i className="fa-solid fa-print"></i> Cetak Pohon Kinerja
        </button>
        <button 
          className="btn btn-secondary" 
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)' }}
          onClick={handlePrintOrgChart}
        >
          <i className="fa-solid fa-sitemap"></i> Cetak Bagan Pohon
        </button>
        <button 
          className="btn btn-orange" 
          style={{ 
            width: 'auto', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            opacity: nodes.some(n => n.level === 'tujuan') ? 0.5 : 1,
            cursor: nodes.some(n => n.level === 'tujuan') ? 'not-allowed' : 'pointer'
          }}
          onClick={() => openAddModal(null)}
          disabled={nodes.some(n => n.level === 'tujuan')}
        >
          <i className="fa-solid fa-plus-circle"></i> Tambah Tujuan
        </button>
      </div>

      {error && <div className="glass-panel" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '15px', marginBottom: '20px' }}>{error}</div>}
      {success && <div className="glass-panel" style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '15px', marginBottom: '20px' }}>{success}</div>}

      <div className="glass-panel" style={{ width: '100%' }}>
        <div className="panel-header justify-between">
          <h3><i className="fa-solid fa-folder-tree text-orange"></i> Struktur Indikator Renstra</h3>
          <div className="print-exclude" style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button"
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-orange' : 'btn-secondary'}`} 
              style={{ width: 'auto', padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setViewMode('list')}
            >
              <i className="fa-solid fa-list mr-1"></i> Mode Daftar
            </button>
            <button 
              type="button"
              className={`btn btn-sm ${viewMode === 'orgchart' ? 'btn-orange' : 'btn-secondary'}`} 
              style={{ width: 'auto', padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setViewMode('orgchart')}
            >
              <i className="fa-solid fa-sitemap mr-1"></i> Mode Bagan (Org Chart)
            </button>
          </div>
        </div>
        <div className="panel-body">
          {/* Search Bar */}
          <div className="print-exclude" style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(255, 255, 255, 0.01)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'relative', flexGrow: 1, maxWidth: '500px' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
              <input
                ref={searchInputRef}
                type="text"
                className="form-control"
                style={{ paddingLeft: '35px', margin: 0 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari indikator, sasaran, atau nomenklatur... (Tekan '/')"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
          </div>

          <div className={`cascading-tree-editor ${printMode === 'cascading' || printMode === 'orgchart' ? 'print-exclude' : ''}`} style={{ display: viewMode === 'list' ? 'block' : 'none' }}>
            {nodes.filter(n => n.parentId === null).length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                <i className="fa-solid fa-folder-open" style={{ fontSize: '32px', marginBottom: '12px', color: 'var(--text-muted)' }}></i>
                <p>Belum ada data Indikator Renstra. Klik &quot;Tambah Tujuan&quot; untuk memulai.</p>
              </div>
            ) : (
              renderTreeNodes(null)
            )}
          </div>

          {viewMode === 'orgchart' && (
            <div className={`org-chart-container ${printMode === 'cascading' || printMode === 'tree' ? 'print-exclude' : ''}`}>
              <div className="org-chart-wrapper">
                <div className="org-chart">
                  {nodes.filter(n => n.parentId === null).length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                      <p>Belum ada data Indikator Renstra.</p>
                    </div>
                  ) : (
                    renderOrgChartTree(null)
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showFormModal && (
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
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,107,0,0.3)'
          }}>
            <div className="panel-header justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <h3>
                <i className="fa-solid fa-diagram-project text-orange"></i>
                {isEditing ? ` Edit ${levelLabels[level] || level}` : ` Tambah ${levelLabels[level] || level}`}
              </h3>
              <button onClick={() => setShowFormModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            
            <div className="panel-body" style={{ padding: '20px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {parentId && (
                <div style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: '#60a5fa', lineHeight: '1.4' }}>
                  <i className="fa-solid fa-info-circle" style={{ marginRight: '8px' }}></i>
                  <span>
                    Anda sedang {isEditing ? 'mengubah' : 'menambahkan'} data pada induk <strong>{levelLabels[nodes.find(n => n.id === parentId)?.level] || ''}</strong>: &ldquo;{nodes.find(n => n.id === parentId)?.text}&rdquo;
                  </span>
                </div>
              )}
              
              <div className="form-group mb-3">
                <label>Level Cascading</label>
                <select 
                  className="select-sim" 
                  value={level} 
                  onChange={(e) => setLevel(e.target.value)} 
                  disabled={isEditing || !!parentId}
                >
                  {getValidChildLevels(parentId ? nodes.find(n => n.id === parentId)?.level : null).map(lvl => (
                    <option key={lvl} value={lvl}>{levelLabels[lvl] || lvl}</option>
                  ))}
                </select>
              </div>

              {/* Master Data Selection for Program/Kegiatan/Subkegiatan */}
              {['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan'].includes(level) && (
                <div className="form-group mb-3" style={{ background: 'rgba(255, 107, 0, 0.05)', padding: '10px', borderRadius: '8px', border: '1px dashed var(--primary-orange)' }}>
                  <label>Pilih Nomenklatur Master Data</label>
                  <select className="select-sim" value={selectedMasterId} onChange={(e) => handleMasterChange(e.target.value)}>
                    <option value="">-- Pilih Nomenklatur --</option>
                    {getMasterOptions().map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.nama}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Text / Uraian input */}
              <div className="form-group mb-3">
                <label>
                  {level === 'tujuan' && 'Uraian Tujuan Strategis'}
                  {level === 'sasaran' && 'Uraian Sasaran Strategis'}
                  {level === 'sasaran_program' && 'Uraian Sasaran Program'}
                  {level === 'sasaran_kegiatan' && 'Uraian Sasaran Kegiatan'}
                  {level === 'sasaran_subkegiatan' && 'Uraian Sasaran Subkegiatan'}
                  {level === 'sasaran_aktivitas' && 'Uraian Sasaran Aktivitas'}
                </label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={level === 'sasaran_subkegiatan'}
                  required
                  placeholder="Masukkan deskripsi..."
                />
              </div>

              {/* Uraian Aktivitas (for Aktivitas level only) */}
              {level === 'sasaran_aktivitas' && (
                <div className="form-group mb-3">
                  <label>Uraian Aktivitas (Rincian Kegiatan Taktis)</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={nomenklatur}
                    onChange={(e) => setNomenklatur(e.target.value)}
                    required
                    placeholder="Masukkan uraian aktivitas..."
                  />
                </div>
              )}

              {/* Multi Bidang Pengampu */}
              <div className="form-group mb-3">
                <label>Bidang Pengampu</label>
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

              {/* Budgets for subkegiatan */}
              {level === 'sasaran_subkegiatan' && (
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', marginTop: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <i className="fa-solid fa-wallet text-orange"></i> Alokasi Anggaran Renstra (Subkegiatan)
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
                    {['2025', '2026', '2027', '2028', '2029', '2030'].map(year => {
                      const bState = year === '2025' ? b2025 : year === '2026' ? b2026 : year === '2027' ? b2027 : year === '2028' ? b2028 : year === '2029' ? b2029 : b2030;
                      const setBState = year === '2025' ? setB2025 : year === '2026' ? setB2026 : year === '2027' ? setB2027 : year === '2028' ? setB2028 : year === '2029' ? setB2029 : setB2030;

                      return (
                        <div key={year} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                          <strong style={{ fontSize: '12px', color: 'var(--primary-orange)' }}>Tahun {year}</strong>
                          <div className="form-group mt-1">
                            <label style={{ fontSize: '10px', margin: 0 }}>Anggaran (Rp)</label>
                            <input type="text" className="form-control" style={{ padding: '4px 8px', fontSize: '11px' }} value={bState} onChange={(e) => setBState(e.target.value)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="form-group" style={{ background: 'rgba(255,255,255,0.04)', padding: '10px', borderRadius: '8px' }}>
                    <label>Total Anggaran Akhir Periode</label>
                    <input type="text" className="form-control" value={parseFloat(budgetAkhir).toLocaleString('id-ID')} readOnly style={{ background: 'rgba(0,0,0,0.3)', fontWeight: 'bold' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="panel-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowFormModal(false)} style={{ width: 'auto' }}>Batal</button>
              <button type="button" className="btn btn-orange" onClick={handleSubmit} style={{ width: 'auto' }}>
                <i className="fa-solid fa-save mr-2"></i> Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicator Management Modal */}
      {showIndicatorModal && selectedNodeForIndicators && (
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
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(59,130,246,0.3)'
          }}>
            <div className="panel-header justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <h3>
                <i className="fa-solid fa-list-check text-info"></i>
                Atur Indikator Kinerja - {selectedNodeForIndicators.text}
              </h3>
              <button onClick={() => setShowIndicatorModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            
            <div className="panel-body" style={{ padding: '20px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button className="btn btn-sm btn-orange" style={{ width: 'auto', alignSelf: 'flex-start' }} onClick={addTempIndicator}>
                <i className="fa-solid fa-plus-circle"></i> Tambah Indikator Baru
              </button>
              
              {tempIndicators.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Belum ada indikator. Klik tombol di atas untuk menambahkan indikator pertama.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {tempIndicators.map((ind, idx) => (
                    <div key={ind.id || idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--primary-orange)' }}>Indikator #{idx + 1}</strong>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" className="btn btn-sm btn-info" style={{ width: 'auto', padding: '2px 8px', fontSize: '10px' }} onClick={() => openOpDefModal(idx)}>
                            <i className="fa-solid fa-book mr-1"></i> Definisi Operasional
                          </button>
                          <button className="btn btn-sm btn-danger" style={{ width: 'auto', padding: '2px 8px', fontSize: '10px' }} onClick={() => removeTempIndicator(idx)}>
                            <i className="fa-solid fa-trash"></i> Hapus
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                          <label style={{ fontSize: '11px' }}>Uraian Indikator</label>
                          <input type="text" className="form-control" value={ind.indikator} onChange={(e) => updateTempIndicator(idx, 'indikator', e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '11px' }}>Satuan</label>
                          <input type="text" className="form-control" value={ind.satuan} onChange={(e) => updateTempIndicator(idx, 'satuan', e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '11px' }}>Tipe Target</label>
                          <select className="select-sim" value={ind.tipeTarget} onChange={(e) => updateTempIndicator(idx, 'tipeTarget', e.target.value)}>
                            <option value="Kondisi Akhir Naik">Kondisi Akhir Naik</option>
                            <option value="Kondisi Akhir Menurun">Kondisi Akhir Menurun</option>
                            <option value="Akumulatif">Akumulatif</option>
                          </select>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr) 1.2fr', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '6px' }}>
                        {['2025', '2026', '2027', '2028', '2029', '2030'].map(yr => (
                          <div key={yr} className="form-group">
                            <label style={{ fontSize: '9px', margin: 0 }}>Target {yr}</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              style={{ padding: '3px 6px', fontSize: '11px' }} 
                              value={ind[`target${yr}`] || '0'} 
                              onChange={(e) => updateTempIndicator(idx, `target${yr}`, e.target.value)} 
                            />
                          </div>
                        ))}
                        <div className="form-group">
                          <label style={{ fontSize: '9px', margin: 0 }}>Target Akhir</label>
                          <input type="text" className="form-control" style={{ padding: '3px 6px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(0,0,0,0.3)' }} value={ind.targetAkhir} readOnly />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowIndicatorModal(false)} style={{ width: 'auto' }}>Batal</button>
              <button type="button" className="btn btn-orange" onClick={handleSaveIndicators} style={{ width: 'auto' }}>
                <i className="fa-solid fa-save mr-2"></i> Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && nodeToDelete && (
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
            maxWidth: '500px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(239,68,68,0.4)'
          }}>
            <div className="panel-header justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <h3 style={{ color: 'var(--danger)' }}>
                <i className="fa-solid fa-triangle-exclamation"></i> Konfirmasi Hapus Node
              </h3>
              <button onClick={() => setShowDeleteConfirmModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>

            <div className="panel-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '14px', lineHeight: '1.4' }}>
                Apakah Anda yakin ingin menghapus node berikut beserta seluruh turunannya?
              </p>
              <div style={{ background: 'rgba(239,68,68,0.05)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px' }}>
                <strong>({levelLabels[nodeToDelete.level] || nodeToDelete.level})</strong> {nodeToDelete.text}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 600 }}>
                ⚠️ PERINGATAN: Menghapus node ini akan secara permanen menghapus seluruh {countDescendants(nodeToDelete.id)} node turunan/anak di bawahnya!
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ketik kata <strong>HAPUS</strong> untuk melanjutkan:</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={deleteConfirmInput} 
                  onChange={(e) => setDeleteConfirmInput(e.target.value)} 
                  placeholder="Ketik HAPUS"
                />
              </div>
            </div>

            <div className="panel-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirmModal(false)} style={{ width: 'auto' }}>Batal</button>
              <button 
                type="button" 
                className="btn btn-danger" 
                disabled={deleteConfirmInput !== 'HAPUS'} 
                onClick={executeDelete} 
                style={{ width: 'auto' }}
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operational Definition Modal */}
      {showOpDefModal && activeIndicatorIndex !== -1 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(59,130,246,0.3)'
          }}>
            <div className="panel-header justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <h3>
                <i className="fa-solid fa-book text-info"></i> Definisi Operasional Indikator
              </h3>
              <button onClick={() => setShowOpDefModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            
            <div className="panel-body" style={{ padding: '20px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                <strong>Indikator:</strong> {tempIndicators[activeIndicatorIndex]?.indikator || '-'}
              </div>

              <div className="form-group">
                <label>Definisi Operasional</label>
                <textarea 
                  className="form-control" 
                  rows="3" 
                  value={opDefVal} 
                  onChange={(e) => setOpDefVal(e.target.value)} 
                  placeholder="Masukkan definisi operasional..."
                />
              </div>

              <div className="form-group">
                <label>Metode Penghitungan</label>
                <select className="select-sim" value={metodeVal} onChange={(e) => setMetodeVal(e.target.value)}>
                  <option value="Jumlah">Jumlah (Satu Variabel)</option>
                  <option value="Persentase">Persentase (Dua Variabel: Pembilang & Penyebut)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <button type="button" className="btn btn-sm btn-orange" style={{ width: 'auto' }} onClick={handleAutoSuggestOpDef}>
                  <i className="fa-solid fa-wand-magic-sparkles mr-1"></i> Rekomendasi Variabel
                </button>
              </div>

              {metodeVal === 'Jumlah' ? (
                <div className="form-group">
                  <label>Variabel Jumlah</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={varJumlahVal} 
                    onChange={(e) => setVarJumlahVal(e.target.value)} 
                    placeholder="Contoh: Jumlah dokumen perencanaan yang disusun..."
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Variabel Pembilang (Numerator)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={varPembilangVal} 
                      onChange={(e) => setVarPembilangVal(e.target.value)} 
                      placeholder="Contoh: Jumlah posko yang aktif..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Variabel Penyebut (Denominator)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={varPenyebutVal} 
                      onChange={(e) => setVarPenyebutVal(e.target.value)} 
                      placeholder="Contoh: Jumlah seluruh posko yang direncanakan..."
                    />
                  </div>
                </>
              )}
            </div>

            <div className="panel-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowOpDefModal(false)} style={{ width: 'auto' }}>Batal</button>
              <button type="button" className="btn btn-orange" onClick={handleSaveOpDef} style={{ width: 'auto' }}>
                <i className="fa-solid fa-check mr-2"></i> Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Landscape styling for cascading print mode */}
      {printMode === 'cascading' && (
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: landscape; }
          }
        `}} />
      )}
      {printMode === 'tree' && (
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: portrait; }
          }
        `}} />
      )}

      {/* Tabular print template */}
      {printMode === 'cascading' && (
        <div className="print-only-layout" id="printTemplate" style={{ display: 'block', padding: '30px', background: 'white', color: 'black' }}>
          <div className="kop-surat" style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase' }}>Pemerintah Kabupaten Boyolali</h3>
            <h2 style={{ margin: '4px 0', fontSize: '18px', textTransform: 'uppercase' }}>Badan Penanggulangan Bencana Daerah (BPBD)</h2>
            <p style={{ margin: 0, fontSize: '10px' }}>Kompleks Perkantoran Terpadu Kabupaten Boyolali, Jawa Tengah</p>
          </div>

          <h3 style={{ textAlign: 'center', textDecoration: 'underline', fontSize: '14px', margin: '0 0 4px 0' }}>
            MATRIKS CASCADING KINERJA JANGKA MENENGAH (RENSTRA)
          </h3>
          <p style={{ textAlign: 'center', fontSize: '12px', margin: '0 0 20px 0' }}>PERIODE 2025 - 2030</p>

          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f2f2f2' }}>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '18%' }}>Tujuan Strategis</th>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '18%' }}>Sasaran Strategis</th>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '18%' }}>Program</th>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '18%' }}>Kegiatan</th>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '20%' }}>Subkegiatan</th>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '8%' }}>Bidang Pengampu</th>
              </tr>
            </thead>
            <tbody>
              {getFlatPaths5Y().length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '10px' }}>Tidak ada data</td>
                </tr>
              ) : (
                getFlatPaths5Y().map((path, idx) => {
                  return (
                    <tr key={idx}>
                      {/* Tujuan */}
                      <td style={{ border: '1px solid black', padding: '6px', fontSize: '11px', verticalAlign: 'top' }}>
                        {path.tujuan && (
                          <>
                            <div style={{ fontWeight: 'bold' }}>{path.tujuan.text}</div>
                            {path.tujuan.indicators && path.tujuan.indicators.map((ind, i) => (
                              <div key={i} style={{ fontSize: '10px', color: '#333', marginTop: '4px' }}>
                                • {ind.indikator} ({ind.target2025} - {ind.target2030} | {ind.satuan})
                              </div>
                            ))}
                          </>
                        )}
                      </td>

                      {/* Sasaran */}
                      <td style={{ border: '1px solid black', padding: '6px', fontSize: '11px', verticalAlign: 'top' }}>
                        {path.sasaran && (
                          <>
                            <div style={{ fontWeight: 'bold' }}>{path.sasaran.text}</div>
                            {path.sasaran.indicators && path.sasaran.indicators.map((ind, i) => (
                              <div key={i} style={{ fontSize: '10px', color: '#333', marginTop: '4px' }}>
                                • {ind.indikator} ({ind.target2025} - {ind.target2030} | {ind.satuan})
                              </div>
                            ))}
                          </>
                        )}
                      </td>

                      {/* Program */}
                      <td style={{ border: '1px solid black', padding: '6px', fontSize: '11px', verticalAlign: 'top' }}>
                        {path.sasaran_program && (
                          <>
                            <div style={{ fontWeight: 'bold' }}>{path.sasaran_program.text}</div>
                            <div style={{ fontSize: '10px', fontStyle: 'italic', color: '#555' }}>Nomenklatur: {path.sasaran_program.nomenklatur}</div>
                            {path.sasaran_program.indicators && path.sasaran_program.indicators.map((ind, i) => (
                              <div key={i} style={{ fontSize: '10px', color: '#333', marginTop: '4px' }}>
                                • {ind.indikator} ({ind.target2025} - {ind.target2030} | {ind.satuan})
                              </div>
                            ))}
                          </>
                        )}
                      </td>

                      {/* Kegiatan */}
                      <td style={{ border: '1px solid black', padding: '6px', fontSize: '11px', verticalAlign: 'top' }}>
                        {path.sasaran_kegiatan && (
                          <>
                            <div style={{ fontWeight: 'bold' }}>{path.sasaran_kegiatan.text}</div>
                            <div style={{ fontSize: '10px', fontStyle: 'italic', color: '#555' }}>Nomenklatur: {path.sasaran_kegiatan.nomenklatur}</div>
                            {path.sasaran_kegiatan.indicators && path.sasaran_kegiatan.indicators.map((ind, i) => (
                              <div key={i} style={{ fontSize: '10px', color: '#333', marginTop: '4px' }}>
                                • {ind.indikator} ({ind.target2025} - {ind.target2030} | {ind.satuan})
                              </div>
                            ))}
                          </>
                        )}
                      </td>

                      {/* Subkegiatan */}
                      <td style={{ border: '1px solid black', padding: '6px', fontSize: '11px', verticalAlign: 'top' }}>
                        {path.sasaran_subkegiatan && (
                          <>
                            <div style={{ fontWeight: 'bold' }}>{path.sasaran_subkegiatan.text}</div>
                            <div style={{ fontSize: '10px', fontStyle: 'italic', color: '#555' }}>Nomenklatur: {path.sasaran_subkegiatan.nomenklatur}</div>
                            {path.sasaran_subkegiatan.indicators && path.sasaran_subkegiatan.indicators.map((ind, i) => (
                              <div key={i} style={{ fontSize: '10px', color: '#333', marginTop: '4px' }}>
                                • {ind.indikator} ({ind.target2025} - {ind.target2030} | {ind.satuan})
                              </div>
                            ))}
                            <div style={{ fontSize: '10px', color: 'green', marginTop: '4px' }}>
                              Total Anggaran: Rp {parseFloat(path.sasaran_subkegiatan.anggaranAkhir || 0).toLocaleString('id-ID')}
                            </div>
                          </>
                        )}
                        {path.sasaran_aktivitas && (
                          <div style={{ fontSize: '9px', color: '#555', marginTop: '4px', paddingLeft: '8px', borderLeft: '1px dashed #aaa' }}>
                            Aktivitas: <strong>{path.sasaran_aktivitas.text}</strong> ({path.sasaran_aktivitas.nomenklatur})
                            {path.sasaran_aktivitas.indicators && path.sasaran_aktivitas.indicators.map((ind, i) => (
                              <div key={i} style={{ fontSize: '8px', color: '#666' }}>
                                - {ind.indikator} ({ind.targetAkhir} {ind.satuan})
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Bidang Pengampu */}
                      <td style={{ border: '1px solid black', padding: '6px', fontSize: '10px', verticalAlign: 'top' }}>
                        {(() => {
                          const nodeWithBidang = path.sasaran_subkegiatan || path.sasaran_kegiatan || path.sasaran_program || path.sasaran || path.tujuan;
                          return nodeWithBidang?.bidangPengampu?.join(', ') || '-';
                        })()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {alertMessage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 11000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '400px',
            width: '100%',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: alertType === 'error' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '16px' }}>
              {alertType === 'error' ? (
                <i className="fa-solid fa-circle-xmark text-danger" style={{ fontSize: '48px' }}></i>
              ) : alertType === 'success' ? (
                <i className="fa-solid fa-circle-check text-success" style={{ fontSize: '48px' }}></i>
              ) : (
                <i className="fa-solid fa-circle-info text-info" style={{ fontSize: '48px' }}></i>
              )}
            </div>
            <h4 style={{ fontWeight: 600, marginBottom: '8px' }}>
              {alertType === 'error' ? 'Pemberitahuan Gagal' : alertType === 'success' ? 'Sukses' : 'Pemberitahuan'}
            </h4>
            <p style={{ fontSize: '14px', lineHeight: '1.4', marginBottom: '20px', color: 'var(--text-muted)' }}>
              {alertMessage}
            </p>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
              Modal ini akan menutup otomatis dalam 10 detik...
            </div>
            <button type="button" className="btn btn-orange" style={{ width: '100%' }} onClick={() => setAlertMessage('')}>
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Landscape styling for orgchart print mode */}
      {printMode === 'orgchart' && (
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: landscape; margin: 10mm; }
          }
        `}} />
      )}

      {/* Org Chart print template */}
      {printMode === 'orgchart' && (
        <div className="print-only-layout" id="printTemplateOrg" style={{ display: 'block', padding: '30px', background: 'white', color: 'black' }}>
          <div className="kop-surat" style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase' }}>Pemerintah Kabupaten Boyolali</h3>
            <h2 style={{ margin: '4px 0', fontSize: '18px', textTransform: 'uppercase' }}>Badan Penanggulangan Bencana Daerah (BPBD)</h2>
            <p style={{ margin: 0, fontSize: '10px' }}>Kompleks Perkantoran Terpadu Kabupaten Boyolali, Jawa Tengah</p>
          </div>

          <h3 style={{ textAlign: 'center', textDecoration: 'underline', fontSize: '14px', margin: '0 0 4px 0' }}>
            DIAGRAM POHON KINERJA (RENSTRA)
          </h3>
          <p style={{ textAlign: 'center', fontSize: '12px', margin: '0 0 20px 0' }}>PERIODE 2025 - 2030</p>

          <div className="org-chart-wrapper" style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="org-chart">
              {nodes.filter(n => n.parentId === null).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Tidak ada data</div>
              ) : (
                renderOrgChartTree(null)
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS Styles for Org Chart */}
      <style dangerouslySetInnerHTML={{__html: `
        .org-chart-container {
          width: 100%;
          overflow-x: auto;
          overflow-y: auto;
          padding: 30px;
          background: rgba(15, 23, 42, 0.4);
          border-radius: 12px;
          border: 1px solid var(--glass-border);
          margin-bottom: 20px;
          max-height: 700px;
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
        }
        .org-chart-wrapper {
          margin: 0 auto;
          min-width: max-content;
        }
        .org-chart {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .org-chart ul {
          padding-top: 24px;
          position: relative;
          display: flex;
          justify-content: center;
          margin: 0;
          padding-left: 0;
        }
        .org-chart li {
          text-align: center;
          list-style-type: none;
          position: relative;
          padding: 24px 8px 0 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: all 0.3s;
        }
        /* Siblings horizontal connection lines */
        .org-chart li::before, .org-chart li::after {
          content: '';
          position: absolute;
          top: 0;
          right: 50%;
          border-top: 2px solid rgba(255, 107, 0, 0.4);
          width: 50%;
          height: 24px;
        }
        .org-chart li::after {
          right: auto;
          left: 50%;
          border-left: 2px solid rgba(255, 107, 0, 0.4);
        }
        /* Disconnect lines for single-child elements */
        .org-chart li:only-child::after, .org-chart li:only-child::before {
          display: none;
        }
        .org-chart li:only-child {
          padding-top: 0;
        }
        .org-chart li:first-child::before, .org-chart li:last-child::after {
          border: 0 none;
        }
        .org-chart li:last-child::before {
          border-right: 2px solid rgba(255, 107, 0, 0.4);
          border-radius: 0 8px 0 0;
        }
        .org-chart li:first-child::after {
          border-radius: 8px 0 0 0;
        }
        /* Parent downward connection line */
        .org-chart ul ul::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          border-left: 2px solid rgba(255, 107, 0, 0.4);
          width: 0;
          height: 24px;
        }
        
        .org-node-box {
          background: rgba(30, 41, 59, 0.7) !important;
          border: 1px solid var(--glass-border) !important;
          backdrop-filter: blur(10px);
          color: white !important;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .org-node-box:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(255, 107, 0, 0.2);
          border-color: var(--primary-orange) !important;
        }

        @media print {
          .print-exclude {
            display: none !important;
          }
          .org-chart-container {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .org-node-box {
            background: white !important;
            color: black !important;
            border: 2px solid #64748b !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .org-level-badge {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .org-chart li::before, .org-chart li::after, .org-chart ul ul::before {
            border-color: #64748b !important;
          }
        }
      `}} />
    </section>
  );
}
