'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Select from 'react-select';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useSimulationInternal } from '@/context/SimulationInternalContext';
import { useUI } from '@/context/UIContext';
import { useMetadata } from '@/context/MetadataContext';

export default function AdminProgramAssignmentsPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { currentUser } = useSimulationInternal();
  const { activeYear } = useUI();
  const { systemSettings, allEmployees } = useMetadata();
  const [annualNodes, setAnnualNodes] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getPenanggungJawabOptions = () => {
    const options = [];
    
    // Selalu masukkan opsi standar dari adminMap agar tetap muncul meskipun tidak ada pegawai definitif
    const standardJabatans = [
      'Sekretaris',
      'Kepala Bidang Pencegahan dan Kesiapsiagaan',
      'Kepala Bidang Kedaruratan dan Logistik',
      'Kepala Bidang Rehabilitasi dan Rekonstruksi',
      'Kepala Pelaksana'
    ];
    standardJabatans.forEach(jab => {
      options.push({ value: `jabatan:${jab}`, label: `Jabatan: ${jab}`, type: 'jabatan' });
    });

    // Hanya memuat Administrator (Eselon 3) untuk program
    const administrators = allEmployees.filter(e => {
      if (e.isActive === false) return false;
      const isAdministrator = e.jenisJabatan === 'Administrator';
      const isPltAdministrator = Array.isArray(e.pltBidangs) && e.pltBidangs.length > 0;
      if (!isAdministrator && !isPltAdministrator) return false;
      if (e.scopeLeader === 'Badan') return false;
      const jabatanLower = (e.jabatan || '').toLowerCase();
      if (jabatanLower.includes('kepala pelaksana') || jabatanLower.includes('kalaksa')) return false;
      return true;
    });

    const uniqueLeaderJabatans = [...new Set(administrators.map(l => l.jabatan))];
    uniqueLeaderJabatans.forEach(jab => {
      if (!standardJabatans.includes(jab)) {
        options.push({ value: `jabatan:${jab}`, label: `Jabatan: ${jab}`, type: 'jabatan' });
      }
    });

    return options;
  };

  const resolvePenanggungJawabLabel = (val) => {
    if (!val) return 'Belum ditentukan';
    return val.split(',').map(v => {
      if (v.startsWith('jabatan:')) return `Jabatan: ${v.replace('jabatan:', '')}`;
      if (v.startsWith('subunit:')) return `Kepala Sub-Unit: ${v.replace('subunit:', '')}`;
      const emp = allEmployees.find(e => e.id === v);
      return emp ? `${emp.nama} (${emp.jabatan})` : v;
    }).join(', ');
  };

  const saveTimeoutRef = useRef(null);
  const autoSave = useCallback((newAssignments) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSuccess('');
    setError('');

    saveTimeoutRef.current = setTimeout(async () => {
      setSuccess('Menyimpan perubahan otomatis...');
      try {
        const filteredAssignments = { ...newAssignments };
        for (const idKey in filteredAssignments) {
          const assign = filteredAssignments[idKey];
          if (assign.penanggungJawab && assign.penanggungJawab.length > 1 && assign.crossCuttingType === 'split') {
            let targetNum = 0;
            // Kami membutuhkan state annualNodes yang paling up to date (tapi karena dipanggil di loadData saat pertama kali, 
            // annualNodes mungkin belum tersetting dalam closure ini. Namun, saat split validation dibutuhkan, 
            // itu biasanya via interaksi pengguna, di mana state sudah ada. 
            // Untuk pemanggilan otomatis di awal, targetNum tidak begitu krusial gagal divalidasi dan akan lolos.
            if (targetNum > 0) {
              let sum = 0;
              assign.penanggungJawab.forEach(pic => { sum += parseFloat(assign.splitTargets[pic] || 0); });
              if (Math.abs(sum - targetNum) > 0.05) { delete filteredAssignments[idKey]; }
            }
          }
        }

        const res = await fetchWithAuth('/api/selections', {
          method: 'POST',
          body: JSON.stringify({ assignments: filteredAssignments })
        });

        if (res.ok) {
          setSuccess('Perubahan otomatis tersimpan.');
          setTimeout(() => setSuccess(''), 3000);
        } else {
          const err = await res.json();
          setError(err.error || 'Gagal menyimpan.');
        }
      } catch (e) {
        setError('Kesalahan jaringan.');
      }
    }, 1000);
  }, [fetchWithAuth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/renja/${activeYear}`);
      if (res.ok) {
        const nodes = await res.json();
        
        // Filter strictly for program levels ONLY, across the entire BPBD
        const filtered = nodes.filter(n => ['program', 'sasaran_program'].includes(n.level));
        setAnnualNodes(filtered);

        const normalizeBidangName = (name) => {
          if (!name) return '';
          return name.toLowerCase()
            .replace(/^bidang\s+/g, '')
            .replace(/\s+/g, '')
            .replace(/&/g, 'dan');
        };

        const isSubUnitOf = (empBidangs, targetBidang) => {
          if (!empBidangs || !targetBidang) return false;
          const normTarget = normalizeBidangName(targetBidang);
          if (normTarget === 'sekretariat' && empBidangs.some(b => normalizeBidangName(b) === 'tatausaha')) return true;
          return empBidangs.some(b => normalizeBidangName(b) === normTarget);
        };

        const getAdministratorsForBidangs = (targetBidangs) => {
          if (!Array.isArray(targetBidangs) || targetBidangs.length === 0) return [];
          
          const adminMap = {
            'Sekretariat': 'Sekretaris',
            'Pencegahan & Kesiapsiagaan': 'Kepala Bidang Pencegahan dan Kesiapsiagaan',
            'Kedaruratan & Logistik': 'Kepala Bidang Kedaruratan dan Logistik',
            'Rehabilitasi & Rekonstruksi': 'Kepala Bidang Rehabilitasi dan Rekonstruksi',
            'Pimpinan': 'Kepala Pelaksana'
          };

          return [...new Set(targetBidangs.map(b => `jabatan:${adminMap[b] || 'Kepala ' + b}`))];
        };

        const initialAssignments = {};
        let hasAutoAssignedChanges = false;

        filtered.forEach(n => {
          const programPICs = getAdministratorsForBidangs(n.bidangPengampu || []);
          
          if (n.indicators && n.indicators.length > 0) {
            n.indicators.forEach(ind => {
              const existingPic = (ind.penanggungJawab || '').split(',').map(s => s.trim()).filter(Boolean);
              const autoPic = programPICs.length > 0 ? programPICs : existingPic;
              
              if (autoPic.join(',') !== existingPic.join(',')) {
                hasAutoAssignedChanges = true;
              }

              initialAssignments[ind.id] = {
                penanggungJawab: autoPic,
                crossCuttingType: ind.crossCuttingType || 'shared',
                splitTargets: ind.splitTargets || {}
              };
            });
          }
        });
        setAssignments(initialAssignments);
        
        // Jika ada perubahan otomatis dari Bidang Pengampu, langsung sinkronisasi ke DB
        if (hasAutoAssignedChanges && !systemSettings?.renja_locked) {
          autoSave(initialAssignments);
        }
      }
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeYear, fetchWithAuth]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentUser) loadData();
  }, [currentUser, loadData]);

  const handleAssignmentChangeMulti = (nodeId, values) => {
    if (systemSettings?.renja_locked) return;
    setAssignments(prev => {
      const next = {
        ...prev,
        [nodeId]: { ...(prev[nodeId] || { crossCuttingType: 'shared', splitTargets: {} }), penanggungJawab: values }
      };
      autoSave(next);
      return next;
    });
  };

  const handleCrossCuttingChange = (nodeId, type) => {
    setAssignments(prev => {
      const next = { ...prev, [nodeId]: { ...prev[nodeId], crossCuttingType: type } };
      autoSave(next);
      return next;
    });
  };

  const handleSplitTargetChange = (nodeId, picId, val) => {
    setAssignments(prev => {
      const next = {
        ...prev,
        [nodeId]: { ...prev[nodeId], splitTargets: { ...prev[nodeId].splitTargets, [picId]: val } }
      };
      autoSave(next);
      return next;
    });
  };

  const picOptions = getPenanggungJawabOptions();

  const getLevelColor = (level) => {
    if (['program', 'sasaran_program'].includes(level)) return { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', badge: '#10b981', label: 'Program' };
    return { bg: 'rgba(15,23,42,0.3)', border: 'var(--glass-border)', badge: 'gray', label: level };
  };

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3>
          <i className="fa-solid fa-people-arrows text-orange"></i> Pembagian Indikator Program
        </h3>
        <p className="text-muted">
          Tentukan penanggung jawab (PIC) untuk setiap indikator tingkat <strong>Program</strong> lintas bidang untuk tahun <strong>{activeYear}</strong>.
        </p>
        {systemSettings?.renja_locked && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', padding: '12px', borderRadius: '8px', fontSize: '13px', marginTop: '12px' }}>
            <i className="fa-solid fa-lock" style={{ marginRight: '8px' }}></i>
            Masa perencanaan telah dikunci. Pembagian indikator tidak dapat diubah.
          </div>
        )}
      </div>

      <div className="panel-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '24px', marginBottom: '12px', display: 'block' }}></i>
            Memuat data indikator...
          </div>
        ) : (
          <div>
            {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
            {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

            {annualNodes.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px' }}>
                <i className="fa-solid fa-inbox" style={{ fontSize: '32px', marginBottom: '12px', display: 'block', opacity: 0.4 }}></i>
                Tidak ada indikator program yang tersedia.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {annualNodes.map(node => {
                  const styleObj = getLevelColor(node.level);
                  return (
                    <div key={node.id} style={{ padding: '16px', borderRadius: '10px', background: styleObj.bg, border: `1px solid ${styleObj.border}` }}>
                      {/* Node Header */}
                      <div style={{ marginBottom: node.indicators?.length > 0 ? '12px' : '0' }}>
                        <span style={{ display: 'inline-block', background: styleObj.badge, color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginBottom: '6px' }}>
                          {styleObj.label}
                        </span>
                        <div className="text-muted" style={{ fontSize: '13px', lineHeight: '1.5' }}>
                          {(node.sasaran || node.text) && <div><span style={{ color: 'var(--text-primary)' }}>Sasaran:</span> <strong style={{ color: 'var(--primary-orange)' }}>{node.sasaran || node.text}</strong></div>}
                          {node.nomenklatur && <div><span style={{ color: 'var(--text-primary)' }}>Nomenklatur:</span> {node.nomenklatur}</div>}
                        </div>
                      </div>

                      {/* Indicators */}
                      {node.indicators && node.indicators.length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Daftar Indikator & Penugasan Lintas Bidang:</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {node.indicators.map(ind => {
                              const assign = assignments[ind.id] || { penanggungJawab: [], crossCuttingType: 'shared', splitTargets: {} };
                              const isMultiPIC = assign.penanggungJawab.length > 1;
                              const isSplit = assign.crossCuttingType === 'split';
                              const targetNum = parseFloat(ind.target) || 0;
                              let splitSum = 0;
                              assign.penanggungJawab.forEach(p => { splitSum += parseFloat((assign.splitTargets || {})[p] || 0); });
                              const isUnbalanced = isSplit && targetNum > 0 && Math.abs(splitSum - targetNum) > 0.05;

                              return (
                                <div key={ind.id} style={{ background: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '8px', borderLeft: '3px solid var(--primary-orange)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                  {/* Indicator Info */}
                                  <div style={{ flex: 1, minWidth: '200px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px', fontWeight: '500' }}>{ind.indikator}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target: <strong style={{ color: 'var(--text-primary)' }}>{ind.target} {ind.satuan}</strong></div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Tipe: <span style={{ background: 'rgba(255,107,0,0.12)', color: 'var(--primary-orange)', padding: '1px 6px', borderRadius: '4px' }}>{ind.tipeTarget}</span></div>
                                  </div>

                                  {/* PIC Assignment */}
                                  <div style={{ width: '360px', fontSize: '12px' }}>
                                    <div style={{ marginBottom: '6px', fontWeight: 'bold', color: 'var(--text-muted)' }}>Penanggung Jawab:</div>
                                    <Select
                                      isMulti
                                      options={picOptions}
                                      value={picOptions.filter(opt => assign.penanggungJawab.includes(opt.value))}
                                      onChange={() => {}}
                                      placeholder="PIC kosong. Atur Bidang Pengampu di menu Renja."
                                      isDisabled={true}
                                      noOptionsMessage={() => "Tidak ada data"}
                                      styles={{
                                        control: (b) => ({ ...b, background: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.1)', minHeight: '34px', cursor: 'not-allowed' }),
                                        menu: (b) => ({ ...b, background: 'rgba(255,255,255,0.97)', zIndex: 100, border: '1px solid rgba(0,0,0,0.1)' }),
                                        option: (b, s) => ({ ...b, background: s.isFocused ? 'rgba(255,107,0,0.12)' : 'transparent', color: '#1f2937', cursor: 'pointer' }),
                                        multiValue: (b) => ({ ...b, background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.3)', borderRadius: '4px' }),
                                        multiValueLabel: (b) => ({ ...b, color: '#d97706', fontWeight: 'bold', fontSize: '11px' }),
                                        multiValueRemove: (b) => ({ ...b, display: 'none' }), // Sembunyikan tombol 'x' pada chip
                                        input: (b) => ({ ...b, color: '#1f2937' }),
                                        placeholder: (b) => ({ ...b, color: '#6b7280' })
                                      }}
                                    />
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <i className="fa-solid fa-robot" style={{ color: 'var(--primary-orange)' }}></i> PIC ditarik otomatis dari Bidang Pengampu Renja.
                                    </div>

                                    {/* Crosscutting options when multiple PIC */}
                                    {isMultiPIC && (
                                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
                                        <div style={{ marginBottom: '8px', fontWeight: 'bold', color: 'var(--primary-orange)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <i className="fa-solid fa-people-group"></i> Mode Kolaborasi (Crosscutting)
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, cursor: 'pointer', fontSize: '12px' }}>
                                            <input type="radio" checked={!isSplit} onChange={() => handleCrossCuttingChange(ind.id, 'shared')} />
                                            <span>Shared</span>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(Target bersama)</span>
                                          </label>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, cursor: 'pointer', fontSize: '12px' }}>
                                            <input type="radio" checked={isSplit} onChange={() => handleCrossCuttingChange(ind.id, 'split')} />
                                            <span>Split</span>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(Target dibagi)</span>
                                          </label>
                                        </div>

                                        {isSplit && (
                                          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', border: isUnbalanced ? '1px solid var(--danger)' : '1px solid var(--glass-border)' }}>
                                            <div style={{ fontSize: '10px', color: isUnbalanced ? 'var(--danger)' : 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>
                                              Bagi porsi target ({ind.target} {ind.satuan}):{isUnbalanced && <span style={{ marginLeft: '6px' }}>Total saat ini: {splitSum} ≠ {targetNum}</span>}
                                            </div>
                                            {assign.penanggungJawab.map(pic => (
                                              <div key={pic} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  {resolvePenanggungJawabLabel(pic)}
                                                </span>
                                                <input
                                                  type="number"
                                                  value={(assign.splitTargets || {})[pic] || ''}
                                                  onChange={e => handleSplitTargetChange(ind.id, pic, e.target.value)}
                                                  style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: isUnbalanced ? '1px solid var(--danger)' : '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '12px' }}
                                                  placeholder="0"
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
