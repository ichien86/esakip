'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSimulation } from '@/context/SimulationContext';
import PrintLayout from './PrintLayout';

export default function AdminPerjakinPage() {
  const { activeRole, activeYear, allEmployees } = useSimulation();
  
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  
  const [perjakinData, setPerjakinData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const printRef = useRef(null);

  useEffect(() => {
    if (allEmployees && allEmployees.length > 0) {
      setEmployees(allEmployees.filter(e => !e.roles?.includes('bupati')));
    }
  }, [allEmployees]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) {
      setErrorMsg('Silakan pilih pegawai terlebih dahulu.');
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    setPerjakinData(null);

    try {
      const res = await fetch(`/api/perjakin?employeeId=${selectedEmployee}&tahun=${activeYear}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data Perjakin');
      
      setPerjakinData(data.data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifikasi = async (newStatus) => {
    if (!confirm('Apakah Anda yakin ingin memverifikasi dokumen ini?')) return;
    
    setLoading(true);
    try {
      const payload = {
        employeeId: selectedEmployee,
        tahun: activeYear,
        newStatus: newStatus,
        actorRole: activeRole,
        actorName: 'Admin',
        notes: 'Diverifikasi oleh Admin'
      };

      const res = await fetch('/api/perjakin/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Gagal memverifikasi');
      
      // refresh data
      handleGenerate({ preventDefault: () => {} });
    } catch (err) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (activeRole !== 'perencana') {
    return (
      <div className="alert-sim error fade-in">
        <i className="fi fi-rr-ban" style={{ marginRight: '8px' }}></i>
        Akses Ditolak. Halaman ini khusus untuk Admin Perencana.
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 fade-in">
      {/* Hide controls during print */}
      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>

      <div className="no-print">
        <h1 className="h3 mb-4" style={{ fontWeight: 'bold' }}>Cetak Perjanjian Kinerja (Perjakin)</h1>
        
        <div className="card-sim mb-4">
          <div className="card-header-sim">
            <h5 className="mb-0">Filter Data Perjakin</h5>
          </div>
          <div className="card-body-sim">
            <form onSubmit={handleGenerate} className="row g-3 align-items-end">
              <div className="col-md-9">
                <label className="form-label">Pilih Pegawai (Pihak Pertama) — Tahun Aktif: <strong>{activeYear}</strong></label>
                <select 
                  className="select-sim" 
                  value={selectedEmployee} 
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Pegawai --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nama} - {emp.jabatan}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <button type="submit" className="btn-sim primary w-100" disabled={loading}>
                  {loading ? 'Memproses...' : 'Tampilkan'}
                </button>
              </div>
            </form>

            {errorMsg && (
              <div className="alert-sim error mt-3">
                {errorMsg}
              </div>
            )}
          </div>
        </div>

        {perjakinData && (
          <div className="card-sim mt-4 slide-up">
            <div className="card-header-sim" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <h5 className="mb-0">Pratinjau Dokumen</h5>
                {perjakinData.status === 'Draft' && <span className="badge badge-draft">Draft</span>}
                {perjakinData.status === 'Menunggu Verifikasi Unit' && <span className="badge badge-warning">Menunggu Verifikasi Unit</span>}
                {perjakinData.status === 'Menunggu Verifikasi Perencana' && <span className="badge badge-warning">Menunggu Verifikasi Perencana</span>}
                {perjakinData.status === 'Menunggu Persetujuan Atasan' && <span className="badge badge-info">Menunggu ACC Atasan</span>}
                {perjakinData.status === 'Disetujui' && <span className="badge badge-success">Disetujui</span>}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {perjakinData.status === 'Menunggu Verifikasi Unit' && (
                  <button className="btn-sim primary" onClick={() => handleVerifikasi('Menunggu Verifikasi Perencana')} disabled={loading}>
                    <i className="fa-solid fa-check mr-2"></i> Verifikasi Unit
                  </button>
                )}
                {perjakinData.status === 'Menunggu Verifikasi Perencana' && (
                  <button className="btn-sim primary" onClick={() => handleVerifikasi('Menunggu Persetujuan Atasan')} disabled={loading}>
                    <i className="fa-solid fa-check-double mr-2"></i> Verifikasi Perencana
                  </button>
                )}
                <button className="btn-sim success" onClick={handlePrint} disabled={loading}>
                  <i className="fi fi-rr-print" style={{ marginRight: '8px' }}></i>
                  Cetak PDF / Print
                </button>
              </div>
            </div>
            <div className="card-body-sim" style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
              <div style={{ textAlign: 'center', marginBottom: '10px', fontStyle: 'italic', color: '#666' }}>
                <i className="fi fi-rr-info" style={{ marginRight: '5px' }}></i>
                Dokumen di bawah ini adalah pratinjau kasar. Gunakan tombol Cetak PDF untuk melihat layout sempurna seukuran kertas A4.
              </div>
              <div style={{ background: '#fff', border: '1px solid #ddd', padding: '20px', margin: '0 auto', maxWidth: '800px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                {/* Mini Preview rendering */}
                <h4 style={{ textAlign: 'center', fontWeight: 'bold' }}>PERJANJIAN KINERJA TAHUN {perjakinData.tahun}</h4>
                <p><strong>PIHAK PERTAMA:</strong> {perjakinData.pihakPertama.nama} ({perjakinData.pihakPertama.jabatan})</p>
                <p><strong>PIHAK KEDUA:</strong> {perjakinData.pihakKedua.nama} ({perjakinData.pihakKedua.jabatan})</p>
                <hr />
                <p><strong>Jumlah Target Kinerja (IKU):</strong> {perjakinData.items.length} Indikator</p>
                <p>Silakan klik <strong>Cetak PDF</strong> untuk mengekspor dokumen lengkap berserta tabel lampiran dan format kolom tanda tangan.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* The Printable Layout Component (Only visible when printing) */}
      <div className="print-only">
        <PrintLayout data={perjakinData} ref={printRef} />
      </div>
    </div>
  );
}
