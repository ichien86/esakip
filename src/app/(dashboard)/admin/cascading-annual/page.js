'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import React, { useState, useEffect, useRef } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function AdminCascadingAnnualPage() {
  const { fetchWithAuth, activeRole, activeBidang, activeYear } = useSimulation();

  const [nodes, setNodes] = useState([]);
  const [fiveYearNodes, setFiveYearNodes] = useState([]);
  const [masterPrograms, setMasterPrograms] = useState([]);
  const [masterKegiatans, setMasterKegiatans] = useState([]);
  const [masterSubkegiatans, setMasterSubkegiatans] = useState([]);

  // Form states (Editing only)
  const [formId, setFormId] = useState('');
  const [level, setLevel] = useState('tujuan');
  const [parentId, setParentId] = useState('');
  const [text, setText] = useState('');
  const [sasaran, setSasaran] = useState('');
  const [nomenklatur, setNomenklatur] = useState('');
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [selectedBidangs, setSelectedBidangs] = useState([]);
  const [crossCuttingType, setCrossCuttingType] = useState('bersama');
  const [splitTargets, setSplitTargets] = useState({});
  const [selectedBidang, setSelectedBidang] = useState(null);
  const tahun = activeYear;
  const [anggaran, setAnggaran] = useState(0);
  const [anggaranDpa, setAnggaranDpa] = useState(0);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [printMode, setPrintMode] = useState('tree'); 
  const [viewMode, setViewMode] = useState('list'); // list or orgchart

  // Indicator edit state in modal
  const [tempIndicators, setTempIndicators] = useState([]);

  // DPA Excel Import modal state
  const [showDpaImportModal, setShowDpaImportModal] = useState(false);
  const [dpaFile, setDpaFile] = useState(null);
  const [importDpaError, setImportDpaError] = useState('');
  const [importDpaSuccess, setImportDpaSuccess] = useState('');
  const [uploadingDpa, setUploadingDpa] = useState(false);

  // Confirm Modal states
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmCallback, setConfirmCallback] = useState(null);

  const showConfirm = (msg, callback) => {
    setConfirmMessage(msg);
    setConfirmCallback(() => callback);
  };

  const handleConfirmYes = () => {
    if (confirmCallback) confirmCallback();
    setConfirmMessage('');
    setConfirmCallback(null);
  };

  const handleConfirmNo = () => {
    setConfirmMessage('');
    setConfirmCallback(null);
  };

  // Alert Modal states
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('info'); // info, success, error

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

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  // Smooth scroll search matches into view
  useEffect(() => {
    if (searchQuery.trim()) {
      const timer = setTimeout(() => {
        const firstMatch = document.querySelector('.matched-node');
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showFormModal || showDpaImportModal || confirmMessage || alertMessage) return;

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
  }, [showFormModal, showDpaImportModal, confirmMessage, alertMessage]);

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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
  };

  const calculateNodeBudget = (nodeId, type = 'Renja') => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return 0;
    
    if (node.level === 'sasaran_subkegiatan' || node.level === 'subkegiatan') {
      return type === 'DPA' ? (node.anggaranDpa || 0) : (node.anggaran || 0);
    }
    
    const children = nodes.filter(n => n.parentId === nodeId);
    return children.reduce((sum, child) => sum + calculateNodeBudget(child.id, type), 0);
  };

  const loadData = async () => {
    try {
      const res = await fetchWithAuth(`/api/renja/${tahun}`);
      if (res.ok) setNodes(await res.json());

      const fRes = await fetchWithAuth('/api/cascading5years');
      if (fRes.ok) setFiveYearNodes(await fRes.json());

      const mpRes = await fetchWithAuth('/api/master/program');
      if (mpRes.ok) setMasterPrograms(await mpRes.json());

      const mkRes = await fetchWithAuth('/api/master/kegiatan');
      if (mkRes.ok) setMasterKegiatans(await mkRes.json());

      const mskRes = await fetchWithAuth('/api/master/subkegiatan');
      if (mskRes.ok) setMasterSubkegiatans(await mskRes.json());
    } catch (e) {
      console.error('Failed to load cascading data', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [tahun]);

  const handleBidangChange = (bidang) => {
    if (selectedBidangs.includes(bidang)) {
      setSelectedBidangs(selectedBidangs.filter(b => b !== bidang));
    } else {
      setSelectedBidangs([...selectedBidangs, bidang]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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
      selectedBidang,
      splitTargets,
      target: '0',
      tahun,
      requesterRole: activeRole,
      requesterBidang: activeBidang,
      sasaran,
      nomenklatur,
      masterId: selectedMasterId || null,
      anggaran: level === 'sasaran_subkegiatan' ? (Number(anggaran) || 0) : 0,
      anggaranDpa: level === 'sasaran_subkegiatan' ? (Number(anggaranDpa) || 0) : 0,
      indicators: tempIndicators
    };

    try {
      const res = await fetchWithAuth('/api/cascading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSuccess('Item Indikator Renja berhasil disimpan.');
        loadData();
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
    let cType = node.crossCuttingType || 'bersama';
    if (cType === 'shared') cType = 'bersama';
    if (cType === 'split') cType = 'digabung';
    setCrossCuttingType(cType);
    
    setSplitTargets(node.splitTargets || {});
    setSelectedBidang(node.selectedBidang || null);
    setAnggaran(node.anggaran || 0);
    setAnggaranDpa(node.anggaranDpa || 0);
    setTempIndicators(node.indicators || []);
  };

  const handleTempIndicatorTargetChange = (idx, value) => {
    const updated = [...tempIndicators];
    updated[idx].target = value;
    setTempIndicators(updated);
  };

  const getMasterOptions = () => {
    if (level === 'sasaran_program') return masterPrograms;
    if (level === 'sasaran_kegiatan') return masterKegiatans;
    if (level === 'sasaran_subkegiatan') return masterSubkegiatans;
    return [];
  };

  const bidangOptions = [
    'Pimpinan',
    'Sekretariat',
    'Pencegahan & Kesiapsiagaan',
    'Kedaruratan & Logistik',
    'Rehabilitasi & Rekonstruksi'
  ];

  const handlePrintTree = () => {
    setPrintMode('tree');
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
                • ${ind.indikator} (Target: ${ind.target} ${ind.satuan})
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
        <title>Diagram Pohon Kinerja (Renja) - BPBD Boyolali</title>
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

        <h3 class="title-doc">DIAGRAM POHON KINERJA (RENJA)</h3>
        <p class="subtitle-doc">TAHUN ${tahun}</p>

        <div class="org-chart-wrapper">
          <div class="org-chart">
            ${treeHtml || '<div style="text-align: center; padding: 20px;">Belum ada data Indikator Renja.</div>'}
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
              link.download = 'pohon-kinerja-renja.png';
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
              pdf.save('pohon-kinerja-renja.pdf');

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

  const handlePrintCascading = () => {
    setPrintMode('cascading');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const getFlatPathsAnnual = () => {
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

  const openEditModal = (node) => {
    editNode(node);
    setShowFormModal(true);
  };

  const handleSyncFromRenstra = () => {
    showConfirm(
      `Apakah Anda yakin ingin menyinkronkan data pohon dari Renstra untuk tahun ${tahun}? Perubahan lokal saat ini pada struktur pohon tahun ${tahun} akan ditimpa.`,
      async () => {
        setError('');
        setSuccess('');
        try {
          const res = await fetchWithAuth('/api/renja/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tahun: tahun.toString() })
          });
          if (res.ok) {
            setSuccess('Berhasil menyinkronkan data pohon dan indikator dari Renstra!');
            loadData();
          } else {
            const err = await res.json();
            setError(err.error || 'Gagal menyinkronkan data.');
          }
        } catch (e) {
          setError('Kesalahan jaringan.');
        }
      }
    );
  };

  const handleDpaImportSubmit = async (e) => {
    e.preventDefault();
    if (!dpaFile) {
      setImportDpaError('Pilih file Excel terlebih dahulu.');
      return;
    }
    setUploadingDpa(true);
    setImportDpaError('');
    setImportDpaSuccess('');
    
    const formData = new FormData();
    formData.append('file', dpaFile);
    formData.append('tahun', tahun.toString());

    try {
      const res = await fetchWithAuth('/api/renja/import-dpa', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const result = await res.json();
        setImportDpaSuccess(`Sukses! Berhasil memperbarui anggaran DPA pada ${result.updatedCount} subkegiatan.`);
        loadData();
        setTimeout(() => {
          setShowDpaImportModal(false);
          setDpaFile(null);
          setImportDpaSuccess('');
        }, 2500);
      } else {
        const err = await res.json();
        setImportDpaError(err.error || 'Gagal mengimpor anggaran DPA.');
      }
    } catch (err) {
      setImportDpaError('Kesalahan jaringan.');
    } finally {
      setUploadingDpa(false);
    }
  };

  const hasAccess = activeRole === 'admin' || activeRole === 'perencana';

  if (!hasAccess) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa-solid fa-ban text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Akses Ditolak</h2>
        <p className="text-muted" style={{ marginTop: '8px' }}>Hanya Administrator atau Admin Perencana yang diperbolehkan mengelola data Indikator Renja.</p>
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

  const renderTreeNodes = (parentId = null) => {
    const visibleIds = getVisibleNodeIds();
    let levelNodes = nodes.filter(n => n.parentId === parentId);
    if (visibleIds) {
      levelNodes = levelNodes.filter(n => visibleIds.has(n.id));
    }
    if (levelNodes.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: parentId ? '16px' : '0', borderLeft: parentId ? '1px dashed var(--glass-border)' : 'none' }}>
        {levelNodes.map(node => {
          const isDirectMatch = searchQuery.trim() && (
            (node.text || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
            (node.nomenklatur || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
            (node.sasaran || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
            (node.indicators && node.indicators.some(ind => 
              (ind.indikator || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
            ))
          );

          return (
            <div 
              key={node.id} 
              className={`tree-node ${isDirectMatch ? 'matched-node' : ''}`} 
              style={{ 
                background: isDirectMatch ? 'rgba(255, 107, 0, 0.12)' : 'rgba(255, 255, 255, 0.02)', 
                padding: '12px', 
                borderRadius: '8px', 
                border: isDirectMatch ? '2px solid var(--primary-orange)' : '1px solid var(--glass-border)',
                boxShadow: isDirectMatch ? '0 0 15px rgba(255, 107, 0, 0.25)' : 'none',
                transition: 'all 0.3s ease'
              }}
            >
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
                          • Indikator: <strong>{ind.indikator}</strong> | Target Rencana {tahun}: <strong>{ind.target} {ind.satuan}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted" style={{ marginTop: '6px', fontSize: '11px', fontStyle: 'italic' }}>
                      Belum ada indikator.
                    </p>
                  )}

                  <div style={{ marginTop: '6px', fontSize: '12px' }}>
                    {node.level === 'sasaran_subkegiatan' || node.level === 'subkegiatan' ? (
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <span style={{ color: 'var(--success)' }}>
                          Anggaran Renja: <strong>{formatCurrency(node.anggaran || 0)}</strong>
                        </span>
                        <span style={{ color: 'var(--info)' }}>
                          Anggaran DPA: <strong>{formatCurrency(node.anggaranDpa || 0)}</strong>
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <span style={{ color: 'var(--success)' }}>
                          Anggaran Renja Akumulasi: <strong>{formatCurrency(calculateNodeBudget(node.id, 'Renja'))}</strong>
                        </span>
                        <span style={{ color: 'var(--info)' }}>
                          Anggaran DPA Akumulasi: <strong>{formatCurrency(calculateNodeBudget(node.id, 'DPA'))}</strong>
                        </span>
                      </div>
                    )}
                  </div>

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
                  <button 
                    className="btn btn-sm btn-secondary" 
                    style={{ padding: '3px 8px', fontSize: '10px', width: 'auto', background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)' }}
                    onClick={() => openEditModal(node)}
                  >
                    Edit
                  </button>
                </div>
              </div>
              {renderTreeNodes(node.id)}
            </div>
          );
        })}
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
        {levelNodes.map(node => {
          const isDirectMatch = searchQuery.trim() && (
            (node.text || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
            (node.nomenklatur || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
            (node.sasaran || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
            (node.indicators && node.indicators.some(ind => 
              (ind.indikator || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
            ))
          );

          return (
            <li key={node.id}>
              <div 
                className={`org-chart-node org-node-box ${isDirectMatch ? 'matched-node' : ''}`} 
                style={{
                  border: isDirectMatch ? '3px solid var(--primary-orange)' : `2px solid ${levelColors[node.level] || '#ccc'}`,
                  padding: '10px',
                  borderRadius: '8px',
                  boxShadow: isDirectMatch ? '0 0 15px rgba(255, 107, 0, 0.45)' : '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                  background: isDirectMatch ? 'rgba(255, 107, 0, 0.12)' : undefined,
                  minWidth: '160px',
                  maxWidth: '240px',
                  textAlign: 'center',
                  display: 'inline-block',
                  position: 'relative',
                  transition: 'all 0.3s ease'
                }}
              >
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
                        • {ind.indikator} (Target: {ind.target} {ind.satuan})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {renderOrgChartTree(node.id)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section>
      <div className="glass-panel print-exclude" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 'bold' }}>Tahun Rencana Aktif:</span>
          <span className="badge badge-score" style={{ background: 'var(--primary-orange)', color: 'white', padding: '6px 12px', fontSize: '13px' }}>
            {activeYear}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-orange" 
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={handleSyncFromRenstra}
          >
            <i className="fa-solid fa-sync"></i> Sinkronisasi dari Renstra
          </button>
          <button 
            className="btn btn-orange" 
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: '#059669', borderColor: '#059669' }}
            onClick={() => {
              setImportDpaError('');
              setImportDpaSuccess('');
              setShowDpaImportModal(true);
            }}
          >
            <i className="fa-solid fa-file-excel"></i> Impor Excel DPA
          </button>
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
        </div>
      </div>

      {error && <div className="glass-panel" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '15px', marginBottom: '20px' }}>{error}</div>}
      {success && <div className="glass-panel" style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '15px', marginBottom: '20px' }}>{success}</div>}

      <div className="glass-panel" style={{ width: '100%' }}>
        <div className="panel-header justify-between">
          <h3><i className="fa-solid fa-network-wired text-orange"></i> Struktur Indikator Renja {tahun}</h3>
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
                <p>Belum ada data Indikator Renja tahun {tahun}. Klik &quot;Sinkronisasi dari Renstra&quot; untuk memulai.</p>
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
                      <p>Belum ada data Indikator Renja.</p>
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

      {/* Edit Modal */}
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
                Edit Sasaran & Target Kinerja Tahunan
              </h3>
              <button onClick={() => setShowFormModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>
            
            <div className="panel-body" style={{ padding: '20px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group mb-3">
                <label>Level Cascading</label>
                <input type="text" className="form-control" value={levelLabels[level] || level} disabled style={{ background: 'rgba(255,255,255,0.05)' }} />
              </div>

              {nomenklatur && (
                <div className="form-group mb-3">
                  <label>Nomenklatur</label>
                  <input type="text" className="form-control" value={nomenklatur} disabled style={{ background: 'rgba(255,255,255,0.05)' }} />
                </div>
              )}

              <div className="form-group mb-3">
                <label>Uraian Sasaran</label>
                <textarea className="form-control" rows="2" value={text} disabled style={{ background: 'rgba(255,255,255,0.05)' }} />
              </div>

              {/* Ringkasan Data Master Subkegiatan (otomatis dari kamus data) */}
              {level === 'sasaran_subkegiatan' && selectedMasterId && (() => {
                const selectedMaster = masterSubkegiatans.find(s => s.id === selectedMasterId);
                if (!selectedMaster) return null;
                return (
                  <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', color: '#34D399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-database"></i> Data dari Kamus Master
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Sasaran (Kinerja)</span>
                        <div style={{ fontSize: '13px', color: '#f3f4f6', fontWeight: 600, marginTop: '2px' }}>
                          {selectedMaster.kinerja || selectedMaster.nama}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Indikator</span>
                          <div style={{ fontSize: '13px', color: '#f3f4f6', fontWeight: 600, marginTop: '2px' }}>
                            {selectedMaster.indikator || '-'}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Satuan</span>
                          <div style={{ fontSize: '13px', color: '#f3f4f6', fontWeight: 600, marginTop: '2px' }}>
                            {selectedMaster.satuan || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Budgets for subkegiatan */}
              {level === 'sasaran_subkegiatan' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255, 107, 0, 0.05)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--primary-orange)' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: 600, color: 'var(--success)' }}>Anggaran Renja (Rupiah)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={anggaran}
                      onChange={(e) => setAnggaran(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: 600, color: 'var(--info)' }}>Anggaran DPA (Rupiah)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={anggaranDpa}
                      onChange={(e) => setAnggaranDpa(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Edit Targets of indicators for this year */}
              {tempIndicators.length > 0 && (
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', marginTop: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--primary-orange)' }}>
                    Edit Target Kinerja Tahunan
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {tempIndicators.map((ind, idx) => (
                      <div key={ind.id || idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{ind.indikator}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div className="form-group">
                            <label style={{ fontSize: '10px', margin: 0 }}>Target</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              style={{ padding: '4px 8px', fontSize: '12px' }} 
                              value={ind.target} 
                              onChange={(e) => handleTempIndicatorTargetChange(idx, e.target.value)} 
                            />
                          </div>
                          <div className="form-group">
                            <label style={{ fontSize: '10px', margin: 0 }}>Satuan</label>
                            <input type="text" className="form-control" style={{ padding: '4px 8px', fontSize: '12px', background: 'rgba(0,0,0,0.2)' }} value={ind.satuan} disabled />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-cutting options if >1 bidang selected */}
              {selectedBidangs.length > 1 && (
                <div className="form-group mb-3" style={{ background: 'rgba(255, 107, 0, 0.05)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255, 107, 0, 0.2)' }}>
                  <label style={{ fontWeight: 'bold', color: 'var(--primary-orange)', display: 'block', marginBottom: '8px' }}>
                    <i className="fa-solid fa-people-group mr-2"></i> Kolaborasi Cross-cutting
                  </label>
                  <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                      <input 
                        type="radio" 
                        name="crossCutting" 
                        checked={crossCuttingType === 'bersama'} 
                        onChange={() => {
                          setCrossCuttingType('bersama');
                          if (!selectedBidang && selectedBidangs.length > 0) {
                            setSelectedBidang(selectedBidangs[0]);
                          }
                        }} 
                      />
                      Bersama (Joint)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                      <input 
                        type="radio" 
                        name="crossCutting" 
                        checked={crossCuttingType === 'digabung'} 
                        onChange={() => {
                          setCrossCuttingType('digabung');
                          setSelectedBidang(null);
                        }} 
                      />
                      Digabung (Combined)
                    </label>
                  </div>

                  {crossCuttingType === 'bersama' && (
                    <div className="form-group mb-0" style={{ marginTop: '10px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>
                        Bidang Penanggung Jawab Utama
                      </label>
                      {(() => {
                        const isProgram = level === 'program' || level === 'sasaran_program';
                        const canEdit = isProgram 
                          ? (activeRole === 'admin' || activeRole === 'perencana')
                          : (activeRole === 'admin' || activeRole === 'perencana' || activeRole === 'admin_bidang');
                        
                        return (
                          <select
                            className="form-control"
                            style={{ padding: '6px 10px', fontSize: '12.5px', background: 'var(--glass-bg)', color: 'white', borderColor: 'var(--glass-border)' }}
                            value={selectedBidang || ''}
                            disabled={!canEdit}
                            onChange={(e) => setSelectedBidang(e.target.value || null)}
                          >
                            <option value="">-- Pilih Bidang Penanggung Jawab Utama --</option>
                            {selectedBidangs.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        );
                      })()}
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        * Level Program diatur oleh Admin Perencana. Level Kegiatan, Subkegiatan, & Aktivitas diatur oleh Admin Unit Kerja.
                      </span>
                    </div>
                  )}

                  {crossCuttingType === 'digabung' && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Bagi porsi target ke masing-masing bidang pengampu:</p>
                      {selectedBidangs.map(bidang => (
                        <div key={bidang} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'white' }}>{bidang}</span>
                          <input
                            type="text"
                            className="form-control"
                            style={{ width: '80px', padding: '4px 8px', fontSize: '12px', textAlign: 'right' }}
                            value={splitTargets[bidang] || ''}
                            onChange={(e) => handleSplitTargetChange(bidang, e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bidang Pengampu (ReadOnly) */}
              {['tujuan', 'sasaran', 'sasaran_strategis'].includes(level) ? (
                <div className="form-group mb-3">
                  <label>Bidang Pengampu</label>
                  <div className="alert-sim info" style={{ padding: '10px', fontSize: '12px' }}>
                    <i className="fa-solid fa-circle-info mr-2"></i>
                    Dikelola oleh Pimpinan / Eselon II (Otomatis)
                  </div>
                </div>
              ) : ['sasaran_program', 'sasaran_kegiatan', 'program', 'kegiatan'].includes(level) || (['sasaran_subkegiatan', 'subkegiatan'].includes(level) && (formId ? nodes.some(n => n.parentId === formId) : false)) ? (
                <div className="form-group mb-3">
                  <label>Bidang Pengampu (Otomatis)</label>
                  <div className="alert-sim info" style={{ padding: '10px', fontSize: '12px', marginBottom: '8px' }}>
                    <i className="fa-solid fa-diagram-project mr-2"></i>
                    Diakumulasi secara bottom-up dari Aktivitas di bawahnya.
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {selectedBidangs.map(b => (
                      <span key={b} className="badge badge-draft">{b}</span>
                    ))}
                    {selectedBidangs.length === 0 && <span className="text-muted">-</span>}
                  </div>
                </div>
              ) : (
                <div className="form-group mb-3">
                  <label>Bidang Pengampu (Diwarisi dari Renstra)</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {selectedBidangs.map(b => (
                      <span key={b} className="badge badge-draft">{b}</span>
                    ))}
                    {selectedBidangs.length === 0 && <span className="text-muted">-</span>}
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

      {/* DPA Excel Import Modal */}
      {showDpaImportModal && (
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
            border: '1px solid rgba(5,150,105,0.4)'
          }}>
            <div className="panel-header justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <h3>
                <i className="fa-solid fa-file-excel text-success"></i> Impor Anggaran DPA Tahunan
              </h3>
              <button onClick={() => setShowDpaImportModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>

            <form onSubmit={handleDpaImportSubmit}>
              <div className="panel-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {importDpaError && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>{importDpaError}</div>}
                {importDpaSuccess && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>{importDpaSuccess}</div>}

                <p style={{ fontSize: '13px', lineHeight: '1.4', color: 'var(--text-muted)' }}>
                  Unggah berkas Excel DPA untuk memperbarui kolom <strong>Anggaran DPA</strong> pada subkegiatan secara massal. Sistem akan mencocokkan subkegiatan berdasarkan nama nomenklaturnya.
                </p>

                <div className="form-group">
                  <label>Tahun Anggaran DPA</label>
                  <input type="text" className="form-control" value={tahun} disabled style={{ background: 'rgba(255,255,255,0.05)', fontWeight: 'bold' }} />
                </div>

                <div className="form-group">
                  <label>Pilih File Excel DPA (.xlsx / .xls)</label>
                  <input 
                    type="file" 
                    className="form-control" 
                    accept=".xlsx, .xls"
                    onChange={(e) => setDpaFile(e.target.files[0])}
                    required
                  />
                </div>
              </div>

              <div className="panel-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDpaImportModal(false)} disabled={uploadingDpa} style={{ width: 'auto' }}>Batal</button>
                <button 
                  type="submit" 
                  className="btn btn-orange" 
                  disabled={uploadingDpa} 
                  style={{ width: 'auto', background: '#059669', borderColor: '#059669' }}
                >
                  {uploadingDpa ? 'Mengunggah...' : 'Impor Sekarang'}
                </button>
              </div>
            </form>
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
            MATRIKS CASCADING KINERJA TAHUNAN (RENJA)
          </h3>
          <p style={{ textAlign: 'center', fontSize: '12px', margin: '0 0 20px 0' }}>TAHUN RENCANA: {tahun}</p>

          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f2f2f2' }}>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '18%' }}>Tujuan Strategis</th>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '18%' }}>Sasaran Strategis</th>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '18%' }}>Sasaran Program</th>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '18%' }}>Sasaran Kegiatan</th>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '20%' }}>Subkegiatan</th>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '8%' }}>Bidang Pengampu</th>
              </tr>
            </thead>
            <tbody>
              {getFlatPathsAnnual().length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '10px' }}>Tidak ada data</td>
                </tr>
              ) : (
                getFlatPathsAnnual().map((path, idx) => {
                  return (
                    <tr key={idx}>
                      {/* Tujuan */}
                      <td style={{ border: '1px solid black', padding: '6px', fontSize: '11px', verticalAlign: 'top' }}>
                        {path.tujuan && (
                          <>
                            <div style={{ fontWeight: 'bold' }}>{path.tujuan.text}</div>
                            {path.tujuan.indicators && path.tujuan.indicators.map((ind, i) => (
                              <div key={i} style={{ fontSize: '10px', color: '#333', marginTop: '4px' }}>
                                • {ind.indikator} (Target: {ind.target} {ind.satuan})
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
                                • {ind.indikator} (Target: {ind.target} {ind.satuan})
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
                                • {ind.indikator} (Target: {ind.target} {ind.satuan})
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
                                • {ind.indikator} (Target: {ind.target} {ind.satuan})
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
                                • {ind.indikator} (Target: {ind.target} {ind.satuan})
                              </div>
                            ))}
                            <div style={{ fontSize: '10px', color: 'green', marginTop: '4px' }}>
                              Anggaran Renja: {formatCurrency(path.sasaran_subkegiatan.anggaran || 0)}<br />
                              Anggaran DPA: {formatCurrency(path.sasaran_subkegiatan.anggaranDpa || 0)}
                            </div>
                          </>
                        )}
                        {path.sasaran_aktivitas && (
                          <div style={{ fontSize: '9px', color: '#555', marginTop: '4px', paddingLeft: '8px', borderLeft: '1px dashed #aaa' }}>
                            Aktivitas: <strong>{path.sasaran_aktivitas.text}</strong> ({path.sasaran_aktivitas.nomenklatur})
                            {path.sasaran_aktivitas.indicators && path.sasaran_aktivitas.indicators.map((ind, i) => (
                              <div key={i} style={{ fontSize: '8px', color: '#666' }}>
                                - {ind.indikator} (Target: {ind.target} {ind.satuan})
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
      {confirmMessage && (
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
            maxWidth: '450px',
            width: '100%',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '16px' }}>
              <i className="fa-solid fa-circle-question text-info" style={{ fontSize: '48px' }}></i>
            </div>
            <h4 style={{ fontWeight: 600, marginBottom: '12px' }}>Konfirmasi Tindakan</h4>
            <p style={{ fontSize: '14px', lineHeight: '1.4', marginBottom: '24px', color: 'var(--text-muted)' }}>
              {confirmMessage}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleConfirmNo}>
                Batal
              </button>
              <button type="button" className="btn btn-orange" style={{ flex: 1 }} onClick={handleConfirmYes}>
                Ya, Lanjutkan
              </button>
            </div>
          </div>
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
            DIAGRAM POHON KINERJA (RENJA)
          </h3>
          <p style={{ textAlign: 'center', fontSize: '12px', margin: '0 0 20px 0' }}>TAHUN {tahun}</p>

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
