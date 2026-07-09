'use client';

import React, { useState, useEffect } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function AdminRekapRealisasiPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());
  const [selectedBulan, setSelectedBulan] = useState(''); // '' means All Months

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `/api/admin/rekap-realisasi?tahun=${selectedTahun}`;
      if (selectedBulan) {
        url += `&bulan=${selectedBulan}`;
      }

      const res = await fetchWithAuth(url);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal memuat rekap realisasi.');
      }
      const data = await res.json();
      setRecords(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [selectedTahun, selectedBulan]);

  const handleExportExcel = () => {
    const wsData = records.map((r, i) => ({
      No: i + 1,
      'Bulan': BULAN_NAMES[r.bulan - 1] || r.bulan,
      'Nama Pegawai': r.employeeName,
      'Jabatan': r.jabatan,
      'Bidang': r.bidang,
      'Indikator': r.indicatorName,
      'Target Tahunan': `${r.targetTahunan} ${r.indicatorSatuan}`,
      'Target Bulanan': `${r.targetBulanan} ${r.indicatorSatuan}`,
      'Capaian': `${r.capaianBulanan} ${r.indicatorSatuan}`,
      'Kendala': r.kendala,
      'Status': r.status,
      'Bukti Dukung': r.buktiDukung && r.buktiDukung.length > 0 ? r.buktiDukung.join(', ') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Realisasi');
    
    let filename = `Rekap_Realisasi_${selectedTahun}`;
    if (selectedBulan) {
      filename += `_${BULAN_NAMES[selectedBulan - 1]}`;
    }
    filename += '.xlsx';

    XLSX.writeFile(wb, filename);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'pt', 'a4'); // Landscape A4
    
    let title = `Laporan Rekap Realisasi Kinerja - Tahun ${selectedTahun}`;
    if (selectedBulan) {
      title += ` Bulan ${BULAN_NAMES[selectedBulan - 1]}`;
    }

    doc.setFontSize(14);
    doc.text(title, 40, 40);

    const tableColumn = ["No", "Bulan", "Pegawai / Jabatan", "Indikator", "Target Tahunan", "Capaian Bulanan", "Kendala", "Status Bukti"];
    const tableRows = [];

    records.forEach((r, idx) => {
      const pegawaiData = `${r.employeeName}\n${r.jabatan}`;
      const buktiDukungText = r.buktiDukung && r.buktiDukung.length > 0 ? `${r.buktiDukung.length} Tautan` : 'Tidak Ada';

      const recordData = [
        idx + 1,
        BULAN_NAMES[r.bulan - 1] || r.bulan,
        pegawaiData,
        r.indicatorName,
        `${r.targetTahunan} ${r.indicatorSatuan}`,
        `${r.capaianBulanan} ${r.indicatorSatuan}`,
        r.kendala || '-',
        buktiDukungText
      ];
      tableRows.push(recordData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 60,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 30 },
        2: { cellWidth: 120 },
        3: { cellWidth: 150 },
        6: { cellWidth: 100 }
      }
    });

    let filename = `Rekap_Realisasi_${selectedTahun}`;
    if (selectedBulan) filename += `_${BULAN_NAMES[selectedBulan - 1]}`;
    filename += '.pdf';

    doc.save(filename);
  };

  return (
    <div className="container" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
          <i className="fa-solid fa-chart-line"></i> Rekap Capaian Indikator
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleExportExcel} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#10B981', borderColor: '#10B981' }}
            disabled={loading || records.length === 0}
          >
            <i className="fa-solid fa-file-excel"></i> Export Excel
          </button>
          <button 
            onClick={handleExportPDF} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#EF4444', borderColor: '#EF4444' }}
            disabled={loading || records.length === 0}
          >
            <i className="fa-solid fa-file-pdf"></i> Export PDF
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Pilih Tahun
            </label>
            <select
              className="form-control"
              value={selectedTahun}
              onChange={(e) => setSelectedTahun(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Pilih Bulan (Opsional)
            </label>
            <select
              className="form-control"
              value={selectedBulan}
              onChange={(e) => setSelectedBulan(e.target.value)}
            >
              <option value="">Semua Bulan (Tahun Penuh)</option>
              {BULAN_NAMES.map((b, i) => (
                <option key={i + 1} value={i + 1}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '12px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          {error}
        </div>
      )}

      <div className="panel" style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '16px' }}></i>
            <p>Memuat data rekap realisasi...</p>
          </div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-folder-open" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}></i>
            <p>Tidak ada data realisasi yang ditemukan untuk periode ini.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Periode</th>
                  <th>Pengampu & Bidang</th>
                  <th>Indikator Tahunan (Renja)</th>
                  <th>Target Tahunan</th>
                  <th>Capaian Bulanan</th>
                  <th>Tautan Bukti Dukung</th>
                </tr>
              </thead>
              <tbody>
                {records.map((item, index) => (
                  <tr key={item._id || index}>
                    <td>{index + 1}</td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)', width: 'auto', fontSize: '11px' }}>
                        Bulan {item.bulan}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.employeeName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.jabatan}</div>
                      <div style={{ fontSize: '11px', color: 'var(--primary-blue)', marginTop: '4px' }}>{item.bidang}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{item.indicatorName}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                        {item.targetTahunan} {item.indicatorSatuan}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--primary-orange)' }}>
                        {item.capaianBulanan} {item.indicatorSatuan}
                      </div>
                      <span className="badge" style={{ marginTop: '6px', fontSize: '10px', background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', width: 'auto' }}>
                        <i className="fa-solid fa-check-circle"></i> {item.status}
                      </span>
                    </td>
                    <td>
                      {item.buktiDukung && item.buktiDukung.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {item.buktiDukung.map((url, uidx) => (
                            <a 
                              key={uidx}
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="btn btn-sm"
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                padding: '4px 8px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--primary-blue)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                fontSize: '11px'
                              }}
                            >
                              <i className="fa-solid fa-external-link-alt"></i> Tautan {uidx + 1}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tidak Ada</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
