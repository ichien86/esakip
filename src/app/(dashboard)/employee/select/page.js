'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function EmployeeSelectIndicatorsPage() {
  const { fetchWithAuth, currentUser, activeBidang, systemSettings } = useSimulation();

  const [annualNodes, setAnnualNodes] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      const res = await fetch('/api/renja/2026'); // Load Renja 2026
      if (res.ok) {
        const nodes = await res.json();
        // Filter nodes that match employee's active bidang
        const filtered = nodes.filter(n =>
          n.bidangPengampu.includes(activeBidang) ||
          activeBidang === 'Pimpinan'
        );
        setAnnualNodes(filtered);
      }

      if (currentUser) {
        const selRes = await fetch(`/api/selections/${currentUser.id}`);
        if (selRes.ok) {
          const selection = await selRes.json();
          setSelectedIds(selection.selectedIndicators || []);
        }
      }
    } catch (e) {
      console.error('Failed to load indicators for selection', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, activeBidang]);

  const handleCheckboxChange = (id) => {
    if (systemSettings?.planning_locked) return;

    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetchWithAuth('/api/selections', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: currentUser.id,
          selectedIndicators: selectedIds
        })
      });

      if (res.ok) {
        setSuccess('Pilihan indikator IKU berhasil disimpan.');
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan pilihan.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  // Group nodes by level for clean rendering
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

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3><i className="fa-solid fa-square-check text-orange"></i> Pemilihan Indikator Kinerja yang Diampu</h3>
        <p className="text-muted">Centang indikator di bawah ini yang menjadi tugas tanggung jawab Anda untuk tahun anggaran 2026.</p>
        
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
            Masa perencanaan telah dikunci. Anda tidak dapat mengubah pilihan indikator IKU.
          </div>
        )}
      </div>

      <div className="panel-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}><i className="fa-solid fa-circle-notch fa-spin"></i> Memuat data indikator...</div>
        ) : (
          <form onSubmit={handleSave}>
            {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
            {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {levels.map(level => {
                const groupNodes = getGroupedNodes(level);
                if (groupNodes.length === 0) return null;

                return (
                  <div key={level} style={{
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary-orange)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px', marginBottom: '10px' }}>
                      {getLevelLabel(level)}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {groupNodes.map(node => (
                        <label key={node.id} style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          fontSize: '13px',
                          cursor: (systemSettings?.planning_locked || node.level === 'program') ? 'not-allowed' : 'pointer',
                          margin: 0,
                          padding: '6px',
                          borderRadius: '4px',
                          transition: 'background 0.2s',
                          background: selectedIds.includes(node.id) ? 'rgba(255,107,0,0.04)' : ''
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(node.id)}
                            disabled={systemSettings?.planning_locked || node.level === 'program'}
                            onChange={() => handleCheckboxChange(node.id)}
                            style={{ marginTop: '3px', cursor: (systemSettings?.planning_locked || node.level === 'program') ? 'not-allowed' : 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <strong>{node.text}</strong>
                            <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                              Indikator: <strong>{node.indikator}</strong> | Target: <strong>{node.target} {node.satuan}</strong>
                              {node.bidangPengampu.length > 1 && (
                                <span className="badge badge-score" style={{ fontSize: '8px', marginLeft: '6px', padding: '1px 5px' }}>
                                  Cross-cutting ({node.crossCuttingType === 'split' ? `Porsi Bidang: ${node.splitTargets[activeBidang] || '-'}` : 'Shared'})
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {!systemSettings?.planning_locked && (
              <button type="submit" className="btn btn-orange mt-4" style={{ display: 'flex', alignItems: 'center' }}>
                <i className="fa-solid fa-floppy-disk"></i> Simpan Pilihan Indikator
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
