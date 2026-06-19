'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef } from 'react';
import { useSimulation } from '@/context/SimulationContext';
import { formatIndonesianInput, parseToStandardNumber, formatNumberForDisplay } from '@/utils/numberFormat';

export default function AdminCascading5YearsPage() {
  const { fetchWithAuth, activeRole, activeBidang, refreshMetadata } = useSimulation();

  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [hasAktivitasPlan, setHasAktivitasPlan] = useState(false);
  
  // Cross-cutting states
  const [crossCuttingType, setCrossCuttingType] = useState('bersama');
  const [splitTargets, setSplitTargets] = useState({}); 
  const [selectedBidang, setSelectedBidang] = useState(null);

  // Budget (Anggaran) inputs for subkegiatan
  const [b2025, setB2025] = useState('0');
  const [b2026, setB2026] = useState('0');
  const [b2027, setB2027] = useState('0');
  const [b2028, setB2028] = useState('0');
  const [b2029, setB2029] = useState('0');
  const [b2030, setB2030] = useState('0');
  const [budgetAkhir, setBudgetAkhir] = useState('0');

  // Target Kinerja Indikator per tahun (khusus sasaran_subkegiatan)
  const [t2025, setT2025] = useState('0');
  const [t2026, setT2026] = useState('0');
  const [t2027, setT2027] = useState('0');
  const [t2028, setT2028] = useState('0');
  const [t2029, setT2029] = useState('0');
  const [t2030, setT2030] = useState('0');
  const [tAkhir, setTAkhir] = useState('0');
  const [subkegiatanTipeTarget, setSubkegiatanTipeTarget] = useState('Kondisi Akhir Naik');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const searchInputRef = useRef(null);

  // Custom autocomplete search dropdown states for master data
  const [masterSearchQuery, setMasterSearchQuery] = useState('');
  const [isMasterDropdownOpen, setIsMasterDropdownOpen] = useState(false);
  const masterDropdownRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showImportExcelModal, setShowImportExcelModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [printMode, setPrintMode] = useState('tree'); 
  const [viewMode, setViewMode] = useState('list'); // list or orgchart

  // Indicator Management Modal states
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [selectedNodeForIndicators, setSelectedNodeForIndicators] = useState(null);
  const [tempIndicators, setTempIndicators] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

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

  const loadMasterData = async () => {
    try {
      const [mpRes, mkRes, mskRes] = await Promise.all([
        fetchWithAuth('/api/master/program'),
        fetchWithAuth('/api/master/kegiatan'),
        fetchWithAuth('/api/master/subkegiatan')
      ]);
      
      if (mpRes.ok) setMasterPrograms(await mpRes.json());
      if (mkRes.ok) setMasterKegiatans(await mkRes.json());
      if (mskRes.ok) setMasterSubkegiatans(await mskRes.json());
    } catch (e) {
      console.error('Failed to load master data', e);
    }
  };

  const loadTreeData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetchWithAuth('/api/cascading5years');
      if (res.ok) setNodes(await res.json());
    } catch (e) {
      console.error('Failed to load cascading tree data', e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    const initLoad = async () => {
      setLoading(true);
      await Promise.all([
        loadTreeData(true),
        loadMasterData()
      ]);
      setLoading(false);
    };
    initLoad();
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

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      showAlert('Pilih file Excel terlebih dahulu.', 'error');
      return;
    }

    setIsImporting(true);
    setImportReport(null);

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const res = await fetchWithAuth('/api/admin/cascading5years/import', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Terjadi kesalahan saat mengunggah.');
      }

      const result = await res.json();
      if (result.success === false) {
        setImportReport(result);
      } else {
        setImportReport({
          success: true,
          successCount: result.successCount,
          failCount: 0,
          errors: []
        });
        setImportFile(null);
        await loadTreeData();
      }
    } catch (err) {
      setImportReport({
        success: false,
        successCount: 0,
        failCount: 1,
        errors: [{ row: '-', level: 'General', nomenklatur: '-', reason: err.message }]
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Auto calculate Budget Akhir (always the sum of 2025-2030 budgets)
  useEffect(() => {
    const val2025 = parseFloat(parseToStandardNumber(b2025)) || 0;
    const val2026 = parseFloat(parseToStandardNumber(b2026)) || 0;
    const val2027 = parseFloat(parseToStandardNumber(b2027)) || 0;
    const val2028 = parseFloat(parseToStandardNumber(b2028)) || 0;
    const val2029 = parseFloat(parseToStandardNumber(b2029)) || 0;
    const val2030 = parseFloat(parseToStandardNumber(b2030)) || 0;
    const sum = val2025 + val2026 + val2027 + val2028 + val2029 + val2030;
    setBudgetAkhir(sum.toString());
  }, [b2025, b2026, b2027, b2028, b2029, b2030]);

  // Auto calculate Target Akhir based on tipeTarget and yearly targets
  useEffect(() => {
    const val2025 = parseFloat(parseToStandardNumber(t2025)) || 0;
    const val2026 = parseFloat(parseToStandardNumber(t2026)) || 0;
    const val2027 = parseFloat(parseToStandardNumber(t2027)) || 0;
    const val2028 = parseFloat(parseToStandardNumber(t2028)) || 0;
    const val2029 = parseFloat(parseToStandardNumber(t2029)) || 0;
    const val2030 = parseFloat(parseToStandardNumber(t2030)) || 0;

    if (subkegiatanTipeTarget === 'Akumulatif') {
      const sum = val2025 + val2026 + val2027 + val2028 + val2029 + val2030;
      setTAkhir(formatNumberForDisplay(sum.toString()));
    } else {
      setTAkhir(formatNumberForDisplay(val2030.toString()));
    }
  }, [t2025, t2026, t2027, t2028, t2029, t2030, subkegiatanTipeTarget]);

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
      setText('');
      setSasaran('');
      setNomenklatur('');
      setSelectedMasterId('');
    }
  }, [level, isEditing]);

  // Inherit bidang from parent automatically (single source of truth)
  // DELETED: Bottom-Up architecture means parents inherit from children, not vice versa.

  // Synchronize masterSearchQuery when selectedMasterId changes or level changes
  useEffect(() => {
    if (selectedMasterId) {
      let foundName = '';
      if (level === 'sasaran_program') {
        const item = masterPrograms.find(p => p.id === selectedMasterId);
        if (item) foundName = item.nama;
      } else if (level === 'sasaran_kegiatan') {
        const item = masterKegiatans.find(k => k.id === selectedMasterId);
        if (item) foundName = item.nama;
      } else if (level === 'sasaran_subkegiatan') {
        const item = masterSubkegiatans.find(s => s.id === selectedMasterId);
        if (item) foundName = item.nama;
      }
      setMasterSearchQuery(foundName || nomenklatur || '');
    } else {
      setMasterSearchQuery('');
    }
  }, [selectedMasterId, level, masterPrograms, masterKegiatans, masterSubkegiatans, nomenklatur]);

  // Close searchable dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (masterDropdownRef.current && !masterDropdownRef.current.contains(event.target)) {
        setIsMasterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset printMode back to 'tree' after printing is completed or cancelled
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintMode('tree');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Reset activeMatchIndex when searchQuery changes
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery]);

  // Smooth scroll search matches into view
  useEffect(() => {
    if (searchQuery.trim()) {
      const timer = setTimeout(() => {
        const matches = document.querySelectorAll('.matched-node');
        if (matches.length > 0) {
          const index = activeMatchIndex % matches.length;
          if (matches[index]) {
            matches[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, activeMatchIndex]);

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

    const hasChildren = formId ? nodes.some(n => n.parentId === formId) : false;

    if (level === 'sasaran_aktivitas' && selectedBidangs.length === 0) {
      setError('Pilih minimal satu bidang pengampu untuk Aktivitas ini.');
      return;
    }

    if (level === 'sasaran_subkegiatan' && !hasAktivitasPlan && selectedBidangs.length === 0) {
      setError('Pilih minimal satu bidang pengampu untuk Subkegiatan ini.');
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
        // Pertahankan data indicator yang sudah ada (jika editing), update target saja
        const existingInd = nodeIndicators.find(ind => ind.id === `ind_master_${selectedMasterId}` || ind.id === `ind_mig_${formId}`) || nodeIndicators[0];
        nodeIndicators = [{
          id: existingInd?.id || `ind_master_${selectedMasterId}`,
          indikator: item.indikator || '-',
          satuan: item.satuan || '-',
          tipeTarget: subkegiatanTipeTarget,
          target2025: parseToStandardNumber(t2025),
          target2026: parseToStandardNumber(t2026),
          target2027: parseToStandardNumber(t2027),
          target2028: parseToStandardNumber(t2028),
          target2029: parseToStandardNumber(t2029),
          target2030: parseToStandardNumber(t2030),
          targetAkhir: parseToStandardNumber(tAkhir),
          definisiOperasional: existingInd?.definisiOperasional || '',
          metodePenghitungan: existingInd?.metodePenghitungan || 'Jumlah',
          variabelJumlah: existingInd?.variabelJumlah || '',
          variabelPembilang: existingInd?.variabelPembilang || '',
          variabelPenyebut: existingInd?.variabelPenyebut || ''
        }];
      }
    }

    const payload = {
      id: formId,
      level,
      text,
      indikator: '-',
      satuan: '-',
      tipeTarget: level === 'sasaran_subkegiatan' ? subkegiatanTipeTarget : 'Kondisi Akhir Naik',
      parentId: level === 'tujuan' ? null : parentId,
      bidangPengampu: (level === 'sasaran_subkegiatan' && hasAktivitasPlan) ? [] : selectedBidangs,
      crossCuttingType,
      selectedBidang,
      splitTargets,
      anggaran2025: level === 'sasaran_subkegiatan' ? parseToStandardNumber(b2025) : '0',
      anggaran2026: level === 'sasaran_subkegiatan' ? parseToStandardNumber(b2026) : '0',
      anggaran2027: level === 'sasaran_subkegiatan' ? parseToStandardNumber(b2027) : '0',
      anggaran2028: level === 'sasaran_subkegiatan' ? parseToStandardNumber(b2028) : '0',
      anggaran2029: level === 'sasaran_subkegiatan' ? parseToStandardNumber(b2029) : '0',
      anggaran2030: level === 'sasaran_subkegiatan' ? parseToStandardNumber(b2030) : '0',
      anggaranAkhir: level === 'sasaran_subkegiatan' ? parseToStandardNumber(budgetAkhir) : '0',
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
        const itemType = levelLabels[level] || level;
        const itemName = level === 'sasaran_subkegiatan' ? nomenklatur : text;
        setSuccess(`Berhasil menyimpan ${itemType}: "${itemName}".`);
        resetForm();
        loadTreeData(true);
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
    setHasAktivitasPlan(nodes.some(n => n.parentId === node.id));
    
    let cType = node.crossCuttingType || 'bersama';
    if (cType === 'shared') cType = 'bersama';
    if (cType === 'split') cType = 'digabung';
    setCrossCuttingType(cType);
    
    setSplitTargets(node.splitTargets || {});
    setSelectedBidang(node.selectedBidang || null);
    
    setB2025(formatNumberForDisplay(node.anggaran2025 || '0'));
    setB2026(formatNumberForDisplay(node.anggaran2026 || '0'));
    setB2027(formatNumberForDisplay(node.anggaran2027 || '0'));
    setB2028(formatNumberForDisplay(node.anggaran2028 || '0'));
    setB2029(formatNumberForDisplay(node.anggaran2029 || '0'));
    setB2030(formatNumberForDisplay(node.anggaran2030 || '0'));

    // Load target kinerja dari indicator pertama (subkegiatan hanya punya 1 indikator)
    const firstInd = node.indicators && node.indicators.length > 0 ? node.indicators[0] : {};
    setSubkegiatanTipeTarget(firstInd.tipeTarget || 'Kondisi Akhir Naik');
    setT2025(formatNumberForDisplay(firstInd.target2025 || '0'));
    setT2026(formatNumberForDisplay(firstInd.target2026 || '0'));
    setT2027(formatNumberForDisplay(firstInd.target2027 || '0'));
    setT2028(formatNumberForDisplay(firstInd.target2028 || '0'));
    setT2029(formatNumberForDisplay(firstInd.target2029 || '0'));
    setT2030(formatNumberForDisplay(firstInd.target2030 || '0'));
    setTAkhir(formatNumberForDisplay(firstInd.targetAkhir || '0'));
  };

  const resetForm = (targetLevel = 'tujuan') => {
    setIsEditing(false);
    setFormId('');
    setLevel(targetLevel);
    setParentId('');
    setText('');
    setSasaran('');
    setNomenklatur('');
    setSelectedMasterId('');
    setSelectedBidangs([]);
    setHasAktivitasPlan(false);
    setCrossCuttingType('bersama');
    setSplitTargets({});
    setSelectedBidang(null);
    
    setB2025('0');
    setB2026('0');
    setB2027('0');
    setB2028('0');
    setB2029('0');
    setB2030('0');

    setT2025('0');
    setT2026('0');
    setT2027('0');
    setT2028('0');
    setT2029('0');
    setT2030('0');
    setTAkhir('0');
    setSubkegiatanTipeTarget('Kondisi Akhir Naik');
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

  // Resolve masterId dari node, jika belum punya coba cocokkan via nomenklatur
  const resolveMasterId = (node, masterList) => {
    if (!node) return '';
    if (node.masterId) return node.masterId;
    // Fallback: cocokkan nomenklatur dengan nama di master
    if (node.nomenklatur) {
      const match = masterList.find(m => m.nama === node.nomenklatur);
      if (match) return match.id;
    }
    return '';
  };

  const getMasterOptions = () => {
    if (level === 'sasaran_program') {
      return masterPrograms;
    }
    if (level === 'sasaran_kegiatan') {
      const parentNode = nodes.find(n => n.id === parentId);
      const parentProgMasterId = resolveMasterId(parentNode, masterPrograms);
      // Filter kegiatan sesuai kode program parent
      return masterKegiatans.filter(k => !parentProgMasterId || k.programId === parentProgMasterId);
    }
    if (level === 'sasaran_subkegiatan') {
      const parentNode = nodes.find(n => n.id === parentId);
      let parentKegMasterId = resolveMasterId(parentNode, masterKegiatans);
      
      // Jika masih kosong, coba naik ke grandparent (sasaran_program) lalu cari kegiatan dari program itu
      if (!parentKegMasterId && parentNode) {
        const grandparentNode = nodes.find(n => n.id === parentNode.parentId);
        const grandparentProgMasterId = resolveMasterId(grandparentNode, masterPrograms);
        if (grandparentProgMasterId) {
          // Cari semua kegiatan di bawah program tersebut, lalu ambil subkegiatannya
          const kegIds = masterKegiatans.filter(k => k.programId === grandparentProgMasterId).map(k => k.id);
          
          const usedMasterIds = nodes
            .filter(n => n.level === 'sasaran_subkegiatan' && n.id !== formId)
            .map(n => n.masterId);

          return masterSubkegiatans.filter(s => 
            kegIds.includes(s.kegiatanId) && !usedMasterIds.includes(s.id)
          );
        }
      }
      
      // Filter subkegiatan sesuai kode kegiatan parent
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

      const parentNode = parentId ? nodes.find(n => n.id === parentId) : null;
      const isParentKegiatan = parentNode && parentNode.level === 'sasaran_kegiatan';
      let html = isParentKegiatan ? '<ul class="vertical-layout">' : '<ul>';
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
                • ${ind.indikator} (${ind.targetAkhir} ${ind.satuan} | ${ind.tipeTarget || 'Kondisi Akhir Naik'})
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
          
          /* Vertical layout for print */
          .org-chart ul.vertical-layout {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding-top: 0;
          }
          .org-chart ul.vertical-layout::before {
            display: none;
          }
          .org-chart ul.vertical-layout > li {
            padding: 24px 0 0 0;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .org-chart ul.vertical-layout > li::before {
            content: '';
            position: absolute;
            top: 0;
            bottom: 0;
            left: 50%;
            border-left: 2px solid #64748b;
            width: 0;
            transform: translateX(-50%);
            z-index: 1;
            display: block;
          }
          .org-chart ul.vertical-layout > li::after {
            display: none;
          }
          .org-chart ul.vertical-layout > li:last-child::before {
            bottom: auto;
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
            z-index: 2;
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
    const defaultLevel = targetLevel || (parentNode ? (getValidChildLevels(parentNode.level)[0] || 'tujuan') : 'tujuan');
    resetForm(defaultLevel);
    if (parentNode) {
      setParentId(parentNode.id);
      setSelectedBidangs(parentNode.bidangPengampu || []);
    } else {
      setParentId('');
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
        loadTreeData(true);
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
    
    // Auto calculate targetAkhir ONLY if yearly targets or tipeTarget are changed
    if (['target2025', 'target2026', 'target2027', 'target2028', 'target2029', 'target2030', 'tipeTarget'].includes(field)) {
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
    }
    
    setTempIndicators(updated);
  };

  const removeTempIndicator = (index) => {
    setTempIndicators(tempIndicators.filter((_, i) => i !== index));
  };

  const handleIndicatorDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
    setDraggedIndex(index);
  };

  const handleIndicatorDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleIndicatorDrop = (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const updated = [...tempIndicators];
    const [removed] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, removed);
    
    // Assign order values
    const reordered = updated.map((ind, i) => ({
      ...ind,
      order: i
    }));
    setTempIndicators(reordered);
    setDraggedIndex(null);
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
        const indNames = tempIndicators.map(i => `"${i.indikator}"`).join(', ');
        const nodeName = selectedNodeForIndicators.nomenklatur || selectedNodeForIndicators.text || selectedNodeForIndicators.sasaran || '';
        setSuccess(`Daftar indikator [ ${indNames} ] untuk "${nodeName}" berhasil diperbarui.`);
        setShowIndicatorModal(false);
        loadTreeData(true);
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
                  
                  {node.level !== 'tujuan' && node.level !== 'sasaran' && node.bidangPengampu && node.bidangPengampu.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {node.bidangPengampu.map(bidang => (
                        <span key={bidang} className="badge badge-draft" style={{ fontSize: '9px', padding: '2px 6px' }}>
                          {bidang}
                        </span>
                      ))}
                    </div>
                  )}

                  {node.level === 'sasaran_subkegiatan' && node.definisiOperasional && (
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '8px 12px', borderRadius: '6px', marginTop: '8px', fontSize: '11.5px' }}>
                      <span style={{ color: 'var(--primary-orange)', fontWeight: 'bold' }}>Definisi Operasional:</span> {node.definisiOperasional}
                    </div>
                  )}

                  {node.indicators && node.indicators.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                      {node.indicators.map((ind, i) => (
                        <div key={ind.id || i} style={{ background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '6px', borderLeft: '3px solid var(--primary-orange)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                            <div>
                              <strong>{ind.indikator}</strong> (Target Akhir: {ind.targetAkhir} {ind.satuan} | Tipe: {ind.tipeTarget || 'Kondisi Akhir Naik'})
                            </div>
                            {ind.definisiOperasional && (
                              <button 
                                type="button" 
                                className="btn btn-sm btn-info" 
                                style={{ width: 'auto', padding: '1px 6px', fontSize: '9px', height: '18px', display: 'flex', alignItems: 'center' }}
                                onClick={() => openIndicatorOpDefDetail(ind)}
                              >
                                Detail DefOp
                              </button>
                            )}
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginTop: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '4px' }}>
                            {['2025', '2026', '2027', '2028', '2029', '2030'].map(yr => (
                              <div key={yr} style={{ textAlign: 'center', fontSize: '9.5px' }}>
                                <div className="text-muted">{yr}</div>
                                <div style={{ color: 'white', fontWeight: 'bold' }}>{ind[`target${yr}`] || '0'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="tree-node-actions" style={{ display: 'flex', gap: '6px', alignSelf: 'flex-start', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '300px' }}>
                  {node.level !== 'sasaran_subkegiatan' && (
                    <button 
                      className="btn btn-sm btn-info" 
                      style={{ padding: '3px 8px', fontSize: '10px', width: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => openIndicatorModal(node)}
                    >
                      <i className="fa-solid fa-list-check"></i> Indikator
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

    const parentNode = parentId ? nodes.find(n => n.id === parentId) : null;
    const isParentKegiatan = parentNode && parentNode.level === 'sasaran_kegiatan';

    return (
      <ul className={isParentKegiatan ? 'vertical-layout' : ''}>
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
                        • {ind.indikator} ({ind.targetAkhir} {ind.satuan} | {ind.tipeTarget || 'Kondisi Akhir Naik'})
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons for editing directly in chart mode */}
                <div className="org-node-actions print-exclude" style={{ 
                  marginTop: '8px', 
                  borderTop: '1px dashed rgba(255,255,255,0.15)', 
                  paddingTop: '6px', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: '4px',
                  flexWrap: 'wrap'
                }}>
                  {node.level !== 'sasaran_subkegiatan' && (
                    <button 
                      type="button"
                      className="btn btn-sm btn-info"
                      style={{ padding: '2px 4px', fontSize: '8px', width: 'auto', height: '18px', display: 'flex', alignItems: 'center' }}
                      title="Indikator"
                      onClick={(e) => {
                        e.stopPropagation();
                        openIndicatorModal(node);
                      }}
                    >
                      <i className="fa-solid fa-list-check"></i>
                    </button>
                  )}
                  {getValidChildLevels(node.level).map(childLvl => (
                    <button 
                      key={childLvl}
                      type="button"
                      className="btn btn-sm btn-orange"
                      style={{ padding: '2px 4px', fontSize: '8px', width: 'auto', height: '18px', display: 'flex', alignItems: 'center' }}
                      title={getChildButtonLabel(childLvl)}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddModal(node, childLvl);
                      }}
                    >
                      <i className="fa-solid fa-plus-circle"></i>
                    </button>
                  ))}
                  <button 
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ padding: '2px 4px', fontSize: '8px', width: 'auto', height: '18px', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)' }}
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(node);
                    }}
                  >
                    <i className="fa-solid fa-edit"></i>
                  </button>
                  <button 
                    type="button"
                    className="btn btn-sm btn-danger"
                    style={{ padding: '2px 4px', fontSize: '8px', width: 'auto', height: '18px', display: 'flex', alignItems: 'center' }}
                    title="Hapus"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteConfirmModal(node);
                    }}
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
              {renderOrgChartTree(node.id)}
            </li>
          );
        })}
      </ul>
    );
  };

  const getDirectMatches = () => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return nodes.filter(node => 
      (node.text || '').toLowerCase().includes(query) ||
      (node.nomenklatur || '').toLowerCase().includes(query) ||
      (node.sasaran || '').toLowerCase().includes(query) ||
      (node.indicators && node.indicators.some(ind => 
        (ind.indikator || '').toLowerCase().includes(query)
      ))
    );
  };
  const directMatches = getDirectMatches();
  const totalMatches = directMatches.length;

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
          className="btn btn-secondary" 
          style={{ 
            width: 'auto', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            background: 'rgba(255,255,255,0.08)',
            opacity: (loading || nodes.length > 0) ? 0.5 : 1,
            cursor: (loading || nodes.length > 0) ? 'not-allowed' : 'pointer'
          }}
          onClick={() => {
            setImportReport(null);
            setImportFile(null);
            setShowImportExcelModal(true);
          }}
          disabled={loading || nodes.length > 0}
          title={nodes.length > 0 ? "Fitur import dinonaktifkan karena sudah ada data cascading di dalam sistem." : "Impor seluruh data indikator renstra dari file Excel"}
        >
          <i className="fa-solid fa-file-import"></i> Import Excel
        </button>
        <button 
          className="btn btn-orange" 
          style={{ 
            width: 'auto', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            opacity: (loading || nodes.some(n => n.level === 'tujuan')) ? 0.5 : 1,
            cursor: (loading || nodes.some(n => n.level === 'tujuan')) ? 'not-allowed' : 'pointer'
          }}
          onClick={() => openAddModal(null)}
          disabled={loading || nodes.some(n => n.level === 'tujuan')}
        >
          {loading ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i> Memuat...
            </>
          ) : (
            <>
              <i className="fa-solid fa-plus-circle"></i> Tambah Tujuan
            </>
          )}
        </button>
      </div>

      {error && <div className="glass-panel" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '15px', marginBottom: '20px' }}>{error}</div>}
      {success && <div className="glass-panel" style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '15px', marginBottom: '20px' }}>{success}</div>}

      <div className="glass-panel" style={{ width: '100%' }}>
        <div className="panel-header justify-between">
          <h3>
            <i className="fa-solid fa-folder-tree text-orange"></i> Struktur Indikator Renstra
            {loading && nodes.length > 0 && (
              <span className="badge" style={{ marginLeft: '12px', fontSize: '10px', background: 'rgba(255,107,0,0.15)', color: 'var(--primary-orange)', border: '1px solid rgba(255,107,0,0.3)', verticalAlign: 'middle', textTransform: 'none', fontWeight: 'normal' }}>
                <i className="fa-solid fa-spinner fa-spin mr-1"></i> Memperbarui data...
              </span>
            )}
          </h3>
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
                style={{ paddingLeft: '35px', paddingRight: searchQuery ? '90px' : '12px', margin: 0 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (totalMatches > 0) {
                      setActiveMatchIndex(prev => (prev + 1) % totalMatches);
                    }
                  }
                }}
                placeholder="Cari indikator, sasaran, atau nomenklatur... (Tekan '/')"
              />
              {searchQuery && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'absolute', right: '35px', top: '50%', transform: 'translateY(-50%)' }}>
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap'
                  }}>
                    {totalMatches > 0 ? `${activeMatchIndex + 1} / ${totalMatches}` : '0 hasil'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (totalMatches > 0) {
                        setActiveMatchIndex(prev => (prev + 1) % totalMatches);
                      }
                    }}
                    title="Cari berikutnya (Enter)"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                  >
                    <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px' }}></i>
                  </button>
                </div>
              )}
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
            {loading && nodes.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>
                <i className="fa-solid fa-circle-notch fa-spin fa-2x text-orange" style={{ marginBottom: '12px' }}></i>
                <p>Memuat data Indikator Renstra...</p>
              </div>
            ) : nodes.filter(n => n.parentId === null).length === 0 ? (
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
                  {loading && nodes.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>
                      <i className="fa-solid fa-circle-notch fa-spin fa-2x text-orange" style={{ marginBottom: '12px' }}></i>
                      <p>Memuat data Indikator Renstra...</p>
                    </div>
                  ) : nodes.filter(n => n.parentId === null).length === 0 ? (
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

              {/* Text / Uraian input */}
              {level !== 'sasaran_subkegiatan' && (
                <div className="form-group mb-3">
                  <label>
                    {level === 'tujuan' && 'Uraian Tujuan Strategis'}
                    {level === 'sasaran' && 'Uraian Sasaran Strategis'}
                    {level === 'sasaran_program' && 'Uraian Sasaran Program'}
                    {level === 'sasaran_kegiatan' && 'Uraian Sasaran Kegiatan'}
                    {level === 'sasaran_aktivitas' && 'Uraian Sasaran Aktivitas'}
                  </label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                    placeholder="Masukkan deskripsi..."
                  />
                </div>
              )}

               {/* Master Data Selection for Program/Kegiatan/Subkegiatan */}
              {['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan'].includes(level) && (
                <div className="form-group mb-3" style={{ background: 'rgba(255, 107, 0, 0.05)', padding: '10px', borderRadius: '8px', border: '1px dashed var(--primary-orange)' }}>
                  <label>
                    {level === 'sasaran_program' && 'Pilih Nomenklatur Program'}
                    {level === 'sasaran_kegiatan' && 'Pilih Nomenklatur Kegiatan'}
                    {level === 'sasaran_subkegiatan' && 'Pilih Nomenklatur Subkegiatan'}
                  </label>
                  <div ref={masterDropdownRef} style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                      <input
                        type="text"
                        className="form-control"
                        style={{ paddingRight: '40px' }}
                        placeholder="Ketik untuk mencari nomenklatur..."
                        value={masterSearchQuery}
                        onChange={(e) => {
                          setMasterSearchQuery(e.target.value);
                          setIsMasterDropdownOpen(true);
                          if (!e.target.value) {
                            handleMasterChange('');
                          }
                        }}
                        onFocus={() => setIsMasterDropdownOpen(true)}
                      />
                      {masterSearchQuery ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMasterSearchQuery('');
                            handleMasterChange('');
                            setIsMasterDropdownOpen(true);
                          }}
                          style={{
                            position: 'absolute',
                            right: '30px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setIsMasterDropdownOpen(!isMasterDropdownOpen)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        <i className={`fa-solid ${isMasterDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                      </button>
                    </div>

                    {isMasterDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: '#090d1a',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          zIndex: 10000,
                          marginTop: '4px'
                        }}
                      >
                        {getMasterOptions().filter(opt =>
                          opt.nama.toLowerCase().includes(masterSearchQuery.toLowerCase())
                        ).length > 0 ? (
                          getMasterOptions()
                            .filter(opt =>
                              opt.nama.toLowerCase().includes(masterSearchQuery.toLowerCase())
                            )
                            .map((opt) => (
                              <div
                                key={opt.id}
                                onClick={() => {
                                  handleMasterChange(opt.id);
                                  setMasterSearchQuery(opt.nama);
                                  setIsMasterDropdownOpen(false);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  color: 'white',
                                  background: selectedMasterId === opt.id ? 'var(--primary-orange-light)' : 'transparent',
                                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                                  transition: 'background 0.2s',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedMasterId !== opt.id) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedMasterId !== opt.id) {
                                    e.currentTarget.style.background = 'transparent';
                                  }
                                }}
                              >
                                <div style={{ fontWeight: '600' }}>{opt.nama}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Kode: {opt.kode || opt.id}</div>
                                {level === 'sasaran_subkegiatan' && (opt.kinerja || opt.indikator) && (
                                  <div style={{ fontSize: '10px', color: '#34D399', marginTop: '2px', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '3px' }}>
                                    {opt.kinerja && <div>Sasaran: {opt.kinerja}</div>}
                                    {opt.indikator && <div>Indikator: {opt.indikator} ({opt.satuan})</div>}
                                  </div>
                                )}
                              </div>
                            ))
                        ) : (
                          <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            Tidak ada data master yang cocok
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ringkasan Data Master Subkegiatan (otomatis dari kamus data) */}
              {level === 'sasaran_subkegiatan' && selectedMasterId && (() => {
                const selectedMaster = masterSubkegiatans.find(s => s.id === selectedMasterId);
                if (!selectedMaster) return null;
                return (
                  <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)', marginBottom: '0' }}>
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
              {['tujuan', 'sasaran_strategis'].includes(level) ? (
                <div className="form-group mb-3">
                  <label>Bidang Pengampu</label>
                  <div className="alert-sim info" style={{ padding: '10px', fontSize: '12px' }}>
                    <i className="fa-solid fa-circle-info mr-2"></i>
                    Otomatis dikelola oleh Pimpinan / Eselon II
                  </div>
                </div>
              ) : ['sasaran_program', 'sasaran_kegiatan'].includes(level) ? (
                <div className="form-group mb-3">
                  <label>Bidang Pengampu</label>
                  <div className="alert-sim info" style={{ padding: '10px', fontSize: '12px' }}>
                    <i className="fa-solid fa-diagram-project mr-2"></i>
                    Otomatis dikalkulasi (gabungan) berdasarkan Subkegiatan / Aktivitas di bawahnya.
                  </div>
                </div>
              ) : level === 'sasaran_subkegiatan' ? (
                <div className="form-group mb-3">
                  <label>Pengaturan Aktivitas & Pengampu</label>
                  <div style={{ background: 'rgba(15,23,42,0.4)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-muted)' }}>
                        Apakah Subkegiatan ini akan memiliki rincian Aktivitas?
                      </label>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: (formId && nodes.some(n => n.parentId === formId)) ? 'not-allowed' : 'pointer' }}>
                          <input 
                            type="radio" 
                            checked={hasAktivitasPlan} 
                            onChange={() => setHasAktivitasPlan(true)}
                            disabled={formId && nodes.some(n => n.parentId === formId)}
                          /> 
                          Ya, rincikan Aktivitas nanti
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: (formId && nodes.some(n => n.parentId === formId)) ? 'not-allowed' : 'pointer' }}>
                          <input 
                            type="radio" 
                            checked={!hasAktivitasPlan} 
                            onChange={() => setHasAktivitasPlan(false)}
                            disabled={formId && nodes.some(n => n.parentId === formId)}
                          /> 
                          Tidak, ini sudah menjadi rincian terbawah
                        </label>
                      </div>
                    </div>
                    
                    {hasAktivitasPlan ? (
                      <div className="alert-sim info" style={{ padding: '10px', fontSize: '12px', margin: 0 }}>
                        <i className="fa-solid fa-diagram-project mr-2"></i>
                        Bidang Pengampu akan otomatis dikalkulasi dari entri Aktivitas di bawahnya nanti.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-muted)' }}>
                          Pilih Bidang Pengampu Subkegiatan <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        {bidangOptions.map(opt => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', margin: 0, color: selectedBidangs.includes(opt) ? 'white' : 'var(--text-muted)' }}>
                            <input
                              type="checkbox"
                              checked={selectedBidangs.includes(opt)}
                              onChange={() => handleBidangChange(opt)}
                              style={{ cursor: 'pointer' }}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="form-group mb-3">
                  <label>Bidang Pengampu Aktivitas <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(15,23,42,0.4)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    {bidangOptions.map(opt => (
                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', margin: 0, color: selectedBidangs.includes(opt) ? 'white' : 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={selectedBidangs.includes(opt)}
                          onChange={() => handleBidangChange(opt)}
                          style={{ cursor: 'pointer' }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              )}



              {/* Target Kinerja & Anggaran per tahun untuk subkegiatan */}
              {level === 'sasaran_subkegiatan' && (
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', marginTop: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <i className="fa-solid fa-bullseye text-orange"></i> Target Kinerja & Anggaran Renstra
                  </h4>
                  
                  <div className="form-group mb-3" style={{ maxWidth: '300px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tipe Target Kinerja</label>
                    <select 
                      className="select-sim" 
                      value={subkegiatanTipeTarget} 
                      onChange={(e) => setSubkegiatanTipeTarget(e.target.value)}
                    >
                      <option value="Kondisi Akhir Naik">Kondisi Akhir Naik</option>
                      <option value="Kondisi Akhir Menurun">Kondisi Akhir Menurun</option>
                      <option value="Akumulatif">Akumulatif</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
                    {['2025', '2026', '2027', '2028', '2029', '2030'].map(year => {
                      const bState = year === '2025' ? b2025 : year === '2026' ? b2026 : year === '2027' ? b2027 : year === '2028' ? b2028 : year === '2029' ? b2029 : b2030;
                      const setBState = year === '2025' ? setB2025 : year === '2026' ? setB2026 : year === '2027' ? setB2027 : year === '2028' ? setB2028 : year === '2029' ? setB2029 : setB2030;
                      const tState = year === '2025' ? t2025 : year === '2026' ? t2026 : year === '2027' ? t2027 : year === '2028' ? t2028 : year === '2029' ? t2029 : t2030;
                      const setTState = year === '2025' ? setT2025 : year === '2026' ? setT2026 : year === '2027' ? setT2027 : year === '2028' ? setT2028 : year === '2029' ? setT2029 : setT2030;

                      return (
                        <div key={year} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                          <strong style={{ fontSize: '12px', color: 'var(--primary-orange)' }}>Tahun {year}</strong>
                          <div className="form-group mt-1">
                            <label style={{ fontSize: '10px', margin: 0, color: '#34D399' }}>Target Kinerja</label>
                            <input type="text" className="form-control" style={{ padding: '4px 8px', fontSize: '11px' }} value={tState} onChange={(e) => setTState(formatIndonesianInput(e.target.value))} placeholder="0" />
                          </div>
                          <div className="form-group mt-1">
                            <label style={{ fontSize: '10px', margin: 0, color: 'var(--info)' }}>Anggaran (Rp)</label>
                            <input type="text" className="form-control" style={{ padding: '4px 8px', fontSize: '11px' }} value={bState} onChange={(e) => setBState(formatIndonesianInput(e.target.value))} placeholder="0" />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group" style={{ background: 'rgba(16,185,129,0.06)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <label style={{ color: '#34D399', fontSize: '12px' }}>Target Akhir Periode</label>
                      <input type="text" className="form-control" value={tAkhir} onChange={(e) => setTAkhir(formatIndonesianInput(e.target.value))} style={{ fontWeight: 'bold' }} />
                    </div>
                    <div className="form-group" style={{ background: 'rgba(255,255,255,0.04)', padding: '10px', borderRadius: '8px' }}>
                      <label style={{ fontSize: '12px' }}>Total Anggaran Akhir Periode</label>
                      <input type="text" className="form-control" value={parseFloat(budgetAkhir).toLocaleString('id-ID')} readOnly style={{ background: 'rgba(0,0,0,0.3)', fontWeight: 'bold' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="panel-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
              <button type="button" className="btn btn-orange" onClick={handleSubmit} style={{ width: 'auto' }}>
                <i className="fa-solid fa-save mr-2"></i> Simpan
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowFormModal(false)} style={{ width: 'auto' }}>Batal</button>
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
                    <div 
                      key={ind.id || idx} 
                      draggable 
                      onDragStart={(e) => handleIndicatorDragStart(e, idx)}
                      onDragOver={(e) => handleIndicatorDragOver(e, idx)}
                      onDrop={(e) => handleIndicatorDrop(e, idx)}
                      style={{ 
                        background: draggedIndex === idx ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)', 
                        padding: '12px', 
                        borderRadius: '8px', 
                        border: draggedIndex === idx ? '1px dashed var(--info)' : '1px solid var(--glass-border)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '10px',
                        cursor: 'grab',
                        transition: 'all 0.2s ease',
                        opacity: draggedIndex === idx ? 0.6 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="fa-solid fa-grip-vertical text-muted" style={{ marginRight: '4px', cursor: 'grab' }}></i>
                          <strong style={{ color: 'var(--primary-orange)' }}>Indikator #{idx + 1}</strong>
                        </div>
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
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: '3px 6px', fontSize: '11px', fontWeight: 'bold' }} 
                            value={ind.targetAkhir || '0'} 
                            onChange={(e) => updateTempIndicator(idx, 'targetAkhir', e.target.value)} 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
              <button type="button" className="btn btn-orange" onClick={handleSaveIndicators} style={{ width: 'auto' }}>
                <i className="fa-solid fa-save mr-2"></i> Simpan
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowIndicatorModal(false)} style={{ width: 'auto' }}>Batal</button>
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
              <button 
                type="button" 
                className="btn btn-danger" 
                disabled={deleteConfirmInput !== 'HAPUS'} 
                onClick={executeDelete} 
                style={{ width: 'auto' }}
              >
                Hapus Permanen
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirmModal(false)} style={{ width: 'auto' }}>Batal</button>
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
              <button type="button" className="btn btn-orange" onClick={handleSaveOpDef} style={{ width: 'auto' }}>
                <i className="fa-solid fa-check mr-2"></i> Terapkan
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowOpDefModal(false)} style={{ width: 'auto' }}>Batal</button>
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
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '18%' }}>Sasaran Program</th>
                <th style={{ border: '1px solid black', padding: '6px', fontSize: '11px', width: '18%' }}>Sasaran Kegiatan</th>
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
                                • {ind.indikator} ({ind.target2025} - {ind.target2030} | {ind.satuan} | Tipe: {ind.tipeTarget || 'Kondisi Akhir Naik'})
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
                                • {ind.indikator} ({ind.target2025} - {ind.target2030} | {ind.satuan} | Tipe: {ind.tipeTarget || 'Kondisi Akhir Naik'})
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
                                • {ind.indikator} ({ind.target2025} - {ind.target2030} | {ind.satuan} | Tipe: {ind.tipeTarget || 'Kondisi Akhir Naik'})
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
                                • {ind.indikator} ({ind.target2025} - {ind.target2030} | {ind.satuan} | Tipe: {ind.tipeTarget || 'Kondisi Akhir Naik'})
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
                                • {ind.indikator} ({ind.target2025} - {ind.target2030} | {ind.satuan} | Tipe: {ind.tipeTarget || 'Kondisi Akhir Naik'})
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
      {showImportExcelModal && (
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
            maxWidth: '750px',
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
                <i className="fa-solid fa-file-excel text-orange"></i> Import Data Renstra dari Excel
              </h3>
              <button onClick={() => setShowImportExcelModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
            </div>

            <div className="panel-body" style={{ padding: '20px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {importReport && importReport.success === true ? (
                <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                  <i className="fa-solid fa-circle-check text-success" style={{ fontSize: '48px', marginBottom: '12px' }}></i>
                  <h4 style={{ color: '#34D399', fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }}>Impor Berhasil Diselesaikan!</h4>
                  <p style={{ fontSize: '13px', color: '#e2e8f0', marginBottom: '16px' }}>
                    Sebanyak <strong>{importReport.successCount}</strong> node pohon Renstra berhasil divalidasi dan disimpan ke database.
                  </p>
                  <button type="button" className="btn btn-orange" style={{ margin: '0 auto' }} onClick={() => setShowImportExcelModal(false)}>Tutup</button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Fitur ini digunakan untuk mengimpor seluruh pohon kinerja Renstra (5 tahunan) secara massal dari file Excel.
                    Menu impor dinonaktifkan apabila database telah berisi data cascading.
                  </p>

                  <div style={{ background: 'rgba(255,107,0,0.06)', border: '1px dashed rgba(255,107,0,0.25)', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>Belum punya template format Excel?</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Gunakan file template resmi agar data terstruktur dengan benar.</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      style={{ width: 'auto', background: 'rgba(255,255,255,0.08)', gap: '6px', fontSize: '12px' }}
                      onClick={() => window.open('/api/admin/cascading5years/import-template')}
                    >
                      <i className="fa-solid fa-download"></i> Unduh Template
                    </button>
                  </div>

                  <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>Pilih Berkas Excel (.xlsx / .xls)</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px dashed var(--glass-border)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                      <button
                        type="submit"
                        className="btn btn-orange"
                        style={{ width: 'auto' }}
                        disabled={isImporting || !importFile}
                      >
                        {isImporting ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin mr-2"></i> Memvalidasi & Impor...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-cloud-arrow-up mr-2"></i> Unggah & Proses
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: 'auto' }}
                        onClick={() => setShowImportExcelModal(false)}
                        disabled={isImporting}
                      >
                        Batal
                      </button>
                    </div>
                  </form>

                  {importReport && importReport.success === false && (
                    <div style={{ marginTop: '16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '16px' }}>
                      <h4 style={{ color: '#F87171', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <i className="fa-solid fa-circle-exclamation"></i> Gagal Memproses Impor ({importReport.failCount} Kesalahan Validasi)
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                        Database tidak diubah. Silakan perbaiki kesalahan-kesalahan berikut pada file Excel Anda lalu coba unggah kembali.
                      </p>
                      
                      <div style={{ overflowX: 'auto', maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 'semibold' }}>Baris</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'semibold' }}>Level</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'semibold' }}>Nomenklatur</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'semibold' }}>Alasan Kegagalan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importReport.errors && importReport.errors.map((err, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '8px 12px', color: '#ef4444', fontWeight: 'bold' }}>{err.row}</td>
                                <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{err.level}</td>
                                <td style={{ padding: '8px 12px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={err.nomenklatur}>{err.nomenklatur}</td>
                                <td style={{ padding: '8px 12px', color: '#cbd5e1' }}>{err.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
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
        
        /* Vertical layout for screen */
        .org-chart ul.vertical-layout {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 0;
        }
        .org-chart ul.vertical-layout::before {
          display: none;
        }
        .org-chart ul.vertical-layout > li {
          padding: 24px 0 0 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .org-chart ul.vertical-layout > li::before {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          border-left: 2px solid rgba(255, 107, 0, 0.4);
          width: 0;
          transform: translateX(-50%);
          z-index: 1;
          display: block;
        }
        .org-chart ul.vertical-layout > li::after {
          display: none;
        }
        .org-chart ul.vertical-layout > li:last-child::before {
          bottom: auto;
          height: 24px;
        }
        
        .org-node-box {
          background: #1e293b !important;
          border: 1px solid var(--glass-border) !important;
          backdrop-filter: blur(10px);
          color: white !important;
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative;
          z-index: 2;
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
          .org-chart li::before, .org-chart li::after, .org-chart ul ul::before, .org-chart ul.vertical-layout > li::before {
            border-color: #64748b !important;
          }
        }
      `}} />
    </section>
  );
}
