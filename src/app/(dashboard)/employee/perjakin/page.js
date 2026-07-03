'use client';

import React, { useState, useEffect } from 'react';
import { useSimulationInternal } from '@/context/SimulationInternalContext';
import { useUI } from '@/context/UIContext';

export default function EmployeePerjakinPage() {
  const { currentUser } = useSimulationInternal();
  const { activeRole, activeYear } = useUI();
  const activeEmployeeId = currentUser?.id;
  const [perjakinData, setPerjakinData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  useEffect(() => {
    if (activeEmployeeId) {
      fetchPerjakin();
    } else {
      setLoading(false);
    }
  }, [activeEmployeeId, activeYear]);

  const fetchPerjakin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/perjakin?employeeId=${activeEmployeeId}&tahun=${activeYear}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data Perjakin');
      
      setPerjakinData(data.data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Draft': return <span className="badge badge-draft" style={{ fontSize: '14px', padding: '6px 12px' }}><i className="fa-solid fa-file-pen mr-2"></i>Draft (Belum Diajukan)</span>;
      case 'Target_Diajukan': return <span className="badge badge-warning" style={{ fontSize: '14px', padding: '6px 12px' }}><i className="fa-solid fa-clock mr-2"></i>Menunggu Verifikasi</span>;
      case 'Target_ACC_Admin': return <span className="badge badge-info" style={{ fontSize: '14px', padding: '6px 12px', background: '#3b82f6', color: 'white' }}><i className="fa-solid fa-user-tie mr-2"></i>Menunggu ACC Atasan</span>;
      case 'Target_Disetujui': return <span className="badge badge-success" style={{ fontSize: '14px', padding: '6px 12px' }}><i className="fa-solid fa-circle-check mr-2"></i>Disetujui (Dokumen Sah)</span>;
      case 'Target_Ditolak': return <span className="badge badge-danger" style={{ fontSize: '14px', padding: '6px 12px' }}><i className="fa-solid fa-circle-xmark mr-2"></i>Ditolak / Revisi</span>;
      default: return <span className="badge badge-draft">{status}</span>;
    }
  };

  return (
    <div className="container-fluid py-4 fade-in">
      {errorMsg && <div className="alert-sim error mb-4">{errorMsg}</div>}

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
                
                <p className="text-muted mt-3" style={{ fontSize: '12px' }}>
                  <i className="fa-solid fa-info-circle"></i> Status dan persetujuan dokumen Perjakin terintegrasi dengan pengisian Rencana Aksi (Target Bulanan). Silakan ke menu Target Renaksi untuk mengajukan dokumen.
                </p>

                {perjakinData.items.length === 0 && (
                  <p className="text-danger mt-3" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                    Anda belum memiliki Indikator Kinerja yang ditugaskan untuk tahun ini.
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
                              {item.isSplit && (
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px', fontStyle: 'italic' }}>
                                  dari total {item.targetPenuh} {item.satuan}
                                </div>
                              )}
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
