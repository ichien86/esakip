'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSimulation } from '@/context/SimulationContext';
import PrintLayout from './PrintLayout';

export default function AdminPerjakinPage() {
  const { activeRole } = useSimulation();
  
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());
  
  const [perjakinData, setPerjakinData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const printRef = useRef(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      if (res.ok) {
        // Filter out bupati just in case
        setEmployees(data.data.filter(e => !e.roles?.includes('bupati')));
      }
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  };

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
      const res = await fetch(`/api/perjakin?employeeId=${selectedEmployee}&tahun=${selectedTahun}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data Perjakin');
      
      setPerjakinData(data.data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
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
        @media print {
          .no-print { display: none !important; }
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
              <div className="col-md-3">
                <label className="form-label">Tahun</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={selectedTahun}
                  onChange={(e) => setSelectedTahun(e.target.value)}
                  required
                />
              </div>
              <div className="col-md-7">
                <label className="form-label">Pilih Pegawai (Pihak Pertama)</label>
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
              <div className="col-md-2">
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
              <h5 className="mb-0">Pratinjau Dokumen</h5>
              <button className="btn-sim success" onClick={handlePrint}>
                <i className="fi fi-rr-print" style={{ marginRight: '8px' }}></i>
                Cetak PDF / Print
              </button>
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
      <div style={{ display: 'none' }}>
        <PrintLayout data={perjakinData} ref={printRef} />
      </div>
    </div>
  );
}
