'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function LaporanAkipPage() {
  const { allEmployees } = useSimulation();

  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [employee, setEmployee] = useState(null);
  const [supervisor, setSupervisor] = useState(null);
  
  const [annualNodes, setAnnualNodes] = useState([]);
  const [selectedIndicators, setSelectedIndicators] = useState([]);
  const [renaksiRecords, setRenaksiRecords] = useState([]);
  const [performanceSheet, setPerformanceSheet] = useState(null);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (allEmployees.length > 0) {
      // Default to first employee (non-admin)
      const nonAdmin = allEmployees.filter(e => e.id !== 'admin' && e.isActive !== false);
      if (nonAdmin.length > 0) {
        const timer = setTimeout(() => {
          setSelectedEmpId(nonAdmin[0].id);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [allEmployees]);

  const loadReportData = useCallback(async (empId) => {
    if (!empId) return;
    setLoading(true);
    const emp = allEmployees.find(e => e.id === empId);
    setEmployee(emp);

    try {
      // 1. Find supervisor
      if (emp?.parentId) {
        const boss = allEmployees.find(e => e.id === emp.parentId);
        setSupervisor(boss);
      } else {
        setSupervisor(null);
      }

      // 2. Fetch selection
      const selRes = await fetch(`/api/selections/${empId}`);
      let selectedIds = [];
      if (selRes.ok) {
        const selData = await selRes.json();
        selectedIds = selData.selectedIndicators || [];
      }

      // 3. Fetch Renja indicators
      const nodesRes = await fetch('/api/renja/2026');
      let matchedNodes = [];
      if (nodesRes.ok) {
        const allNodes = await nodesRes.json();
        setAnnualNodes(allNodes);
        matchedNodes = allNodes.filter(n => selectedIds.includes(n.id));
        setSelectedIndicators(matchedNodes);
      }

      // 4. Fetch Renaksis
      const rxRes = await fetch(`/api/renaksi/${empId}/2026`);
      if (rxRes.ok) {
        setRenaksiRecords(await rxRes.json());
      }

      // 5. Fetch Performance sheet
      const perfRes = await fetch(`/api/performance/${empId}/2026`);
      if (perfRes.ok) {
        setPerformanceSheet(await perfRes.json());
      }
    } catch (e) {
      console.error('Failed to load print report data sources', e);
    } finally {
      setLoading(false);
    }
  }, [allEmployees]);

  useEffect(() => {
    if (selectedEmpId) {
      const timer = setTimeout(() => {
        loadReportData(selectedEmpId);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedEmpId, loadReportData]);

  // Calculate indicator achievement percentage
  const calculateCapaian = (nodeId) => {
    const node = annualNodes.find(n => n.id === nodeId);
    const records = renaksiRecords.filter(r => r.indicatorId === nodeId && r.realisasiBulanan !== null);
    
    if (records.length === 0) return 0;

    let targetTotal = 0;
    let realisasiTotal = 0;

    if (node?.tipeTarget === 'Akumulatif') {
      targetTotal = records.reduce((sum, r) => sum + r.targetBulanan, 0);
      realisasiTotal = records.reduce((sum, r) => sum + r.realisasiBulanan, 0);
    } else {
      // Kondisi Akhir: take the latest month's records
      const sorted = [...records].sort((a, b) => b.bulan - a.bulan);
      if (sorted.length > 0) {
        targetTotal = sorted[0].targetBulanan;
        realisasiTotal = sorted[0].realisasiBulanan;
      }
    }

    if (targetTotal === 0) return realisasiTotal > 0 ? 100 : 100;

    let percent = 0;
    if (node?.tipeTarget === 'Kondisi Akhir Menurun') {
      if (realisasiTotal <= targetTotal && realisasiTotal > 0) percent = 100;
      else if (realisasiTotal > targetTotal) percent = (targetTotal / realisasiTotal) * 100;
    } else {
      percent = (realisasiTotal / targetTotal) * 100;
    }

    return Math.round(Math.min(150, percent) * 100) / 100;
  };

  const getRealisasiSummaryText = (nodeId) => {
    const node = annualNodes.find(n => n.id === nodeId);
    const records = renaksiRecords.filter(r => r.indicatorId === nodeId && r.realisasiBulanan !== null);
    if (records.length === 0) return '-';

    if (node?.tipeTarget === 'Akumulatif') {
      const sum = records.reduce((sum, r) => sum + r.realisasiBulanan, 0);
      return `${sum} ${node.satuan} (Akumulasi)`;
    } else {
      const sorted = [...records].sort((a, b) => b.bulan - a.bulan);
      return sorted.length > 0 ? `${sorted[0].realisasiBulanan} ${node.satuan} (Kondisi B${sorted[0].bulan})` : '-';
    }
  };

  const getTargetSummaryText = (nodeId) => {
    const node = annualNodes.find(n => n.id === nodeId);
    const records = renaksiRecords.filter(r => r.indicatorId === nodeId);
    if (records.length === 0) return node ? `${node.target} ${node.satuan}` : '-';

    if (node?.tipeTarget === 'Akumulatif') {
      const sum = records.reduce((sum, r) => sum + r.targetBulanan, 0);
      return `${sum} ${node.satuan} (Akumulasi)`;
    } else {
      return node ? `${node.target} ${node.satuan}` : '-';
    }
  };

  const participants = allEmployees.filter(emp => emp.id !== 'admin' && emp.isActive !== false);

  return (
    <section>
      {/* Selector and Print button */}
      <div className="glass-panel print-exclude">
        <div className="panel-header justify-between">
          <div>
            <h3><i className="fa-solid fa-file-invoice text-orange"></i> Cetak Laporan AKIP Individu</h3>
            <p className="text-muted">Pilih pegawai untuk memformat dan mencetak lembar hasil evaluasi akuntabilitas kinerja individu resmi.</p>
          </div>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flexGrow: 1 }}>
            <label>Pilih Pegawai:</label>
            <select className="select-sim mt-1" value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)}>
              {participants.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nama} ({emp.jabatan})</option>
              ))}
            </select>
          </div>
          <button className="btn btn-orange" onClick={() => window.print()}>
            <i className="fa-solid fa-print"></i> Cetak Lembar Evaluasi
          </button>
        </div>
      </div>

      {/* Official Print Layout Sheet */}
      {employee && (
        <div className="glass-panel" style={{ marginTop: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}><i className="fa-solid fa-circle-notch fa-spin"></i> Memuat data laporan...</div>
          ) : (
            <div className="print-only-layout" id="printTemplate" style={{ display: 'block', padding: '30px', background: 'white', color: 'black' }}>
              <div className="kop-surat" style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase' }}>Pemerintah Kabupaten Boyolali</h3>
                <h2 style={{ margin: '4px 0', fontSize: '18px', textTransform: 'uppercase' }}>Badan Penanggulangan Bencana Daerah (BPBD)</h2>
                <p style={{ margin: 0, fontSize: '10px' }}>Kompleks Perkantoran Terpadu Kabupaten Boyolali, Jawa Tengah</p>
              </div>

              <h3 style={{ textAlign: 'center', textDecoration: 'underline', fontSize: '14px', margin: '0 0 4px 0' }}>LEMBAR HASIL EVALUASI AKUNTABILITAS KINERJA INDIVIDU (AKIP-I)</h3>
              <p style={{ textAlign: 'center', fontSize: '12px', margin: '0 0 20px 0' }}>TAHUN ANGGARAN 2026</p>

              <table style={{ width: '100%', fontSize: '12px', marginBottom: '24px', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td width="180px" style={{ padding: '4px 0' }}><strong>Nama Pegawai</strong></td>
                    <td width="15px" style={{ padding: '4px 0' }}>:</td>
                    <td style={{ padding: '4px 0' }}>{employee.nama}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 0' }}><strong>NIP</strong></td>
                    <td style={{ padding: '4px 0' }}>:</td>
                    <td style={{ padding: '4px 0' }}>{employee.nip}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 0' }}><strong>Jabatan</strong></td>
                    <td style={{ padding: '4px 0' }}>:</td>
                    <td style={{ padding: '4px 0' }}>{employee.jabatan}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 0' }}><strong>Atasan Evaluator</strong></td>
                    <td style={{ padding: '4px 0' }}>:</td>
                    <td style={{ padding: '4px 0' }}>{supervisor ? supervisor.nama : '-'}</td>
                  </tr>
                </tbody>
              </table>

              <h4 style={{ fontSize: '12px', margin: '0 0 6px 0' }}>A. Capaian Indikator Kinerja Utama</h4>
              <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                <thead>
                  <tr style={{ background: '#f2f2f2' }}>
                    <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px', width: '40px' }}>No</th>
                    <th style={{ border: '1px solid black', padding: '6px', textAlign: 'left', fontSize: '11px' }}>Indikator Kinerja Utama (IKU)</th>
                    <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px', width: '120px' }}>Target</th>
                    <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px', width: '120px' }}>Realisasi</th>
                    <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px', width: '100px' }}>Capaian (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedIndicators.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontSize: '11px', color: '#555' }}>
                        Tidak ada indikator kinerja yang diampu pegawai.
                      </td>
                    </tr>
                  ) : (
                    selectedIndicators.map((node, index) => (
                      <tr key={node.id}>
                        <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px' }}>{index + 1}</td>
                        <td style={{ border: '1px solid black', padding: '6px', fontSize: '11px' }}>{node.indikator} ({node.satuan})</td>
                        <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px' }}>
                          {getTargetSummaryText(node.id)}
                        </td>
                        <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                          {getRealisasiSummaryText(node.id)}
                        </td>
                        <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                          {calculateCapaian(node.id)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <h4 style={{ fontSize: '12px', margin: '0 0 6px 0' }}>B. Hasil Evaluasi Akuntabilitas Kinerja</h4>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                <div style={{ border: '1px solid black', padding: '12px', textAlign: 'center', flex: 1 }}>
                  <span style={{ fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#555' }}>NILAI EVALUASI AKIP-I</span>
                  <h2 style={{ fontSize: '26px', margin: 0, fontWeight: 'bold' }}>
                    {performanceSheet?.evaluasiAtasan?.skorAKIP !== null && performanceSheet?.evaluasiAtasan?.skorAKIP !== undefined ? (
                      performanceSheet.evaluasiAtasan.skorAKIP.toFixed(2)
                    ) : '-'}
                  </h2>
                </div>
                <div style={{ border: '1px solid black', padding: '12px', textAlign: 'center', flex: 1 }}>
                  <span style={{ fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#555' }}>PREDIKAT KINERJA</span>
                  <h2 style={{ fontSize: '26px', margin: 0, fontWeight: 'bold' }}>
                    {performanceSheet?.evaluasiAtasan?.predikat || '-'}
                  </h2>
                </div>
              </div>

              <h4 style={{ fontSize: '12px', margin: '0 0 6px 0' }}>C. Catatan & Rekomendasi Perbaikan</h4>
              <div style={{
                border: '1px solid black',
                padding: '12px',
                fontSize: '12px',
                minHeight: '100px',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                marginBottom: '40px'
              }}>
                {performanceSheet?.evaluasiAtasan?.catatan || '-'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px' }}>
                <div style={{ textAlign: 'center', width: '250px' }}>
                  <p>Boyolali, {performanceSheet?.evaluasiAtasan?.tanggalEvaluasi || '5 Desember 2026'}</p>
                  <p>Pejabat Penilai/Atasan Langsung,</p>
                  <br /><br /><br />
                  <p><strong><u>{supervisor ? supervisor.nama : '-'}</u></strong></p>
                  <p>NIP. {supervisor ? supervisor.nip : '-'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
