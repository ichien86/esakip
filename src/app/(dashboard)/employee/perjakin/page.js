'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function EmployeePerjakinPage() {
  const { activeEmployeeId, activeRole } = useSimulation();
  
  const [perjakinData, setPerjakinData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Default to current year
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());

  useEffect(() => {
    if (activeEmployeeId) {
      fetchPerjakin();
    } else {
      setLoading(false);
    }
  }, [activeEmployeeId, selectedTahun]);

  const fetchPerjakin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/perjakin?employeeId=${activeEmployeeId}&tahun=${selectedTahun}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data Perjakin');
      
      setPerjakinData(data.data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAjukan = async () => {
    if (!confirm('Apakah Anda yakin ingin mengajukan Perjakin ini untuk diverifikasi oleh Admin Unit?')) return;
    
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        employeeId: activeEmployeeId,
        tahun: selectedTahun,
        newStatus: 'Menunggu Verifikasi Unit',
        actorRole: activeRole,
        actorName: 'Pegawai (Simulasi)', // ideally from actual logged in user
        notes: 'Diajukan oleh pegawai'
      };

      const res = await fetch('/api/perjakin/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Gagal mengajukan');
      
      setSuccessMsg('Perjakin berhasil diajukan!');
      fetchPerjakin(); // refresh data
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeEmployeeId) {
    return (
      <div className="container-fluid py-4 fade-in">
        <div className="alert-sim error">
          Silakan pilih identitas simulasi Pegawai terlebih dahulu.
        </div>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Draft': return <span className="badge badge-draft" style={{ fontSize: '14px', padding: '6px 12px' }}><i className="fa-solid fa-file-pen mr-2"></i>Draft (Belum Diajukan)</span>;
      case 'Menunggu Verifikasi Unit': return <span className="badge badge-warning" style={{ fontSize: '14px', padding: '6px 12px' }}><i className="fa-solid fa-clock mr-2"></i>Menunggu Verifikasi Admin Unit</span>;
      case 'Menunggu Verifikasi Perencana': return <span className="badge badge-warning" style={{ fontSize: '14px', padding: '6px 12px' }}><i className="fa-solid fa-clock mr-2"></i>Menunggu Verifikasi BAPPERIDA</span>;
      case 'Menunggu Persetujuan Atasan': return <span className="badge badge-info" style={{ fontSize: '14px', padding: '6px 12px', background: '#3b82f6', color: 'white' }}><i className="fa-solid fa-user-tie mr-2"></i>Menunggu ACC Atasan</span>;
      case 'Disetujui': return <span className="badge badge-success" style={{ fontSize: '14px', padding: '6px 12px' }}><i className="fa-solid fa-circle-check mr-2"></i>Disetujui Pimpinan</span>;
      case 'Ditolak': return <span className="badge badge-danger" style={{ fontSize: '14px', padding: '6px 12px' }}><i className="fa-solid fa-circle-xmark mr-2"></i>Ditolak / Revisi</span>;
      default: return <span className="badge badge-draft">{status}</span>;
    }
  };

  return (
    <div className="container-fluid py-4 fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0 text-gray-800" style={{ fontWeight: 'bold' }}>Perjanjian Kinerja Saya</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ margin: 0, fontWeight: 'bold' }}>Tahun:</label>
          <select 
            className="form-select" 
            style={{ width: '120px' }}
            value={selectedTahun}
            onChange={(e) => setSelectedTahun(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {errorMsg && <div className="alert-sim error mb-4">{errorMsg}</div>}
      {successMsg && <div className="alert-sim success mb-4">{successMsg}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>Memuat data Perjakin...</div>
      ) : !perjakinData ? (
        <div className="alert-sim error">Gagal memuat data.</div>
      ) : (
        <div className="row">
          <div className="col-lg-4 mb-4">
            <div className="card-sim h-100">
              <div className="card-header-sim">
                <h5 className="mb-0">Status Dokumen</h5>
              </div>
              <div className="card-body-sim text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
                <div className="mb-4">
                  {getStatusBadge(perjakinData.status)}
                </div>
                
                {['Draft', 'Ditolak'].includes(perjakinData.status) && (
                  <button 
                    className="btn-sim primary btn-lg" 
                    onClick={handleAjukan}
                    disabled={actionLoading || perjakinData.items.length === 0}
                  >
                    {actionLoading ? 'Memproses...' : <><i className="fa-solid fa-paper-plane mr-2"></i> Ajukan Perjakin</>}
                  </button>
                )}

                {perjakinData.items.length === 0 && (
                  <p className="text-muted mt-3" style={{ fontSize: '12px' }}>
                    Anda belum memiliki Indikator Kinerja yang ditugaskan untuk tahun ini. Tidak bisa mengajukan Perjakin kosong.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-8 mb-4">
            <div className="card-sim h-100">
              <div className="card-header-sim d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Daftar Indikator Kinerja Utama ({perjakinData.tahun})</h5>
                <span className="badge badge-info">{perjakinData.items.length} Indikator</span>
              </div>
              <div className="card-body-sim" style={{ padding: 0 }}>
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead style={{ background: '#f8fafc' }}>
                      <tr>
                        <th style={{ width: '5%' }}>No</th>
                        <th style={{ width: '40%' }}>Sasaran / Kegiatan</th>
                        <th style={{ width: '35%' }}>Indikator</th>
                        <th style={{ width: '20%' }}>Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perjakinData.items.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center text-muted py-4">Belum ada indikator yang ditugaskan.</td>
                        </tr>
                      ) : (
                        perjakinData.items.map((item, index) => (
                          <tr key={item.id}>
                            <td className="text-center">{index + 1}</td>
                            <td style={{ fontSize: '13px' }}>{item.sasaran}</td>
                            <td style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.indikator}</td>
                            <td className="text-center">
                              <span className="badge badge-success" style={{ fontSize: '13px' }}>
                                {item.target} {item.satuan}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {perjakinData.history && perjakinData.history.length > 0 && (
            <div className="col-12 mt-2">
              <div className="card-sim">
                <div className="card-header-sim">
                  <h5 className="mb-0">Riwayat Persetujuan</h5>
                </div>
                <div className="card-body-sim">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {perjakinData.history.map((h, i) => (
                      <div key={i} style={{ display: 'flex', gap: '15px', padding: '10px', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid var(--primary-orange)' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', minWidth: '130px' }}>
                          {new Date(h.timestamp).toLocaleString('id-ID')}
                        </div>
                        <div>
                          <strong style={{ fontSize: '13px' }}>{h.actorName} ({h.actorRole})</strong> mengubah status menjadi <span className="text-primary">{h.status}</span>
                          {h.notes && <div style={{ fontSize: '13px', marginTop: '4px', fontStyle: 'italic' }}>Catatan: {h.notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
