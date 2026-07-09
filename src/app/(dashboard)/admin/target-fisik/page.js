'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useUI } from '@/context/UIContext';

const BULAN_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const BULAN_KEY   = ['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];

export default function TargetFisikPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { activeYear, activeBidang, activeRole } = useUI();
  const [pakets, setPakets] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  // Local edits: { [paketId]: { jan: 0, feb: 0, ... } }
  const [edits, setEdits] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/paket-pekerjaan?tahun=${activeYear}&bidang=${encodeURIComponent(activeBidang || '')}&role=${activeRole || ''}`);
      if (res.ok) {
        const data = await res.json();
        setPakets(data.pakets || []);
        setIsLocked(data.isLocked || false);
        // Init edits from DB
        const init = {};
        (data.pakets || []).forEach(p => {
          init[p.id] = { ...Object.fromEntries(BULAN_KEY.map(k => [k, 0])), ...(p.targetFisik || {}) };
        });
        setEdits(init);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, activeYear, activeBidang, activeRole]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  const handleChange = (paketId, bulanKey, rawVal) => {
    const val = rawVal === '' ? '' : Math.max(0, Math.min(100, parseFloat(rawVal) || 0));
    setEdits(prev => {
      const row = { ...prev[paketId] };
      row[bulanKey] = val;

      // Auto-fill: if value is 100, fill all subsequent months with 100
      if (val === 100) {
        const idx = BULAN_KEY.indexOf(bulanKey);
        for (let i = idx + 1; i < BULAN_KEY.length; i++) {
          row[BULAN_KEY[i]] = 100;
        }
      }
      return { ...prev, [paketId]: row };
    });
  };

  const validate = () => {
    for (const p of pakets) {
      const row = edits[p.id] || {};
      // Find the last month with a value > 0
      let lastVal = 0;
      for (const k of BULAN_KEY) {
        const v = parseFloat(row[k]) || 0;
        if (v > 0) lastVal = v;
      }
      if (lastVal > 0 && lastVal < 100) {
        // Check if any month has 100 (cumulative end)
        const has100 = BULAN_KEY.some(k => parseFloat(row[k]) === 100);
        if (!has100) {
          return `Paket "${p.namaPaket}": Target kumulatif akhir harus mencapai 100%. Pastikan minimal satu bulan bernilai 100.`;
        }
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setMsg(err); return; }
    setSaving(true);
    setMsg('');
    try {
      const items = pakets.map(p => ({
        id: p.id,
        targetFisik: Object.fromEntries(
          BULAN_KEY.map(k => [k, parseFloat(edits[p.id]?.[k]) || 0])
        )
      }));
      const res = await fetchWithAuth('/api/admin/paket-pekerjaan/target-fisik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      setMsg(res.ok ? data.message : (data.error || 'Gagal menyimpan'));
    } finally {
      setSaving(false);
    }
  };

  // Group by subkegiatan
  const grouped = pakets.reduce((acc, p) => {
    const key = p.subkegiatanId;
    if (!acc[key]) acc[key] = { namaSubkegiatan: p.namaSubkegiatan, items: [] };
    acc[key].items.push(p);
    return acc;
  }, {});

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="fa-solid fa-bullseye" style={{ color: 'var(--primary-orange)', marginRight: '10px' }} />
            Penyusunan Target Fisik
          </h1>
          <p className="text-muted">Admin Unit Kerja — Isi target capaian fisik bulanan per paket pekerjaan</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isLocked && (
            <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '12px', padding: '6px 14px' }}>
              <i className="fa-solid fa-lock" /> Target Dikunci oleh Admin Sistem
            </span>
          )}
          {!isLocked && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><i className="fa-solid fa-circle-notch fa-spin" /> Menyimpan...</> : <><i className="fa-solid fa-floppy-disk" /> Simpan Target</>}
            </button>
          )}
        </div>
      </div>

      {/* Petunjuk */}
      <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '10px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
          <i className="fa-solid fa-circle-info" style={{ color: '#6366f1', marginRight: '6px' }} />
          Isi target capaian fisik kumulatif (0–100%). Target di bulan terakhir <b>wajib mencapai 100%</b>.
          Ketik <b>100</b> di bulan manapun untuk mengisi otomatis bulan-bulan berikutnya dengan 100.
          {isLocked && ' Data saat ini dikunci dan tidak dapat diubah.'}
        </p>
      </div>

      {msg && (
        <div style={{ marginBottom: '14px', padding: '12px 16px', borderRadius: '8px', background: msg.includes('berhasil') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: msg.includes('berhasil') ? '#10b981' : 'var(--danger)', fontSize: '13px' }}>
          <i className={`fa-solid ${msg.includes('berhasil') ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} /> {msg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-circle-notch fa-spin" /> Memuat data...
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-inbox" style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }} />
          <p>Belum ada paket pekerjaan. Admin Perencana harus mengimpor data master terlebih dahulu.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(grouped).map(([subId, group]) => (
            <div key={subId} className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                <i className="fa-solid fa-diagram-project" style={{ color: 'var(--primary-orange)', marginRight: '8px' }} />
                {group.namaSubkegiatan || subId}
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, minWidth: '200px', position: 'sticky', left: 0, background: 'var(--glass-bg)', zIndex: 1 }}>
                        Nama Paket Pekerjaan
                      </th>
                      {BULAN_NAMES.map(b => (
                        <th key={b} style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)', fontWeight: 600, minWidth: '65px' }}>{b}</th>
                      ))}
                      <th style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map(p => {
                      const row = edits[p.id] || {};
                      const has100 = BULAN_KEY.some(k => parseFloat(row[k]) === 100);
                      const hasAnyVal = BULAN_KEY.some(k => parseFloat(row[k]) > 0);
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                          <td style={{ padding: '6px 12px', color: 'var(--text-primary)', fontWeight: 500, position: 'sticky', left: 0, background: 'var(--glass-bg)', zIndex: 1 }}>
                            {p.namaPaket}
                          </td>
                          {BULAN_KEY.map(k => {
                            const val = row[k];
                            const numVal = parseFloat(val) || 0;
                            const isComplete = numVal === 100;
                            return (
                              <td key={k} style={{ padding: '4px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min={0} max={100}
                                  value={val === '' ? '' : (val ?? 0)}
                                  onChange={e => !isLocked && handleChange(p.id, k, e.target.value)}
                                  disabled={isLocked}
                                  style={{
                                    width: '54px',
                                    textAlign: 'center',
                                    padding: '5px 4px',
                                    borderRadius: '6px',
                                    border: `1px solid ${isComplete ? 'rgba(16,185,129,0.5)' : numVal > 0 ? 'rgba(245,158,11,0.5)' : 'var(--glass-border)'}`,
                                    background: isComplete ? 'rgba(16,185,129,0.1)' : numVal > 0 ? 'rgba(245,158,11,0.08)' : 'var(--glass-bg)',
                                    color: 'var(--text-primary)',
                                    fontSize: '12px',
                                    outline: 'none',
                                    cursor: isLocked ? 'not-allowed' : 'text',
                                    opacity: isLocked ? 0.6 : 1,
                                  }}
                                />
                              </td>
                            );
                          })}
                          <td style={{ padding: '6px', textAlign: 'center' }}>
                            {!hasAnyVal ? (
                              <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--glass-border)', fontSize: '10px' }}>Belum diisi</span>
                            ) : has100 ? (
                              <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontSize: '10px' }}><i className="fa-solid fa-circle-check" /> Lengkap</span>
                            ) : (
                              <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', fontSize: '10px' }}><i className="fa-solid fa-triangle-exclamation" /> Belum 100%</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
