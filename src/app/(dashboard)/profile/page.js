'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useSimulationInternal } from '@/context/SimulationInternalContext';

export default function ProfilePage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { currentUser, simulate } = useSimulationInternal();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [hasDigitalSignature, setHasDigitalSignature] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState('');
  const [signatureMode, setSignatureMode] = useState('upload'); // 'upload' or 'draw'
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await fetchWithAuth('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setHasDigitalSignature(data.hasDigitalSignature || false);
        setSignatureUrl(data.signatureUrl || '');
      }
    } catch (e) {
      console.error('Failed to fetch profile', e);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchProfile(); }, [currentUser]);

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    let finalSignatureUrl = signatureUrl;

    if (!hasDigitalSignature && signatureMode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      // Check if canvas is empty
      const blank = document.createElement('canvas');
      blank.width = canvas.width;
      blank.height = canvas.height;
      if (canvas.toDataURL() !== blank.toDataURL()) {
        finalSignatureUrl = canvas.toDataURL('image/png');
        setSignatureUrl(finalSignatureUrl);
      }
    }

    try {
      const res = await fetchWithAuth('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hasDigitalSignature,
          signatureUrl: hasDigitalSignature ? null : finalSignatureUrl
        })
      });

      if (res.ok) {
        const result = await res.json();
        setMessage({ type: 'success', text: 'Profil dan pengaturan tanda tangan berhasil diperbarui.' });
        // Update simulation context to reflect changes
        simulate({ ...currentUser, signatureUrl: finalSignatureUrl, hasDigitalSignature });
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Gagal menyimpan profil.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Kesalahan jaringan.' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024 * 2) {
        setMessage({ type: 'error', text: 'Ukuran file maksimal 2MB.' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Canvas drawing handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const endDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureUrl('');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-primary)' }}>
        <i className="fa-solid fa-circle-notch fa-spin text-orange" style={{ fontSize: '24px', marginBottom: '10px' }}></i>
        <p>Memuat profil...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa-solid fa-triangle-exclamation text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Profil Tidak Ditemukan</h2>
      </div>
    );
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="glass-panel">
        <div className="panel-header justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-user-circle text-orange"></i> Profil Pengguna
          </h3>
        </div>
        
        <div className="panel-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {message.text && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: message.type === 'success' ? '#10B981' : '#EF4444',
              border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              {message.text}
            </div>
          )}

          {/* User Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Nama Pegawai</label>
              <input type="text" className="form-control" value={profile.nama} disabled style={{ background: 'rgba(0,0,0,0.2)' }} />
            </div>
            <div className="form-group">
              <label>NIP</label>
              <input type="text" className="form-control" value={profile.nip} disabled style={{ background: 'rgba(0,0,0,0.2)' }} />
            </div>
            <div className="form-group">
              <label>Jabatan</label>
              <input type="text" className="form-control" value={profile.jabatan} disabled style={{ background: 'rgba(0,0,0,0.2)' }} />
            </div>
            <div className="form-group">
              <label>Unit Kerja (Bidang)</label>
              <input type="text" className="form-control" value={profile.bidangs.join(', ') || 'Semua Unit'} disabled style={{ background: 'rgba(0,0,0,0.2)' }} />
            </div>
          </div>

          <hr style={{ borderColor: 'var(--glass-border)', margin: '10px 0' }} />

          {/* Signature Settings */}
          <div>
            <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-signature text-orange"></i> Pengaturan Tanda Tangan
            </h4>
            <p className="text-muted" style={{ fontSize: '13px', marginBottom: '20px' }}>
              Tanda tangan ini akan digunakan untuk cetak Laporan Realisasi, Capaian IKU, dan Evaluasi Kinerja (SAKIP).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={hasDigitalSignature}
                  onChange={(e) => setHasDigitalSignature(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary-orange)' }}
                />
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>Gunakan Tanda Tangan Elektronik (BSrE)</span>
              </label>
              
              {hasDigitalSignature && (
                <div style={{ fontSize: '12px', color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <i className="fa-solid fa-certificate" style={{ marginRight: '8px' }}></i>
                  Dengan memilih opsi ini, dokumen cetak akan diberi keterangan &quot;Ditandatangani secara elektronik&quot; dan tidak memerlukan gambar tanda tangan manual.
                </div>
              )}

              {!hasDigitalSignature && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                    <button
                      className={`btn btn-sm ${signatureMode === 'upload' ? 'btn-orange' : 'btn-secondary'}`}
                      onClick={() => setSignatureMode('upload')}
                      style={{ width: 'auto' }}
                    >
                      <i className="fa-solid fa-upload mr-2"></i> Unggah Gambar
                    </button>
                    <button
                      className={`btn btn-sm ${signatureMode === 'draw' ? 'btn-orange' : 'btn-secondary'}`}
                      onClick={() => setSignatureMode('draw')}
                      style={{ width: 'auto' }}
                    >
                      <i className="fa-solid fa-pen mr-2"></i> Gambar Langsung
                    </button>
                  </div>

                  {signatureMode === 'upload' ? (
                    <div>
                      {signatureUrl ? (
                        <div style={{ marginBottom: '16px' }}>
                          <span className="text-muted" style={{ display: 'block', fontSize: '12px', marginBottom: '8px' }}>Tanda Tangan Saat Ini:</span>
                          <div style={{ background: 'white', padding: '10px', borderRadius: '8px', display: 'inline-block', border: '2px dashed var(--glass-border)' }}>
                            <img src={signatureUrl} alt="Signature" style={{ maxHeight: '100px', maxWidth: '300px', objectFit: 'contain' }} />
                          </div>
                          <div style={{ marginTop: '10px' }}>
                            <button className="btn btn-sm btn-danger" style={{ width: 'auto' }} onClick={() => setSignatureUrl('')}>
                              <i className="fa-solid fa-trash mr-1"></i> Hapus
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '20px', border: '2px dashed var(--glass-border)', borderRadius: '8px', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
                          <i className="fa-solid fa-cloud-arrow-up text-muted" style={{ fontSize: '32px', marginBottom: '10px' }}></i>
                          <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>Format: PNG transparan disarankan. Maks: 2MB.</p>
                          <input
                            type="file"
                            accept="image/png, image/jpeg"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                          />
                          <button className="btn btn-sm btn-secondary" style={{ width: 'auto' }} onClick={() => fileInputRef.current?.click()}>
                            Pilih File Gambar
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className="text-muted" style={{ display: 'block', fontSize: '12px', marginBottom: '8px' }}>Goreskan tanda tangan di bawah ini:</span>
                      <div style={{ background: 'white', borderRadius: '8px', border: '2px dashed var(--glass-border)', width: 'fit-content' }}>
                        <canvas
                          ref={canvasRef}
                          width={400}
                          height={200}
                          style={{ cursor: 'crosshair', display: 'block' }}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={endDrawing}
                          onMouseOut={endDrawing}
                        />
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                        <button className="btn btn-sm btn-secondary" style={{ width: 'auto' }} onClick={clearCanvas}>
                          <i className="fa-solid fa-eraser mr-1"></i> Bersihkan Canvas
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-orange"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>}
            Simpan Perubahan
          </button>
        </div>
      </div>
    </section>
  );
}
