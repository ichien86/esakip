'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Select from 'react-select';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useSimulationInternal } from '@/context/SimulationInternalContext';
import { useUI } from '@/context/UIContext';
import { useMetadata } from '@/context/MetadataContext';

export default function AdminAssignmentsPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { currentUser } = useSimulationInternal();
  const { activeBidang, activeYear } = useUI();
  const { systemSettings, allEmployees } = useMetadata();
  const [annualNodes, setAnnualNodes] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getPenanggungJawabOptions = () => {
    const options = [];
    const isSubUnitOf = (empBidangs, targetBidang) => {
      if (!empBidangs) return false;
      if (empBidangs.includes(targetBidang)) return true;
      if (targetBidang === 'Sekretariat' && empBidangs.includes('Tata Usaha')) return true;
      return false;
    };

    const unitLeaders = allEmployees.filter(e =>
      e.isActive !== false &&
      e.roles.includes('pemimpin') &&
      isSubUnitOf(e.bidangs, activeBidang) &&
      e.scopeLeader !== 'Badan' &&
      !e.jabatan.toLowerCase().includes('kepala pelaksana') &&
      !e.jabatan.toLowerCase().includes('kalaksa')
    );

    const uniqueLeaderJabatans = [...new Set(unitLeaders.map(l => l.jabatan))];
    uniqueLeaderJabatans.forEach(jab => {
      options.push({ value: `jabatan:${jab}`, label: `Jabatan: ${jab}`, type: 'jabatan' });
    });

    const pengawas = allEmployees.filter(e =>
      e.isActive !== false &&
      e.jenisJabatan === 'Pengawas' &&
      isSubUnitOf(e.bidangs, activeBidang)
    );
    const uniqueSubUnits = [...new Set(pengawas.map(l => l.subUnit).filter(Boolean))];
    uniqueSubUnits.forEach(sub => {
      options.push({ value: `subunit:${sub}`, label: `Kepala Sub-Unit: ${sub}`, type: 'jabatan' });
    });

    const staffInUnit = allEmployees.filter(e =>
      e.isActive !== false &&
      e.id !== 'admin' &&
      !e.roles.includes('pemimpin') &&
      e.jenisJabatan !== 'Pengawas' &&
      isSubUnitOf(e.bidangs, activeBidang)
    );
    staffInUnit.forEach(s => {
      options.push({ value: s.id, label: `${s.nama} (${s.jabatan})`, type: 'staff' });
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/renja/${activeYear}`);
      if (res.ok) {
        const nodes = await res.json();
        const filtered = nodes.filter(n => {
          const belongsToBidang = n.bidangPengampu.includes(activeBidang) || activeBidang === 'Pimpinan';
          if (!belongsToBidang) return false;
          if (n.crossCuttingType === 'bersama' && n.selectedBidang && activeBidang !== 'Pimpinan') {
            return n.selectedBidang === activeBidang;
          }
          return true;
        });
        setAnnualNodes(filtered);

        const isSubUnitOf = (empBidangs, targetBidang) => {
          if (!empBidangs) return false;
          if (empBidangs.includes(targetBidang)) return true;
          if (targetBidang === 'Sekretariat' && empBidangs.includes('Tata Usaha')) return true;
          return false;
        };

        const initialAssignments = {};
        filtered.forEach(n => {
          if (n.indicators && n.indicators.length > 0) {
            n.indicators.forEach(ind => {
              const existingPic = (ind.penanggungJawab || '').split(',').map(s => s.trim()).filter(Boolean);
              
              initialAssignments[ind.id] = {
                penanggungJawab: existingPic,
                crossCuttingType: ind.crossCuttingType || 'shared',
                splitTargets: ind.splitTargets || {}
              };
            });
          }
        });
        setAssignments(initialAssignments);
      }
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setLoading(false);
    }
  }, [activeBidang, activeYear, fetchWithAuth]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentUser) loadData();
  }, [currentUser, loadData]);

  const saveTimeoutRef = useRef(null);
  const autoSave = (newAssignments) => {
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
            for (const node of annualNodes) {
              if (node.indicators) {
                const match = node.indicators.find(i => i.id === idKey);
                if (match) { targetNum = parseFloat(match.target) || 0; break; }
              }
            }
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
  };

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

  const validLevels = ['kegiatan', 'sasaran_kegiatan', 'subkegiatan', 'sasaran_subkegiatan', 'aktivitas', 'sasaran_aktivitas'];
  const picOptions = getPenanggungJawabOptions();

  const getLevelColor = (level) => {
    if (['program', 'sasaran_program'].includes(level)) return { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', badge: '#10b981', label: 'Program' };
    if (['kegiatan', 'sasaran_kegiatan'].includes(level)) return { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)', badge: '#3b82f6', label: 'Kegiatan' };
    if (['subkegiatan', 'sasaran_subkegiatan'].includes(level)) return { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', badge: '#f59e0b', label: 'Subkegiatan' };
    if (['aktivitas', 'sasaran_aktivitas'].includes(level)) return { bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.3)', badge: '#8b5cf6', label: 'Aktivitas' };
    return { bg: 'rgba(15,23,42,0.3)', border: 'var(--glass-border)', badge: 'gray', label: level };
  };

  const displayNodes = annualNodes.filter(n => validLevels.includes(n.level));

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3>
          <i className="fa-solid fa-people-arrows text-orange"></i> Pembagian Indikator
        </h3>
        <p className="text-muted">
          Tentukan penanggung jawab (PIC) untuk setiap indikator kinerja di unit kerja <strong>{activeBidang}</strong> tahun <strong>{activeYear}</strong>.
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

            {displayNodes.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px' }}>
                <i className="fa-solid fa-inbox" style={{ fontSize: '32px', marginBottom: '12px', display: 'block', opacity: 0.4 }}></i>
                Tidak ada indikator yang tersedia untuk unit kerja ini.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayNodes.map(node => {
                  const styleObj = getLevelColor(node.level);
                  const isHeaderLevel = ['tujuan', 'sasaran', 'program', 'sasaran_program'].includes(node.level);
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
                        {isHeaderLevel && (
                          <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)', fontSize: '12px' }}>
                            <i className="fa-solid fa-user-tie text-orange"></i>
                            <strong style={{ color: 'var(--text-primary)' }}>{resolvePenanggungJawabLabel(node.penanggungJawab)}</strong>
                          </div>
                        )}
                      </div>

                      {/* Indicators */}
                      {node.indicators && node.indicators.length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Daftar Indikator & Penugasan:</div>
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
                                    {['program', 'sasaran_program'].includes(node.level) ? (
                                      <div style={{ background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.2)', padding: '8px 12px', borderRadius: '6px', color: 'var(--primary-orange)' }}>
                                        <i className="fa-solid fa-user-tie mr-2"></i>
                                        <span style={{ color: 'var(--text-primary)' }}>{resolvePenanggungJawabLabel(assign.penanggungJawab.join(','))}</span>
                                      </div>
                                    ) : (
                                      <Select
                                        isMulti
                                        options={picOptions}
                                        value={picOptions.filter(opt => assign.penanggungJawab.includes(opt.value))}
                                        onChange={(sel) => handleAssignmentChangeMulti(ind.id, sel ? sel.map(o => o.value) : [])}
                                        placeholder="Pilih PIC..."
                                        isDisabled={systemSettings?.renja_locked}
                                        noOptionsMessage={() => "Tidak ada data"}
                                        styles={{
                                          control: (b) => ({ ...b, background: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.3)', minHeight: '34px' }),
                                          menu: (b) => ({ ...b, background: 'rgba(255,255,255,0.97)', zIndex: 100, border: '1px solid rgba(0,0,0,0.1)' }),
                                          option: (b, s) => ({ ...b, background: s.isFocused ? 'rgba(255,107,0,0.12)' : 'transparent', color: '#1f2937', cursor: 'pointer' }),
                                          multiValue: (b) => ({ ...b, background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.3)', borderRadius: '4px' }),
                                          multiValueLabel: (b) => ({ ...b, color: '#d97706', fontWeight: 'bold', fontSize: '11px' }),
                                          multiValueRemove: (b) => ({ ...b, color: '#d97706', ':hover': { backgroundColor: 'rgba(255,107,0,0.8)', color: 'white' } }),
                                          input: (b) => ({ ...b, color: '#1f2937' }),
                                          placeholder: (b) => ({ ...b, color: '#6b7280' })
                                        }}
                                      />
                                    )}

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
