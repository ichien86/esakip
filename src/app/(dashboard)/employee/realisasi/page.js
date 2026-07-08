'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useSimulationInternal } from '@/context/SimulationInternalContext';
import { useUI } from '@/context/UIContext';
import { parseBuktiDukung, getFilenameFromUrl } from '@/utils/linkPreview';
import { formatIndonesianInput, parseToStandardNumber, formatNumberForDisplay } from '@/utils/numberFormat';

export default function EmployeeRealisasiPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { currentUser } = useSimulationInternal();
  const { activeBidang, activeYear } = useUI();
  const [selectedIndicators, setSelectedIndicators] = useState([]);
  const [renaksiRecords, setRenaksiRecords] = useState([]);
  const [monthlySchedules, setMonthlySchedules] = useState([]);
  const [sharedGlobalVariables, setSharedGlobalVariables] = useState({});
  const [perjakinStatus, setPerjakinStatus] = useState(null);

  // Selections
  const [selectedId, setSelectedId] = useState('');
  const [selectedBulan, setSelectedBulan] = useState('1');

  // Input states
  const [realisasiValue, setRealisasiValue] = useState('');
  
  // Variabel dinamis: { name, value, isConstant, buktiDukungFiles: [] }
  const [variablesRealizationVals, setVariablesRealizationVals] = useState([]);

  const [kendala, setKendala] = useState('');
  const [solusi, setSolusi] = useState('');
  const [pendorong, setPendorong] = useState('');
  const [inovasi, setInovasi] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [aliasWarnings, setAliasWarnings] = useState([]); // notifikasi alias duplikat

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    try {
      // 1. Fetch selection list
      const selRes = await fetchWithAuth(`/api/selections/${currentUser.id}`);
      let selectedIds = [];
      if (selRes.ok) {
        const selData = await selRes.json();
        selectedIds = selData.selectedIndicators || [];
      }

      // 2. Fetch annual Renja nodes
      const nodesRes = await fetchWithAuth(`/api/renja/${activeYear}`);
      if (nodesRes.ok) {
        const allNodes = await nodesRes.json();
        let matchedIndicators = [];
        allNodes.forEach(n => {
          if (n.indicators && n.indicators.length > 0) {
            n.indicators.forEach(ind => {
              if (selectedIds.includes(ind.id)) {
                matchedIndicators.push({
                  ...ind,
                  parentNode: n
                });
              }
            });
          } else if (selectedIds.includes(n.id)) {
            matchedIndicators.push({
              ...n,
              parentNode: null
            });
          }
        });
        setSelectedIndicators(matchedIndicators);
        if (matchedIndicators.length > 0) {
          setSelectedId(matchedIndicators[0].id);
        }
      }

      // 3. Fetch existing Renaksi records
      const rxRes = await fetchWithAuth(`/api/renaksi/${currentUser.id}/${activeYear}`);
      if (rxRes.ok) {
        setRenaksiRecords(await rxRes.json());
      }

      // 4. Fetch monthly realization schedules
      const schedRes = await fetchWithAuth(`/api/admin/settings/realisasi-schedule?tahun=${activeYear}`);
      if (schedRes.ok) {
        setMonthlySchedules(await schedRes.json());
      }

      // 5. Fetch perjakin document status
      const perjakinRes = await fetchWithAuth(`/api/perjakin?employeeId=${currentUser.id}&tahun=${activeYear}`);
      if (perjakinRes.ok) {
        const pData = await perjakinRes.json();
        setPerjakinStatus(pData.data?.docStatus || 'Draft');
      }
    } catch (e) {
      console.error('Failed to load realisasi data sources', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser, activeYear, fetchWithAuth]);

  useEffect(() => {
    if (currentUser) {
      const timer = setTimeout(() => {
        loadData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentUser, loadData]);

  // Ambil global shared variables saat bulan berubah
  useEffect(() => {
    async function fetchSharedVars() {
      if (!selectedBulan) return;
      try {
        const res = await fetchWithAuth(`/api/renaksi/shared-variables?tahun=${activeYear}&bulan=${selectedBulan}`);
        if (res.ok) {
          setSharedGlobalVariables(await res.json());
        }
      } catch(e) {
        console.error('Failed to load shared variables', e);
      }
    }
    fetchSharedVars();
  }, [selectedBulan, activeYear, fetchWithAuth]);

  // Load existing realization values when indicator or month changes
  const activeRecord = renaksiRecords.find(
    r => r.indicatorId === selectedId && r.bulan === parseInt(selectedBulan)
  );

  const activeNode = selectedIndicators.find(n => n.id === selectedId);

  const currentSchedule = monthlySchedules.find(s => s.bulan === parseInt(selectedBulan));
  let isMonthLocked = currentSchedule ? currentSchedule.isLocked : false;
  let lockReason = '';
  if (currentSchedule && currentSchedule.deadline) {
    const now = new Date();
    const deadlineDate = new Date(currentSchedule.deadline);
    deadlineDate.setHours(23, 59, 59, 999);
    if (now > deadlineDate) {
      isMonthLocked = true;
      lockReason = `Batas pengisian telah berakhir pada ${currentSchedule.deadline}.`;
    } else if (isMonthLocked) {
      lockReason = 'Bulan ini telah dikunci oleh Administrator.';
    }
  } else if (isMonthLocked) {
    lockReason = 'Bulan ini telah dikunci oleh Administrator.';
  }

  let isTargetLocked = false;
  let isPerjakinLocked = false;
  if (activeRecord) {
    const unapprovedTargetStatuses = ['Draft', 'Target_Diajukan', 'Target_ACC_Admin', 'Target_Ditolak'];
    if (unapprovedTargetStatuses.includes(activeRecord.status)) {
      isTargetLocked = true;
      lockReason = `Target renaksi belum disetujui (Status: ${activeRecord.status.replace(/_/g, ' ')}). Anda belum bisa mengisi realisasi.`;
    } else if (perjakinStatus !== 'Disetujui') {
      isPerjakinLocked = true;
      lockReason = `Dokumen Perjanjian Kinerja (Perjakin) Anda belum berstatus Disetujui (Status Saat Ini: ${perjakinStatus?.replace(/_/g, ' ') || 'Belum Dibuat'}).`;
    }
  }

  const isRealisasiEditable = activeRecord && 
    activeRecord.status !== 'ACC_Admin' && 
    activeRecord.status !== 'Disetujui' && 
    !isMonthLocked &&
    !isTargetLocked &&
    !isPerjakinLocked;

  useEffect(() => {
    const timer = setTimeout(() => {
      let varsToSet = [];
      const isRecordEmpty = !activeRecord || (!activeRecord.variablesRealization || activeRecord.variablesRealization.length === 0);

      if (activeRecord && !isRecordEmpty) {
        setRealisasiValue(activeRecord.realisasiBulanan !== null ? formatNumberForDisplay(activeRecord.realisasiBulanan) : '');
        
        varsToSet = activeRecord.variablesRealization.map(v => {
          const parsed = parseBuktiDukung(v.buktiDukung || '');
          const initialFiles = parsed.length > 0 
            ? parsed.map(f => ({ ...f, verifyStatus: null, checking: false })) 
            : [{ name: '', url: '', verifyStatus: null, checking: false }];
            
          return {
            name: v.name,
            value: v.value !== null ? formatNumberForDisplay(v.value) : '',
            isConstant: v.isConstant === true,
            buktiDukungFiles: initialFiles
          };
        });

        setKendala(activeRecord.kendala || '');
        setSolusi(activeRecord.solusi || '');
        setPendorong(activeRecord.faktorPendorong || '');
        setInovasi(activeRecord.inovasi || '');
      } else {
        setRealisasiValue('');
        setKendala(''); setSolusi(''); setPendorong(''); setInovasi('');

        let templateVars = [];
        if (activeRecord && activeRecord.snapshotVariables && activeRecord.snapshotVariables.length > 0) {
          templateVars = activeRecord.snapshotVariables.map(v => ({ name: v.name }));
        } else if (activeNode && Array.isArray(activeNode.variables) && activeNode.variables.length > 0) {
          templateVars = activeNode.variables.map(v => ({ name: v.name }));
        } else if (activeNode) {
          // Migrasi fallback UI dari legacy ke array variables jika Node masih pakai skema lama tapi belum di-save admin
          const nm = (activeNode.metodePenghitungan || 'Tunggal') === 'Jumlah' ? 'Tunggal' : (activeNode.metodePenghitungan || 'Tunggal');
          if (nm === 'Tunggal' && activeNode.variabelJumlah) templateVars = [{ name: activeNode.variabelJumlah }];
          else if (nm === 'Persentase' && (activeNode.variabelPembilang || activeNode.variabelPenyebut)) templateVars = [{ name: activeNode.variabelPembilang || '' }, { name: activeNode.variabelPenyebut || '' }];
        }

        // Assistant Pre-fill logic (Variabel Konstan & Shared Variables)
        const newAliasWarnings = [];
        varsToSet = templateVars.map(vTemplate => {
          let prefilledValue = '';
          let prefilledBuktiDukung = [{ name: '', url: '', verifyStatus: null, checking: false }];
          let prefilledIsConstant = false;

          const currentBulan = parseInt(selectedBulan);
          
          const checkAndExtract = (record, requireConstant) => {
            if (!record || !Array.isArray(record.variablesRealization)) return false;
            const v = record.variablesRealization.find(pv => pv.name === vTemplate.name);
            if (v) {
              if (requireConstant && v.isConstant !== true) return false;
              if (v.value === '' && (!v.buktiDukung || v.buktiDukung === '[]')) return false; // Abaikan jika kosong
              
              prefilledValue = v.value !== null ? formatNumberForDisplay(v.value) : '';
              prefilledIsConstant = v.isConstant === true;
              const parsed = parseBuktiDukung(v.buktiDukung || '');
              if (parsed.length > 0) {
                prefilledBuktiDukung = parsed.map(f => ({ ...f, verifyStatus: null, checking: false }));
              }
              return true;
            }
            return false;
          };

          let found = false;

          // 1. Cari di bulan yang SAMA, tapi di indikator LAIN yang sudah diisi (Shared Variable di bulan berjalan milik sendiri)
          for (const record of renaksiRecords) {
            if (record.bulan === currentBulan && record.indicatorId !== selectedId) {
              if (checkAndExtract(record, false)) { found = true; break; }
            }
          }

          // 2. Jika tidak ketemu, cari di GLOBAL SHARED VARIABLES (Lintas Pegawai di bulan yang sama)
          // TAPI HANYA dari indikator yang BERBEDA.
          if (!found && Array.isArray(sharedGlobalVariables[vTemplate.name])) {
            const validGlobalVars = sharedGlobalVariables[vTemplate.name].filter(gv => gv.indicatorId !== selectedId);
            if (validGlobalVars.length > 0) {
              if (validGlobalVars.length > 1) {
                // DUPLIKASI ALIAS: jumlahkan semua nilainya
                const total = validGlobalVars.reduce((sum, gv) => sum + (parseFloat(gv.value) || 0), 0);
                prefilledValue = formatNumberForDisplay(total);
                prefilledIsConstant = false;
                // Catat peringatan untuk ditampilkan ke user
                newAliasWarnings.push({
                  varName: vTemplate.name,
                  count: validGlobalVars.length,
                  values: validGlobalVars.map(gv => gv.value),
                  total
                });
              } else {
                // Hanya satu sumber, ambil langsung
                const globalVar = validGlobalVars[0];
                prefilledValue = formatNumberForDisplay(globalVar.value);
                prefilledIsConstant = false;
                const parsed = parseBuktiDukung(globalVar.buktiDukung || '');
                if (parsed.length > 0) {
                  prefilledBuktiDukung = parsed.map(f => ({ ...f, verifyStatus: null, checking: false }));
                }
              }
              found = true;
            }
          }

          // 3. Jika tidak ketemu juga, cari di bulan SEBELUMNYA (milik sendiri) yang diset "Konstan"
          if (!found) {
            for (let m = currentBulan - 1; m >= 1; m--) {
              const recordsInMonth = renaksiRecords.filter(r => r.bulan === m);
              for (const record of recordsInMonth) {
                if (checkAndExtract(record, true)) { found = true; break; }
              }
              if (found) break;
            }
          }

          return {
            name: vTemplate.name,
            value: prefilledValue,
            isConstant: prefilledIsConstant,
            buktiDukungFiles: prefilledBuktiDukung
          };
        });
      }
      setVariablesRealizationVals(varsToSet);
      if (newAliasWarnings.length > 0) setAliasWarnings(newAliasWarnings);
      else setAliasWarnings([]);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedId, selectedBulan, renaksiRecords, activeRecord, activeNode]);

  // Dynamic automatic calculation of Realisasi on the fly (supports all 5 methods)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!activeNode || variablesRealizationVals.length === 0) return;
      const metode = (activeRecord && activeRecord.snapshotMetode) || activeNode.metodePenghitungan || 'Tunggal';
      const normalizedMetode = (metode === 'Jumlah') ? 'Tunggal' : metode;

      if (normalizedMetode === 'Tunggal') {
        const v = parseFloat(parseToStandardNumber(variablesRealizationVals[0].value));
        setRealisasiValue(!isNaN(v) ? formatNumberForDisplay(v) : '');

      } else if (normalizedMetode === 'Persentase') {
        if (variablesRealizationVals.length >= 2) {
          const p = parseFloat(parseToStandardNumber(variablesRealizationVals[0].value));
          const y = parseFloat(parseToStandardNumber(variablesRealizationVals[1].value));
          if (!isNaN(p) && !isNaN(y) && y !== 0) {
            setRealisasiValue(formatNumberForDisplay(parseFloat(((p / y) * 100).toFixed(2))));
          } else { setRealisasiValue(''); }
        }

      } else if (normalizedMetode === 'Rata-rata') {
        const vals = variablesRealizationVals.map(v => parseFloat(parseToStandardNumber(v.value))).filter(v => !isNaN(v));
        if (vals.length === variablesRealizationVals.length && vals.length > 0) {
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          setRealisasiValue(formatNumberForDisplay(parseFloat(avg.toFixed(4))));
        } else { setRealisasiValue(''); }

      } else if (normalizedMetode === 'Penjumlahan') {
        const vals = variablesRealizationVals.map(v => parseFloat(parseToStandardNumber(v.value))).filter(v => !isNaN(v));
        if (vals.length === variablesRealizationVals.length && vals.length > 0) {
          setRealisasiValue(formatNumberForDisplay(parseFloat(vals.reduce((a, b) => a + b, 0).toFixed(4))));
        } else { setRealisasiValue(''); }

      } else if (normalizedMetode === 'Pembobotan') {
        const snapVars = (activeRecord && activeRecord.snapshotVariables && activeRecord.snapshotVariables.length > 0)
          ? activeRecord.snapshotVariables
          : (activeNode.variables || []);
        let weightedSum = 0;
        let allValid = variablesRealizationVals.length > 0;
        for (const vr of variablesRealizationVals) {
          const val = parseFloat(parseToStandardNumber(vr.value));
          if (isNaN(val)) { allValid = false; break; }
          const snapVar = snapVars.find(sv => sv.name === vr.name);
          const weight = snapVar ? (parseFloat(snapVar.weight) || 0) : 0;
          weightedSum += val * weight;
        }
        if (allValid) { setRealisasiValue(formatNumberForDisplay(parseFloat((weightedSum / 100).toFixed(4)))); }
        else { setRealisasiValue(''); }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [variablesRealizationVals, activeNode, activeRecord]);

  // Multi-file input handlers
  const handleAddFileRow = (varIdx) => {
    setVariablesRealizationVals(prev => {
      const newVars = [...prev];
      newVars[varIdx].buktiDukungFiles = [...newVars[varIdx].buktiDukungFiles, { name: '', url: '', verifyStatus: null, checking: false }];
      return newVars;
    });
  };

  const handleRemoveFileRow = (varIdx, fileIdx) => {
    setVariablesRealizationVals(prev => {
      const newVars = [...prev];
      const newFiles = [...newVars[varIdx].buktiDukungFiles];
      newFiles.splice(fileIdx, 1);
      newVars[varIdx].buktiDukungFiles = newFiles.length > 0 ? newFiles : [{ name: '', url: '', verifyStatus: null, checking: false }];
      return newVars;
    });
  };

  const handleNameChange = (varIdx, fileIdx, name) => {
    setVariablesRealizationVals(prev => {
      const newVars = [...prev];
      newVars[varIdx].buktiDukungFiles[fileIdx].name = name;
      return newVars;
    });
  };

  const handleUrlChange = async (varIdx, fileIdx, url) => {
    // Optimistic UI update
    setVariablesRealizationVals(prev => {
      const newVars = [...prev];
      newVars[varIdx].buktiDukungFiles[fileIdx].url = url;
      if (url) newVars[varIdx].buktiDukungFiles[fileIdx].name = getFilenameFromUrl(url);
      else newVars[varIdx].buktiDukungFiles[fileIdx].name = '';
      
      if (!url) {
        newVars[varIdx].buktiDukungFiles[fileIdx].verifyStatus = null;
        newVars[varIdx].buktiDukungFiles[fileIdx].checking = false;
      } else {
        newVars[varIdx].buktiDukungFiles[fileIdx].checking = true;
        newVars[varIdx].buktiDukungFiles[fileIdx].verifyStatus = { checking: true, message: 'Memverifikasi link...' };
      }
      return newVars;
    });

    if (!url) return;

    try {
      const res = await fetchWithAuth('/api/verify-link', {
        method: 'POST',
        body: JSON.stringify({ url })
      });
      
      const parsedRes = await res.json();
      
      setVariablesRealizationVals(prev => {
        const newVars = [...prev];
        if (newVars[varIdx] && newVars[varIdx].buktiDukungFiles[fileIdx]) {
          if (res.ok) {
            newVars[varIdx].buktiDukungFiles[fileIdx].verifyStatus = parsedRes;
            // Overwrite generic name with the actual document title if available
            if (parsedRes.title && parsedRes.title.trim() !== '') {
              newVars[varIdx].buktiDukungFiles[fileIdx].name = parsedRes.title;
            }
          } else {
            newVars[varIdx].buktiDukungFiles[fileIdx].verifyStatus = { isDrive: false, isPublic: false, message: 'Gagal menghubungi server verifikasi.' };
          }
          newVars[varIdx].buktiDukungFiles[fileIdx].checking = false;
        }
        return newVars;
      });
    } catch (e) {
      setVariablesRealizationVals(prev => {
        const newVars = [...prev];
        if (newVars[varIdx] && newVars[varIdx].buktiDukungFiles[fileIdx]) {
          newVars[varIdx].buktiDukungFiles[fileIdx].verifyStatus = { isDrive: false, isPublic: false, message: 'Terjadi kesalahan.' };
          newVars[varIdx].buktiDukungFiles[fileIdx].checking = false;
        }
        return newVars;
      });
    }
  };

  const getVerifyBadgeForFile = (file) => {
    if (!file.verifyStatus) return null;
    if (file.verifyStatus.checking) {
      return (
        <div className="verify-badge checking" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', marginTop: '4px' }}>
          <i className="fa-solid fa-spinner fa-spin text-orange"></i> {file.verifyStatus.message}
        </div>
      );
    }
    
    if (file.verifyStatus.isDrive) {
      if (file.verifyStatus.isPublic) {
        return (
          <div className="verify-badge verified-public" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--success)', marginTop: '4px' }}>
            <i className="fa-solid fa-circle-check"></i> Link Publik (Siap diverifikasi)
          </div>
        );
      } else {
        return (
          <div className="verify-badge verified-private" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>
            <i className="fa-solid fa-circle-xmark"></i> Link Privat (Butuh Akses / Login)
          </div>
        );
      }
    }
    return (
      <div className="verify-badge verified-external" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--info)', marginTop: '4px' }}>
        <i className="fa-solid fa-link"></i> {file.verifyStatus.message}
      </div>
    );
  };

  const handleSaveRealisasi = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!activeRecord) {
      setError('Target bulanan untuk indikator dan bulan terpilih belum diatur.');
      return;
    }

    const target = activeRecord.targetBulanan;
    // Determine effective method (use snapshot if exists)
    const effectiveMetode = (activeRecord && activeRecord.snapshotMetode) || activeNode?.metodePenghitungan || 'Tunggal';
    const normalizedMetode = (effectiveMetode === 'Jumlah') ? 'Tunggal' : effectiveMetode;
    let realisasi = parseFloat(parseToStandardNumber(realisasiValue));

    // Validate variables on client-side too
    if (activeNode) {
      if (variablesRealizationVals.length === 0) {
        setError('Variabel indikator belum dikonfigurasi. Hubungi Admin.'); return;
      }
      
      for (let i = 0; i < variablesRealizationVals.length; i++) {
        const v = variablesRealizationVals[i];
        const val = parseFloat(parseToStandardNumber(v.value));
        if (isNaN(val)) {
          setError(`Nilai variabel "${v.name}" wajib diisi angka valid.`); return;
        }
        if (normalizedMetode === 'Persentase' && i === 1 && val === 0) {
          setError('Variabel penyebut tidak boleh bernilai 0.'); return;
        }
        
        // Validasi bukti dukung per variabel
        const validFiles = v.buktiDukungFiles.filter(f => f.url.trim() !== '');
        if (validFiles.length === 0) {
          setError(`Minimal satu link Bukti Dukung wajib diisi untuk variabel "${v.name}".`); return;
        }
      }

      if (normalizedMetode === 'Persentase') {
        const p = parseFloat(parseToStandardNumber(variablesRealizationVals[0].value));
        const y = parseFloat(parseToStandardNumber(variablesRealizationVals[1].value));
        realisasi = parseFloat(((p / y) * 100).toFixed(2));
      } else if (normalizedMetode === 'Tunggal') {
        realisasi = parseFloat(parseToStandardNumber(variablesRealizationVals[0].value));
      }
      // Rata-rata, Penjumlahan, Pembobotan calculated on the fly and handled automatically
    }

    const isDecreasing = activeNode && (activeNode.tipeTarget || activeNode.parentNode?.tipeTarget) === 'Kondisi Akhir Menurun';
    const isUnderperforming = isDecreasing ? realisasi > target : realisasi < target;

    const finalVariablesRealization = variablesRealizationVals.map(v => {
      const validFiles = v.buktiDukungFiles.filter(f => f.url.trim() !== '');
      const finalFiles = validFiles.map(f => ({
        name: f.name.trim() || getFilenameFromUrl(f.url),
        url: f.url.trim()
      }));
      return {
        name: v.name,
        value: parseToStandardNumber(v.value),
        isConstant: v.isConstant,
        buktiDukung: JSON.stringify(finalFiles)
      };
    });

    const payload = {
      employeeId: currentUser.id,
      indicatorId: selectedId,
      bulan: parseInt(selectedBulan),
      realisasiBulanan: realisasi,
      buktiDukung: '', // legacy field dikosongkan
      kendala: isUnderperforming ? kendala : '',
      solusi: isUnderperforming ? solusi : '',
      faktorPendorong: isUnderperforming ? '' : pendorong,
      inovasi: isUnderperforming ? '' : inovasi,
      status: 'Diajukan',
      variablesRealization: finalVariablesRealization
    };

    try {
      const res = await fetchWithAuth('/api/renaksi/realisasi', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccess('Laporan realisasi bulanan berhasil diajukan.');
        // Refresh records list
        const rxRes = await fetchWithAuth(`/api/renaksi/${currentUser.id}/${activeYear}`);
        if (rxRes.ok) {
          setRenaksiRecords(await rxRes.json());
        }
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan realisasi.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  // Determine which subform to render based on compliance
  const targetVal = activeRecord ? activeRecord.targetBulanan : 0;
  const currentReal = parseFloat(realisasiValue);
  const isDecreasing = activeNode && (activeNode.tipeTarget || activeNode.parentNode?.tipeTarget) === 'Kondisi Akhir Menurun';
  
  const showUnderperformSubform = !isNaN(currentReal) && (
    isDecreasing ? currentReal > targetVal : currentReal < targetVal
  );

  const showExceededSubform = !isNaN(currentReal) && (
    isDecreasing ? currentReal <= targetVal : currentReal >= targetVal
  );

  const getVerifyBadge = () => {
    if (!verifyStatus) return null;
    if (verifyStatus.checking) return <div className="verify-badge checking"><i className="fa-solid fa-spinner fa-spin"></i> {verifyStatus.message}</div>;
    
    if (verifyStatus.isDrive) {
      if (verifyStatus.isPublic) {
        return <div className="verify-badge verified-public"><i className="fa-solid fa-circle-check"></i> Link Publik (Siap diverifikasi)</div>;
      } else {
        return <div className="verify-badge verified-private"><i className="fa-solid fa-circle-xmark"></i> Link Privat (Butuh Akses / Login)</div>;
      }
    }
    return <div className="verify-badge verified-external"><i className="fa-solid fa-link"></i> {verifyStatus.message}</div>;
  };

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3><i className="fa-solid fa-circle-play text-orange"></i> Laporan Capaian Realisasi Bulanan</h3>
        <p className="text-muted">Laporkan realisasi bulanan Anda dan lampirkan link dokumen pendukung sebagai bukti verifikasi atasan.</p>
      </div>

      <div className="panel-body">
        {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
        {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}><i className="fa-solid fa-circle-notch fa-spin"></i> Memuat form...</div>
        ) : selectedIndicators.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
            Anda belum memilih indikator IKU. Silakan masuk ke menu <strong>Indikator Kinerja Saya</strong> terlebih dahulu.
          </div>
        ) : (
          <form onSubmit={handleSaveRealisasi}>
            {isMonthLocked && (
              <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-lock text-orange"></i>
                <div>
                  <strong>Pengisian Realisasi Terkunci:</strong> {lockReason || 'Akses pengisian bulan ini telah ditutup.'}
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label>1. Pilih Indikator:</label>
                <select className="select-sim mt-1" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  {selectedIndicators.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.parentNode ? `${node.parentNode.level?.replace('_', ' ').toUpperCase()} - ${node.indikator}` : node.text}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>2. Pilih Bulan Laporan:</label>
                <select className="select-sim mt-1" value={selectedBulan} onChange={(e) => setSelectedBulan(e.target.value)}>
                  <option value="1">Januari</option>
                  <option value="2">Februari</option>
                  <option value="3">Maret</option>
                  <option value="4">April</option>
                  <option value="5">Mei</option>
                  <option value="6">Juni</option>
                  <option value="7">Juli</option>
                  <option value="8">Agustus</option>
                  <option value="9">September</option>
                  <option value="10">Oktober</option>
                  <option value="11">November</option>
                  <option value="12">Desember</option>
                </select>
              </div>
            </div>

            {activeRecord ? (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    Target Bulan Ini: <strong style={{ color: 'var(--primary-orange)' }}>{targetVal}</strong> {activeNode?.satuan}
                    {(activeNode?.tipeTarget || activeNode?.parentNode?.tipeTarget) === 'Kondisi Akhir Menurun' && (
                      <span className="badge badge-score" style={{ marginLeft: '10px' }}>Tipe: Target Menurun</span>
                    )}
                  </p>
                  {/* Tampilkan capaian yang sudah tersimpan jika sudah pernah diisi */}
                  {activeRecord.capaianBulanan != null && (
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: activeRecord.capaianBulanan >= 100 ? '#10B981' : '#EF4444',
                      background: activeRecord.capaianBulanan >= 100 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${activeRecord.capaianBulanan >= 100 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      borderRadius: '6px',
                      padding: '3px 10px'
                    }}>
                      Capaian: {activeRecord.capaianBulanan.toFixed(1)}%
                    </span>
                  )}
                  {/* Live preview saat user mengetik nilai baru */}
                  {!isNaN(currentReal) && activeRecord.capaianBulanan == null && currentReal >= 0 && targetVal >= 0 && (
                    (() => {
                      let liveCapaian = 0;
                      if (targetVal === 0) {
                        if (isDecreasing) {
                          liveCapaian = currentReal === 0 ? 100 : 0;
                        } else {
                          liveCapaian = currentReal >= 0 ? 100 : 0;
                        }
                      } else if (isDecreasing) {
                        liveCapaian = currentReal === 0 ? 100 : (targetVal / currentReal) * 100;
                      } else {
                        liveCapaian = (currentReal / targetVal) * 100;
                      }

                      return (
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: liveCapaian >= 100 ? '#10B981' : '#F59E0B',
                          opacity: 0.8
                        }}>
                          Preview: {liveCapaian.toFixed(1)}%
                        </span>
                      );
                    })()
                  )}
                </div>
                {activeRecord.status === 'Ditolak Admin' && activeRecord.catatanAdmin && (
                  <div style={{ marginTop: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ color: '#EF4444', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                      <i className="fa-solid fa-circle-exclamation"></i> Realisasi Ditolak oleh Admin Unit Kerja
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.5 }}>{activeRecord.catatanAdmin}</div>
                    <div style={{ color: '#F59E0B', fontSize: '12px', marginTop: '8px' }}>
                      <i className="fa-solid fa-pen-to-square"></i> Silakan perbaiki bukti dukung / isian sesuai catatan di atas, lalu ajukan ulang.
                    </div>
                  </div>
                )}
                {activeRecord.status === 'Diajukan' && (
                  <p style={{ marginTop: '6px', color: '#F59E0B', fontSize: '12px' }}>
                    <i className="fa-solid fa-clock"></i> Laporan ini telah diajukan dan menunggu persetujuan (ACC) dari Admin Unit Kerja.
                  </p>
                )}
                {activeRecord.status === 'ACC_Admin' && (
                  <p style={{ marginTop: '6px', color: '#3B82F6', fontSize: '12px' }}>
                    <i className="fa-solid fa-circle-check"></i> Laporan ini telah di-ACC oleh Admin Unit Kerja dan sedang menunggu validasi oleh Pemimpin.
                  </p>
                )}
                {activeRecord.status === 'Disetujui' && (
                  <p style={{ marginTop: '6px', color: 'var(--success)', fontSize: '12px' }}>
                    <i className="fa-solid fa-circle-check"></i> Laporan ini telah divalidasi dan disetujui secara permanen oleh Pemimpin.
                  </p>
                )}
              </div>

            ) : (
              <div style={{ color: 'var(--danger)', marginBottom: '20px', fontSize: '13px' }}>
                Target bulanan belum diset. Silakan isi matriks target terlebih dahulu.
              </div>
            )}

            {activeRecord && (
              <>
                <div style={{ background:'rgba(255,255,255,0.01)',border:'1px solid var(--glass-border)',padding:'16px',borderRadius:'8px',marginBottom:'16px' }}>
                  <div style={{ fontSize:'12px',color:'var(--primary-orange)',fontWeight:600,marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
                      <i className="fa-solid fa-layer-group"></i> Variabel Indikator & Bukti Dukung
                    </div>
                  </div>
                  
                  {variablesRealizationVals.length === 0 ? (
                    <div style={{ fontSize:'12px',color:'var(--danger)' }}>Variabel belum dikonfigurasi. Hubungi Admin.</div>
                  ) : (
                    <div style={{ display:'flex',flexDirection:'column',gap:'20px' }}>
                      {/* Notifikasi Alias Duplikat */}
                      {aliasWarnings.length > 0 && aliasWarnings.map((warn, wi) => (
                        <div key={wi} style={{ background:'rgba(234,179,8,0.1)',border:'1px solid rgba(234,179,8,0.35)',borderRadius:'8px',padding:'12px 16px',display:'flex',gap:'12px',alignItems:'flex-start' }}>
                          <i className="fa-solid fa-triangle-exclamation" style={{ color:'#eab308',marginTop:'2px',flexShrink:0 }}></i>
                          <div style={{ fontSize:'12px',lineHeight:'1.6' }}>
                            <strong style={{ color:'#eab308' }}>Duplikasi Alias Variabel: &ldquo;{warn.varName}&rdquo;</strong><br/>
                            Ditemukan <strong>{warn.count} indikator</strong> dengan alias yang sama. Nilai masing-masing ({warn.values.map(v => v?.toLocaleString('id-ID')).join(' + ')}) <strong>telah dijumlahkan otomatis menjadi {warn.total?.toLocaleString('id-ID')}</strong>. Anda tetap bisa mengubah angka ini secara manual jika diperlukan.
                          </div>
                        </div>
                      ))}
                      {variablesRealizationVals.map((vr, varIdx) => {
                        const effectiveMetode = (activeRecord && activeRecord.snapshotMetode) || activeNode?.metodePenghitungan || 'Tunggal';
                        const nm = (effectiveMetode === 'Jumlah') ? 'Tunggal' : effectiveMetode;
                        const snapVar = activeNode?.variables?.find(sv => sv.name === vr.name) || activeRecord?.snapshotVariables?.find(sv => sv.name === vr.name);
                        
                        return (
                          <div key={varIdx} style={{ background:'rgba(0,0,0,0.15)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:'8px',padding:'16px' }}>
                            {/* Header Variabel */}
                            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px',paddingBottom:'10px',borderBottom:'1px dashed rgba(255,255,255,0.1)' }}>
                              <div style={{ fontWeight:600,fontSize:'13px',color: 'var(--text-primary)' }}>
                                {vr.name || `Variabel ${varIdx + 1}`}
                              </div>
                              <div style={{ display:'flex',alignItems:'center',gap:'16px' }}>
                                {nm === 'Pembobotan' && snapVar && (
                                  <span style={{ fontSize:'11px',color:'var(--text-muted)',background:'rgba(255,255,255,0.05)',padding:'4px 8px',borderRadius:'4px' }}>
                                    Bobot: {snapVar.weight}
                                  </span>
                                )}
                                <label style={{ display:'flex',alignItems:'center',gap:'6px',fontSize:'11px',color:'var(--text-muted)',cursor:'pointer' }}>
                                  <input 
                                    type="checkbox" 
                                    disabled={!isRealisasiEditable}
                                    checked={vr.isConstant}
                                    onChange={(e) => {
                                      const newVals = [...variablesRealizationVals];
                                      newVals[varIdx] = { ...newVals[varIdx], isConstant: e.target.checked };
                                      setVariablesRealizationVals(newVals);
                                    }}
                                  />
                                  Data sama sepanjang tahun
                                </label>
                              </div>
                            </div>
                            
                            {/* Input Nilai */}
                            <div className="form-group mb-3">
                              <label style={{ fontSize:'11px',color:'var(--text-muted)' }}>Capaian Variabel</label>
                              <input
                                type="text"
                                className="form-control"
                                disabled={!isRealisasiEditable}
                                value={vr.value}
                                onChange={(e) => {
                                  const newVals = [...variablesRealizationVals];
                                  newVals[varIdx] = { ...newVals[varIdx], value: formatIndonesianInput(e.target.value) };
                                  setVariablesRealizationVals(newVals);
                                }}
                                required
                                placeholder={`Masukkan angka capaian untuk ${vr.name || `variabel ${varIdx + 1}`}`}
                              />
                            </div>
                            {/* Bukti Dukung per Variabel */}
                            <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
                              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                                <label style={{ fontSize:'11px',color:'var(--text-muted)',display:'flex',alignItems:'center',gap:'6px' }}>
                                  <i className="fa-solid fa-link"></i> Link Bukti Dukung (Minimal 1)
                                </label>
                                <button type="button" onClick={() => handleAddFileRow(varIdx)} disabled={!isRealisasiEditable} style={{ background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:'var(--primary-orange)',borderRadius:'4px',padding:'2px 8px',fontSize:'10px',cursor:'pointer' }}>
                                  <i className="fa-solid fa-plus"></i> Tambah Link
                                </button>
                              </div>
                              
                              <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
                                {Array.isArray(vr.buktiDukungFiles) && vr.buktiDukungFiles.map((file, fileIdx) => (
                                  <div key={fileIdx} style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',background:'rgba(255,255,255,0.02)',padding:'8px',borderRadius:'6px',position:'relative' }}>
                                    {vr.buktiDukungFiles.length > 1 && (
                                      <button type="button" onClick={() => handleRemoveFileRow(varIdx, fileIdx)} disabled={!isRealisasiEditable} style={{ position:'absolute',top:'-4px',right:'-4px',background:'var(--danger)',border:'none',color:'white',borderRadius:'50%',width:'16px',height:'16px',fontSize:'8px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2 }}>
                                        <i className="fa-solid fa-xmark"></i>
                                      </button>
                                    )}
                                    <div className="form-group" style={{ margin:0 }}>
                                      <input type="text" className="form-control" style={{ fontSize:'11px',padding:'6px 8px' }} disabled={!isRealisasiEditable} value={file.url} onChange={(e) => handleUrlChange(varIdx, fileIdx, e.target.value)} placeholder="URL Bukti Dukung" required />
                                      {getVerifyBadgeForFile(file)}
                                    </div>
                                    <div className="form-group" style={{ margin:0 }}>
                                      <input type="text" className="form-control" style={{ fontSize:'11px',padding:'6px 8px' }} disabled={!isRealisasiEditable} value={file.name} onChange={(e) => handleNameChange(varIdx, fileIdx, e.target.value)} placeholder="Nama Dokumen" required={file.url.trim() !== ''} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {realisasiValue !== '' && variablesRealizationVals.length > 0 && (
                    <div style={{ marginTop:'20px',fontSize:'13px',background:'rgba(59,130,246,0.15)',padding:'12px 16px',borderRadius:'6px',border:'1px solid rgba(59,130,246,0.3)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                      <span>Realisasi Capaian Keseluruhan Terhitung:</span>
                      <strong style={{ fontSize:'16px' }}>{realisasiValue} {activeNode?.satuan}</strong>
                    </div>
                  )}
                </div>

                {/* Case A: Underperform (requires Kendala & Solusi) */}
                {showUnderperformSubform && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '20px'
                  }}>
                    <h5 style={{ color: 'var(--warning)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <i className="fa-solid fa-triangle-exclamation"></i> Kinerja Di Bawah Target
                    </h5>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Realisasi Anda di bawah target (atau melebihi batas target menurun). Anda wajib mengisi hambatan kendala dan rencana perbaikan.
                    </p>
                    <div className="form-group mb-2">
                      <label style={{ fontSize: '12px' }}>Kendala / Hambatan Lapangan</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        disabled={!isRealisasiEditable}
                        value={kendala}
                        onChange={(e) => setKendala(e.target.value)}
                        required
                        placeholder="Jelaskan kendala apa yang terjadi..."
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '12px' }}>Rencana Solusi / Tindak Lanjut</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        disabled={!isRealisasiEditable}
                        value={solusi}
                        onChange={(e) => setSolusi(e.target.value)}
                        required
                        placeholder="Jelaskan perbaikan untuk bulan berikutnya..."
                      />
                    </div>
                  </div>
                )}

                {/* Case B: Met/Exceeded (requires Pendorong & Inovasi) */}
                {showExceededSubform && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '20px'
                  }}>
                    <h5 style={{ color: 'var(--success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <i className="fa-solid fa-circle-check"></i> Kinerja Memenuhi/Melampaui Target
                    </h5>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Kerja bagus! Silakan isi faktor pendukung keberhasilan serta inovasi taktis yang Anda lakukan.
                    </p>
                    <div className="form-group mb-2">
                      <label style={{ fontSize: '12px' }}>Faktor Pendorong Keberhasilan</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        disabled={!isRealisasiEditable}
                        value={pendorong}
                        onChange={(e) => setPendorong(e.target.value)}
                        required
                        placeholder="Jelaskan faktor pendukung (misal dukungan logistik, koordinasi cepat)..."
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '12px' }}>Inovasi Kinerja (Jika Ada)</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        disabled={!isRealisasiEditable}
                        value={inovasi}
                        onChange={(e) => setInovasi(e.target.value)}
                        required
                        placeholder="Jelaskan inovasi metode kerja baru yang Anda buat..."
                      />
                    </div>
                  </div>
                )}

                {isRealisasiEditable && (
                  <button type="submit" className="btn btn-orange w-full" style={{ marginTop: '10px' }}>
                    <i className="fa-solid fa-paper-plane"></i> Ajukan Laporan Realisasi
                  </button>
                )}
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
