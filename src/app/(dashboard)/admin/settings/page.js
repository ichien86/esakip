'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function AdminSettingsPage() {
  const { fetchWithAuth, activeRole, systemSettings, refreshMetadata } = useSimulation();
  const [renstraLocked, setRenstraLocked] = useState(false);
  const [renjaLocked, setRenjaLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const hasAccess = activeRole === 'admin';

  useEffect(() => {
    if (systemSettings) {
      const timer = setTimeout(() => {
        setRenstraLocked(!!systemSettings.renstra_locked);
        setRenjaLocked(!!systemSettings.renja_locked);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [systemSettings]);

  const handleToggleLock = async (type) => {
    setError('');
    setSuccess('');
    setIsSaving(true);

    const isRenstra = type === 'renstra';
    const key = isRenstra ? 'renstra_locked' : 'renja_locked';
    const currentValue = isRenstra ? renstraLocked : renjaLocked;
    const newValue = !currentValue;

    try {
      const res = await fetchWithAuth('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({
          key,
          value: newValue,
          requesterRole: activeRole
        })
      });

      if (res.ok) {
        if (isRenstra) setRenstraLocked(newValue);
        else setRenjaLocked(newValue);
        setSuccess(`Kunci ${isRenstra ? 'Renstra' : 'Renja & PK'} berhasil ${newValue ? 'diaktifkan' : 'dinonaktifkan'}.`);
        await refreshMetadata();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal memperbarui pengaturan.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa-solid fa-ban text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Akses Ditolak</h2>
        <p className="text-muted" style={{ marginTop: '8px' }}>Hanya Administrator Sistem yang diperbolehkan mengelola pengaturan sistem.</p>
      </div>
    );
  }

  return (
    <section>
      <div className="glass-panel" style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
        <div className="panel-header">
          <h3>
            <i className="fa-solid fa-gears text-orange"></i>
            Pengaturan Sistem & Kunci Data
          </h3>
        </div>
        
        <div className="panel-body">
          {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
          {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Renstra Lock Option */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--glass-border)',
              padding: '20px',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '80%' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <i className={`fa-solid ${renstraLocked ? 'fa-lock text-orange' : 'fa-lock-open text-muted'}`}></i>
                  Kunci Renstra (5 Tahunan & Definisi Operasional)
                </h4>
                <p className="text-muted" style={{ fontSize: '12px', margin: 0 }}>
                  Jika diaktifkan, Admin Perencana diblokir dari memodifikasi struktur pohon Cascading 5 Tahunan, Indikator Renstra, dan Definisi Operasionalnya.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => handleToggleLock('renstra')}
                  disabled={isSaving}
                  className={`btn ${renstraLocked ? 'btn-danger' : 'btn-orange'}`}
                  style={{
                    width: '140px',
                    fontWeight: 600
                  }}
                >
                  {isSaving ? (
                    <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Proses...</>
                  ) : renstraLocked ? (
                    <><i className="fa-solid fa-lock-open mr-2"></i> Buka Kunci</>
                  ) : (
                    <><i className="fa-solid fa-lock mr-2"></i> Kunci Renstra</>
                  )}
                </button>
              </div>
            </div>

            {/* Renja Lock Option */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--glass-border)',
              padding: '20px',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '80%' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <i className={`fa-solid ${renjaLocked ? 'fa-lock text-orange' : 'fa-lock-open text-muted'}`}></i>
                  Kunci Renja, PK & Renaksi
                </h4>
                <p className="text-muted" style={{ fontSize: '12px', margin: 0 }}>
                  Jika diaktifkan, Admin Perencana diblokir dari modifikasi Cascading Tahunan (Renja). 
                  Selain itu, Pegawai <strong>tidak dapat memilih indikator IKU</strong> maupun <strong>menyusun matriks target Renaksi</strong>.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => handleToggleLock('renja')}
                  disabled={isSaving}
                  className={`btn ${renjaLocked ? 'btn-danger' : 'btn-orange'}`}
                  style={{
                    width: '140px',
                    fontWeight: 600
                  }}
                >
                  {isSaving ? (
                    <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Proses...</>
                  ) : renjaLocked ? (
                    <><i className="fa-solid fa-lock-open mr-2"></i> Buka Kunci</>
                  ) : (
                    <><i className="fa-solid fa-lock mr-2"></i> Kunci Renja</>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Link to Realisation Lock Option */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--glass-border)',
              padding: '20px',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '80%' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <i className="fa-solid fa-calendar-check text-muted"></i>
                  Kunci Realisasi Bulanan (Jadwal Pengisian)
                </h4>
                <p className="text-muted" style={{ fontSize: '12px', margin: 0 }}>
                  Kelola jadwal pengisian realisasi bulanan dan deadline bagi pegawai. 
                  Anda dapat mengunci pengisian realisasi per bulan secara spesifik.
                </p>
              </div>
              <div>
                <a
                  href="/admin/realisasi-schedule"
                  className="btn btn-secondary"
                  style={{
                    width: '140px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  <i className="fa-solid fa-calendar-days mr-2"></i> Kelola Jadwal
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
