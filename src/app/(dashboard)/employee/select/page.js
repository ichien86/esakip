'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useSimulationInternal } from '@/context/SimulationInternalContext';
import { useUI } from '@/context/UIContext';
import { useMetadata } from '@/context/MetadataContext';

export default function EmployeeSelectIndicatorsPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { currentUser } = useSimulationInternal();
  const { activeRole, activeBidang, activeYear } = useUI();
  const { systemSettings, allEmployees } = useMetadata();
  const [annualNodes, setAnnualNodes] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAdminUnitKerja = activeRole === 'admin_bidang';

  const getOfficialLeaderJabatan = (bidang) => {
    const map = {
      'Badan': 'Kepala Pelaksana',
      'Sekretariat': 'Sekretaris',
      'Tata Usaha': 'Kepala Sub Bagian Tata Usaha',
      'Bidang Pencegahan dan Kesiapsiagaan': 'Kepala Bidang Pencegahan dan Kesiapsiagaan',
      'Bidang Kedaruratan dan Logistik': 'Kepala Bidang Kedaruratan dan Logistik',
      'Bidang Rehabilitasi dan Rekonstruksi': 'Kepala Bidang Rehabilitasi dan Rekonstruksi'
    };
    return map[bidang] || `Kepala ${bidang}`;
  };

  const getPenanggungJawabOptionsForNode = (node) => {
    const options = [];

    // 1. Leader positions in this unit (excluding Kepala Pelaksana / Kalaksa / Kepala Badan)
    const unitLeaders = allEmployees.filter(e =>
      e.isActive !== false &&
      e.roles.includes('pemimpin') &&
      e.bidangs.includes(activeBidang) &&
      e.scopeLeader !== 'Badan' &&
      !e.jabatan.toLowerCase().includes('kepala pelaksana') &&
      !e.jabatan.toLowerCase().includes('kalaksa')
    );

    // Get unique leader positions
    const uniqueLeaderJabatans = [...new Set(unitLeaders.map(l => l.jabatan))];
    uniqueLeaderJabatans.forEach(jab => {
      options.push({ value: `jabatan:${jab}`, label: `Jabatan: ${jab}`, type: 'jabatan' });
    });

    // 2. Active staff (non-pemimpin) employees in this unit
    const staffInUnit = allEmployees.filter(e =>
      e.isActive !== false &&
      e.id !== 'admin' &&
      !e.roles.includes('pemimpin') &&
      e.bidangs.includes(activeBidang)
    );
    staffInUnit.forEach(s => {
      options.push({ value: s.id, label: `${s.nama} (${s.jabatan})`, type: 'staff' });
    });

    return options;
  };

  const loadData = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/renja/${activeYear}`);
      if (res.ok) {
        const nodes = await res.json();
        // Filter nodes that match employee's active bidang
        const filtered = nodes.filter(n => {
          const belongsToBidang = n.bidangPengampu.includes(activeBidang) || activeBidang === 'Pimpinan';
          if (!belongsToBidang) return false;

          // If cross-cutting type is bersama, only selectedBidang can select it
          if (n.crossCuttingType === 'bersama' && n.selectedBidang && activeBidang !== 'Pimpinan') {
            return n.selectedBidang === activeBidang;
          }
          return true;
        });
        setAnnualNodes(filtered);

        // Populate assignments map for Admin Unit Kerja
        const initialAssignments = {};
        filtered.forEach(n => {
          initialAssignments[n.id] = {
            penanggungJawab: (n.penanggungJawab || '').split(',').map(s => s.trim()).filter(Boolean),
            crossCuttingType: n.crossCuttingType || 'shared',
            splitTargets: n.splitTargets || {}
          };
        });
        setAssignments(initialAssignments);
      }

      if (currentUser) {
        const selRes = await fetchWithAuth(`/api/selections/${currentUser.id}`);
        if (selRes.ok) {
          const selection = await selRes.json();
          setSelectedIds(selection.selectedIndicators || []);
        }
      }
    } catch (e) {
      console.error('Failed to load indicators', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser, activeBidang, activeYear, fetchWithAuth]);

  useEffect(() => {
    if (currentUser) {
      const timer = setTimeout(() => {
        loadData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentUser, loadData]);

  const handleAssignmentChange = (nodeId, val, action = 'toggle') => {
    if (systemSettings?.renja_locked) return;
    
    setAssignments(prev => {
      const current = prev[nodeId] || { penanggungJawab: [], crossCuttingType: 'shared', splitTargets: {} };
      let newPics = [...current.penanggungJawab];
      
      if (action === 'toggle') {
        if (newPics.includes(val)) {
          newPics = newPics.filter(p => p !== val);
        } else {
          newPics.push(val);
        }
      } else if (action === 'set') {
        newPics = [val]; // Fallback if we just want single select
      }

      return {
        ...prev,
        [nodeId]: {
          ...current,
          penanggungJawab: newPics
        }
      };
    });
  };

  const handleCrossCuttingChange = (nodeId, type) => {
    setAssignments(prev => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], crossCuttingType: type }
    }));
  };

  const handleSplitTargetChange = (nodeId, picId, val) => {
    setAssignments(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        splitTargets: {
          ...prev[nodeId].splitTargets,
          [picId]: val
        }
      }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (isAdminUnitKerja) {
      // Validate split targets
      for (const nodeId in assignments) {
        const assign = assignments[nodeId];
        if (assign.penanggungJawab && assign.penanggungJawab.length > 1 && assign.crossCuttingType === 'split') {
          const node = annualNodes.find(n => n.id === nodeId);
          if (node) {
            let sum = 0;
            assign.penanggungJawab.forEach(pic => {
              sum += parseFloat(assign.splitTargets[pic] || 0);
            });
            const targetNum = parseFloat(node.target) || 0;
            
            if (Math.abs(sum - targetNum) > 0.05) {
              setError(`Validasi Gagal: Total pembagian target untuk indikator "${node.indikator}" adalah ${sum}, sedangkan target keseluruhannya adalah ${targetNum}. Silakan sesuaikan porsi.`);
              return;
            }
          }
        }
      }
    }

    try {
      const payload = isAdminUnitKerja 
        ? { assignments } 
        : { employeeId: currentUser.id, selectedIndicators: selectedIds };

      const res = await fetchWithAuth('/api/selections', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccess(isAdminUnitKerja ? 'Penanggung jawab indikator berhasil disimpan.' : 'Pilihan indikator IKU berhasil disimpan.');
        loadData();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const getGroupedNodes = (level) => {
    return annualNodes.filter(n => n.level === level);
  };

  const levels = ['tujuan', 'sasaran', 'program', 'kegiatan', 'subkegiatan', 'aktivitas'];

  const getLevelLabel = (lvl) => {
    const labels = {
      tujuan: '1. Tujuan Strategis',
      sasaran: '2. Sasaran Strategis',
      program: '3. Program',
      kegiatan: '4. Kegiatan',
      subkegiatan: '5. Subkegiatan',
      aktivitas: '6. Aktivitas'
    };
    return labels[lvl] || lvl;
  };

  const resolvePenanggungJawabLabel = (val) => {
    if (!val) return 'Belum ditentukan';
    return val.split(',').map(v => {
      if (v.startsWith('jabatan:')) {
        const pos = v.replace('jabatan:', '');
        return `Jabatan Melekat: ${pos}`;
      }
      const emp = allEmployees.find(e => e.id === v);
      return emp ? `${emp.nama} (${emp.jabatan})` : v;
    }).join(', ');
  };

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3>
          <i className="fa-solid fa-square-check text-orange"></i> 
          {isAdminUnitKerja ? ' Pengaturan Penanggung Jawab IKU Unit Kerja' : ' Daftar Indikator Kinerja yang Diampu (IKU)'}
        </h3>
        <p className="text-muted">
          {isAdminUnitKerja 
            ? `Tentukan penanggung jawab (PIC) untuk indikator kinerja di unit kerja ${activeBidang}.` 
            : `Berikut adalah indikator kinerja Anda untuk tahun anggaran ${activeYear} di unit ${activeBidang}.`
          }
        </p>
        
        {systemSettings?.renja_locked && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#EF4444',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginTop: '12px'
          }}>
            <i className="fa-solid fa-lock" style={{ marginRight: '8px' }}></i>
            Masa perencanaan telah dikunci. Pengaturan penanggung jawab tidak dapat diubah.
          </div>
        )}
      </div>

      <div className="panel-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <i className="fa-solid fa-circle-notch fa-spin"></i> Memuat data indikator...
          </div>
        ) : (
          <form onSubmit={handleSave}>
            {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
            {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {levels.map(level => {
                const groupNodes = getGroupedNodes(level);
                
                // For non-admin unit kerja, filter list to show only their assigned indicators
                const filteredGroupNodes = isAdminUnitKerja 
                  ? groupNodes 
                  : groupNodes.filter(node => selectedIds.includes(node.id));

                if (filteredGroupNodes.length === 0) return null;

                return (
                  <div key={level} style={{
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary-orange)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px', marginBottom: '12px' }}>
                      {getLevelLabel(level)}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {filteredGroupNodes.map(node => (
                        <div key={node.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '20px',
                          padding: '10px',
                          borderRadius: '8px',
                          background: 'rgba(15,23,42,0.3)',
                          border: '1px solid var(--glass-border)',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ flex: 1, minWidth: '250px' }}>
                            <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>{node.text}</strong>
                            <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                              Indikator: <strong>{node.indikator}</strong> | Target: <strong>{node.target} {node.satuan}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {isAdminUnitKerja ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '10px', color: 'var(--primary-orange)', fontWeight: 'bold', margin: 0 }}>
                                  Penanggung Jawab:
                                </label>
                                {['tujuan', 'sasaran', 'program', 'sasaran_program'].includes(node.level) ? (
                                  <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', minWidth: '220px' }}>
                                    <i className="fa-solid fa-user-tie text-orange" style={{ marginRight: '6px' }}></i>
                                    <strong style={{ color: 'var(--text-primary)' }}>{resolvePenanggungJawabLabel(node.penanggungJawab)}</strong>
                                  </div>
                                ) : (
                                  <div style={{ minWidth: '280px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-muted)' }}>-- Pilih Penanggung Jawab --</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto', paddingRight: '8px' }}>
                                      {getPenanggungJawabOptionsForNode(node).map(opt => (
                                        <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: 0, cursor: systemSettings?.renja_locked ? 'not-allowed' : 'pointer' }}>
                                          <input 
                                            type="checkbox" 
                                            style={{ marginTop: '2px' }}
                                            checked={(assignments[node.id]?.penanggungJawab || []).includes(opt.value)}
                                            onChange={() => handleAssignmentChange(node.id, opt.value, 'toggle')}
                                            disabled={systemSettings?.renja_locked}
                                          />
                                          <span style={{ color: 'var(--text-primary)', lineHeight: '1.4' }}>{opt.label}</span>
                                        </label>
                                      ))}
                                    </div>
                                    
                                    {(assignments[node.id]?.penanggungJawab || []).length > 1 && (
                                      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--glass-border)' }}>
                                        <div style={{ marginBottom: '10px', fontWeight: 'bold', color: 'var(--primary-orange)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <i className="fa-solid fa-people-group"></i> Kolaborasi (Crosscutting)
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, cursor: 'pointer' }}>
                                            <input type="radio" checked={assignments[node.id]?.crossCuttingType === 'shared'} onChange={() => handleCrossCuttingChange(node.id, 'shared')} /> Shared (Sama)
                                          </label>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, cursor: 'pointer' }}>
                                            <input type="radio" checked={assignments[node.id]?.crossCuttingType === 'split'} onChange={() => handleCrossCuttingChange(node.id, 'split')} /> Split (Bagi Porsi)
                                          </label>
                                        </div>
                                        {assignments[node.id]?.crossCuttingType === 'split' && (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,107,0,0.05)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,107,0,0.2)' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--info)', fontWeight: 600, borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '4px' }}>
                                              Target Keseluruhan: {node.target} {node.satuan}
                                            </div>
                                            {(assignments[node.id]?.penanggungJawab || []).map(pic => (
                                              <div key={pic} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resolvePenanggungJawabLabel(pic)}</span>
                                                <input 
                                                  type="number" 
                                                  style={{ width: '80px', padding: '4px 6px', fontSize: '11px', background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', textAlign: 'center' }}
                                                  placeholder="Porsi"
                                                  value={assignments[node.id]?.splitTargets[pic] || ''}
                                                  onChange={(e) => handleSplitTargetChange(node.id, pic, e.target.value)}
                                                />
                                              </div>
                                            ))}
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                                              * Pastikan jumlah dari semua porsi sama dengan {node.target}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ background: 'rgba(255, 107, 0, 0.08)', border: '1px solid rgba(255, 107, 0, 0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}>
                                <i className="fa-solid fa-user-tie text-orange" style={{ marginRight: '6px' }}></i>
                                Penanggung Jawab: <strong style={{ color: 'var(--text-primary)' }}>{resolvePenanggungJawabLabel(node.penanggungJawab)}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {isAdminUnitKerja && !systemSettings?.renja_locked && (
              <button type="submit" className="btn btn-orange mt-4" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}>
                <i className="fa-solid fa-floppy-disk"></i> Simpan Penanggung Jawab
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
