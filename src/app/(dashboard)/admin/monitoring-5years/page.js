'use client';

import React, { useEffect, useState } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function AdminMonitoring5YearsPage() {
  const { fetchWithAuth, activeRole } = useSimulation();
  const [monitoringData, setMonitoringData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMonitoring = async () => {
    try {
      const res = await fetchWithAuth('/api/monitoring/5years');
      if (res.ok) {
        setMonitoringData(await res.json());
      }
    } catch (e) {
      console.error('Failed to load 5 year monitoring', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitoring();
  }, []);

  const hasAccess = activeRole === 'admin' || activeRole === 'perencana';

  if (!hasAccess) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa-solid fa-ban text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Akses Ditolak</h2>
        <p className="text-muted" style={{ marginTop: '8px' }}>Hanya Administrator atau Admin Perencana yang diperbolehkan mengakses halaman monitoring 5 tahunan.</p>
      </div>
    );
  }

  const getProgressColor = (percent) => {
    if (percent >= 100) return 'var(--success)';
    if (percent >= 75) return '#60A5FA'; // Blue-ish
    if (percent >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3><i className="fa-solid fa-chart-bar text-orange"></i> Monitoring Kinerja 5 Tahunan BPBD (2025-2030)</h3>
        <p className="text-muted">Progres pencapaian dihitung berdasarkan akumulasi realisasi tahunan terhadap Target Akhir RPJMD.</p>
      </div>
      <div className="panel-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}><i className="fa-solid fa-circle-notch fa-spin"></i> Memuat progres monitoring...</div>
        ) : monitoringData.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Belum ada data sasaran 5 tahunan.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {monitoringData.map(item => {
              const progressColor = getProgressColor(item.progres);
              return (
                <div key={item.id} style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                }}>
                  {/* Title & Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                      <span className="badge badge-draft" style={{ textTransform: 'uppercase', marginBottom: '8px', fontSize: '9px' }}>
                        {item.level} - {item.bidangPengampu.join(', ')}
                      </span>
                      <h4 style={{ fontSize: '16px', fontWeight: 'bold' }}>{item.text}</h4>
                      <p className="text-muted" style={{ marginTop: '4px' }}>
                        Indikator: <strong>{item.indikator}</strong> | Tipe: <strong>{item.tipeTarget}</strong>
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="text-muted" style={{ fontSize: '12px' }}>Capaian Akumulasi</span>
                      <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: progressColor }}>
                        {item.totalRealisasi} / {item.targetAkhir} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-primary)' }}>{item.satuan}</span>
                      </h3>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span>Persentase Progres</span>
                      <span style={{ fontWeight: 'bold', color: progressColor }}>{item.progres}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${item.progres}%`,
                        height: '100%',
                        background: progressColor,
                        borderRadius: '5px',
                        boxShadow: `0 0 10px ${progressColor}80`,
                        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}></div>
                    </div>
                  </div>

                  {/* Yearly Table */}
                  <div className="table-responsive" style={{ marginTop: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                    <table className="table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          {['2025', '2026', '2027', '2028', '2029', '2030'].map(year => (
                            <th key={year} style={{ textAlign: 'center', padding: '8px' }}>Tahun {year}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {['2025', '2026', '2027', '2028', '2029', '2030'].map(year => {
                            const yearData = item.yearlyData[year] || { target: 0, realisasi: 0 };
                            return (
                              <td key={year} style={{ textAlign: 'center', padding: '8px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target: {yearData.target}</div>
                                <div style={{ fontWeight: 'bold', marginTop: '2px' }}>Real: {yearData.realisasi}</div>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
