'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function EmployeeSelectIndicatorsPage() {
  const { fetchWithAuth, currentUser, activeRole, activeBidang, activeYear, systemSettings, allEmployees } = useSimulation();

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
          initialAssignments[n.id] = n.penanggungJawab || '';
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

  const handleAssignmentChange = (nodeId, val) => {
    if (systemSettings?.planning_locked) return;
    setAssignments(prev => ({
      ...prev,
      [nodeId]: val
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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
        
        {systemSettings?.planning_locked && (
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
                            <strong style={{ fontSize: '13.5px', color: 'white' }}>{node.text}</strong>
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
                                    <strong style={{ color: 'white' }}>{resolvePenanggungJawabLabel(node.penanggungJawab)}</strong>
                                  </div>
                                ) : (
                                  <select
                                    className="select-sim"
                                    value={assignments[node.id] || ''}
                                    disabled={systemSettings?.planning_locked}
                                    onChange={(e) => handleAssignmentChange(node.id, e.target.value)}
                                    style={{ minWidth: '220px', fontSize: '12px', background: 'var(--glass-bg)', borderColor: 'var(--glass-border)', color: 'white' }}
                                  >
                                    <option value="">-- Pilih Penanggung Jawab --</option>
                                    {getPenanggungJawabOptionsForNode(node).filter(o => o.type === 'staff').length > 0 && (
                                      <optgroup label="Nama Pegawai (Staf/Pimpinan)">
                                        {getPenanggungJawabOptionsForNode(node).filter(o => o.type === 'staff').map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {getPenanggungJawabOptionsForNode(node).filter(o => o.type === 'jabatan').length > 0 && (
                                      <optgroup label="Jabatan Pemimpin (Melekat)">
                                        {getPenanggungJawabOptionsForNode(node).filter(o => o.type === 'jabatan').map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {assignments[node.id] && !getPenanggungJawabOptionsForNode(node).some(opt => opt.value === assignments[node.id]) && (
                                      <optgroup label="Aktif Saat Ini">
                                        <option value={assignments[node.id]}>
                                          {resolvePenanggungJawabLabel(assignments[node.id])}
                                        </option>
                                      </optgroup>
                                    )}
                                  </select>
                                )}
                              </div>
                            ) : (
                              <div style={{ background: 'rgba(255, 107, 0, 0.08)', border: '1px solid rgba(255, 107, 0, 0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}>
                                <i className="fa-solid fa-user-tie text-orange" style={{ marginRight: '6px' }}></i>
                                Penanggung Jawab: <strong style={{ color: 'white' }}>{resolvePenanggungJawabLabel(node.penanggungJawab)}</strong>
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

            {isAdminUnitKerja && !systemSettings?.planning_locked && (
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
