'use client';

import React, { useState } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function LoginPage() {
  const [nip, setNip] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useSimulation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await login(nip, password);
      if (!result.success) {
        setError(result.error);
      }
    } catch (err) {
      setError('Terjadi kesalahan sistem. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      position: 'relative'
    }}>
      <div className="background-glow"></div>
      
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px 30px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '30px' }}>
          <div className="logo-wrapper" style={{ margin: '0 auto 16px auto', width: '60px', height: '60px', borderRadius: '14px' }}>
            <i className="fa-solid fa-triangle-exclamation orange-glow" style={{ fontSize: '28px' }}></i>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '0.5px' }}>E-AKIP</h2>
          <p className="text-muted" style={{ marginTop: '4px' }}>BPBD KABUPATEN BOYOLALI</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#EF4444',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            textAlign: 'left'
          }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ textAlign: 'left', marginBottom: '20px' }}>
            <label htmlFor="nip"><i className="fa-solid fa-user-tie" style={{ marginRight: '8px', color: 'var(--primary-orange)' }}></i> NIP / Username Admin</label>
            <input
              type="text"
              id="nip"
              className="form-control"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="Masukkan NIP atau username"
              required
              style={{ marginTop: '6px' }}
            />
          </div>

          <div className="form-group" style={{ textAlign: 'left', marginBottom: '30px' }}>
            <label htmlFor="password"><i className="fa-solid fa-lock" style={{ marginRight: '8px', color: 'var(--primary-orange)' }}></i> Password</label>
            <input
              type="password"
              id="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              required
              style={{ marginTop: '6px' }}
            />
          </div>

          <button type="submit" className="btn btn-orange w-full" disabled={submitting}>
            {submitting ? (
              <span><i className="fa-solid fa-circle-notch fa-spin"></i> Memproses...</span>
            ) : (
              <span><i className="fa-solid fa-right-to-bracket"></i> Masuk Aplikasi</span>
            )}
          </button>
        </form>


      </div>
    </div>
  );
}
