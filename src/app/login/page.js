'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function LoginPage() {
  const [nip, setNip] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useSimulation();

  useEffect(() => {
    const savedNip = localStorage.getItem('remembered_nip');
    const savedRemember = localStorage.getItem('remember_me') === 'true';
    if (savedRemember && savedNip) {
      setNip(savedNip);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (rememberMe) {
      localStorage.setItem('remembered_nip', nip);
      localStorage.setItem('remember_me', 'true');
    } else {
      localStorage.removeItem('remembered_nip');
      localStorage.removeItem('remember_me');
    }

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

          <div className="form-group" style={{ textAlign: 'left', marginBottom: '20px' }}>
            <label htmlFor="password"><i className="fa-solid fa-lock" style={{ marginRight: '8px', color: 'var(--primary-orange)' }}></i> Password</label>
            <div style={{ position: 'relative', marginTop: '6px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                required
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px'
                }}
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: '25px', gap: '8px' }}>
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary-orange)' }}
            />
            <label htmlFor="rememberMe" style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
              Ingat Saya
            </label>
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
