'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function SupervisorApprovalsPage() {
  const { activeEmployeeId, activeRole } = useSimulation();
  
  const [activeTab, setActiveTab] = useState('perjakin'); // perjakin, bulanan
  const [pendingDocs, setPendingDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());

  useEffect(() => {
    if (activeEmployeeId) {
      fetchPendingApprovals();
    } else {
      setLoading(false);
    }
  }, [activeEmployeeId, selectedTahun, activeTab]);

  const fetchPendingApprovals = async () => {
    setLoading(true);
    setErrorMsg('');
    setPendingDocs([]);
    
    try {
      if (activeTab === 'perjakin') {
        const res = await fetch(`/api/perjakin/approval?supervisorId=${activeEmployeeId}&tahun=${selectedTahun}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar persetujuan');
        
        setPendingDocs(data.data);
      } else {
        // Placeholder for monthly realisasi
        setPendingDocs([]);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (employeeId, newStatus, actionName) => {
    let note = '';
    if (newStatus === 'Ditolak') {
      note = prompt('Masukkan alasan penolakan/revisi:');
      if (note === null) return; // cancelled
    } else {
      if (!confirm(`Apakah Anda yakin ingin ${actionName} dokumen ini?`)) return;
      note = `Disetujui oleh atasan langsung`;
    }
    
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        employeeId,
        tahun: selectedTahun,
        newStatus,
        actorRole: activeRole,
        actorName: 'Pimpinan (Simulasi)', 
        notes: note
      };

      const res = await fetch('/api/perjakin/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Gagal memproses persetujuan');
      
      setSuccessMsg(`Dokumen berhasil ${actionName.toLowerCase()}!`);
      fetchPendingApprovals();
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
          Silakan pilih identitas simulasi Supervisor terlebih dahulu.
        </div>
      </div>
    );
  }

  // Mobile friendly card style
  const cardStyle = {
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid #f1f5f9',
    position: 'relative',
    overflow: 'hidden'
  };

  return (
    <div className="container-fluid py-4 fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h4 mb-1" style={{ fontWeight: 'bold' }}>Pusat Persetujuan</h1>
          <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Kelola persetujuan kinerja bawahan Anda</p>
        </div>
        <div>
          <select 
            className="form-select form-select-sm" 
            style={{ borderRadius: '20px', padding: '6px 15px' }}
            value={selectedTahun}
            onChange={(e) => setSelectedTahun(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '5px' }}>
        <button 
          className={`btn-sim ${activeTab === 'perjakin' ? 'primary' : ''}`}
          style={{ borderRadius: '20px', background: activeTab !== 'perjakin' ? '#e2e8f0' : '', color: activeTab !== 'perjakin' ? '#475569' : '', padding: '8px 20px', border: 'none', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('perjakin')}
        >
          <i className="fa-solid fa-file-signature mr-2"></i> Perjanjian Kinerja
        </button>
        <button 
          className={`btn-sim ${activeTab === 'bulanan' ? 'primary' : ''}`}
          style={{ borderRadius: '20px', background: activeTab !== 'bulanan' ? '#e2e8f0' : '', color: activeTab !== 'bulanan' ? '#475569' : '', padding: '8px 20px', border: 'none', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('bulanan')}
        >
          <i className="fa-solid fa-calendar-check mr-2"></i> Realisasi Bulanan
        </button>
      </div>

      {errorMsg && <div className="alert-sim error mb-4" style={{ borderRadius: '12px' }}>{errorMsg}</div>}
      {successMsg && <div className="alert-sim success mb-4" style={{ borderRadius: '12px' }}>{successMsg}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Memuat daftar antrean...</p>
        </div>
      ) : pendingDocs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
          <i className="fa-solid fa-mug-hot" style={{ fontSize: '48px', color: '#94a3b8', marginBottom: '16px' }}></i>
          <h5 style={{ fontWeight: 'bold', color: '#475569' }}>Semua Selesai!</h5>
          <p className="text-muted">Tidak ada dokumen yang perlu persetujuan Anda saat ini.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {pendingDocs.map(doc => (
            <div key={doc._id} style={cardStyle} className="slide-up">
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--primary-orange)' }}></div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h5 style={{ fontWeight: 'bold', margin: '0 0 4px 0', fontSize: '16px' }}>{doc.employeeName}</h5>
                  <p className="text-muted" style={{ margin: 0, fontSize: '13px' }}>{doc.employeeJabatan}</p>
                </div>
                <span className="badge badge-warning" style={{ fontSize: '11px', borderRadius: '20px', padding: '6px 12px' }}>
                  Menunggu Anda
                </span>
              </div>
              
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>
                    <i className="fa-solid fa-file-lines mr-2"></i>
                    Dokumen Perjakin {doc.tahun}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Diajukan pada {doc.history.length > 0 ? new Date(doc.history[doc.history.length-1].timestamp).toLocaleDateString('id-ID') : '-'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="btn-sim success" 
                  style={{ flex: 1, borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 'bold' }}
                  onClick={() => handleAction(doc.employeeId, 'Disetujui', 'Menyetujui')}
                  disabled={actionLoading}
                >
                  <i className="fa-solid fa-check mr-2"></i> Setujui
                </button>
                <button 
                  className="btn-sim danger" 
                  style={{ flex: 1, borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 'bold', background: '#fff', color: '#ef4444', border: '1px solid #ef4444' }}
                  onClick={() => handleAction(doc.employeeId, 'Ditolak', 'Menolak')}
                  disabled={actionLoading}
                >
                  <i className="fa-solid fa-xmark mr-2"></i> Tolak / Revisi
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
