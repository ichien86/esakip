'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useUI } from '@/context/UIContext';

const BULAN_FULL  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_KEY   = ['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];

function formatRp(val) {
  return `Rp${Number(val||0).toLocaleString('id-ID')}`;
}

function pct(real, target) {
  if (!target || target === 0) return 0;
  return ((real / target) * 100).toFixed(1);
}

export default function RealisasiFisikPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { activeYear, activeRole, activeBidang } = useUI();
  const [pakets, setPakets] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1);

  // Local edits: { [paketId]: { realisasiFisik, faktorPenghambat, faktorPendorong, alasanTidakTercapai } }
  const [edits, setEdits] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [paketRes, schedRes] = await Promise.all([
        fetchWithAuth(`/api/admin/paket-pekerjaan?tahun=${activeYear}&bidang=${encodeURIComponent(activeBidang || '')}&role=${activeRole || ''}`),
        fetchWithAuth(`/api/admin/settings/realisasi-schedule?tahun=${activeYear}`),
      ]);
      if (paketRes.ok) {
        const data = await paketRes.json();
        const list = data.pakets || [];
        setPakets(list);
        // Init edits
        const init = {};
        list.forEach(p => {
          const ev = (p.evaluasiBulanan || []).find(e => e.bulan === selectedBulan);
          init[p.id] = {
            realisasiFisik: p.realisasiFisik?.[BULAN_KEY[selectedBulan - 1]] ?? '',
            faktorPenghambat: ev?.faktorPenghambat || '',
            faktorPendorong: ev?.faktorPendorong || '',
            alasanTidakTercapai: ev?.alasanTidakTercapai || '',
          };
        });
        setEdits(init);
      }
      if (schedRes.ok) setSchedules(await schedRes.json());
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, activeYear, selectedBulan, activeBidang, activeRole]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  // Re-init edits when bulan changes
  useEffect(() => {
    const init = {};
    pakets.forEach(p => {
      const ev = (p.evaluasiBulanan || []).find(e => e.bulan === selectedBulan);
      init[p.id] = {
        realisasiFisik: p.realisasiFisik?.[BULAN_KEY[selectedBulan - 1]] ?? '',
        faktorPenghambat: ev?.faktorPenghambat || '',
        faktorPendorong: ev?.faktorPendorong || '',
        alasanTidakTercapai: ev?.alasanTidakTercapai || '',
      };
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdits(init);
  }, [selectedBulan, pakets]);

  // Check schedule
  const currentSchedule = schedules.find(s => s.bulan === selectedBulan);
  const isScheduleOpen = (() => {
    if (!currentSchedule) return false;
    if (currentSchedule.isLocked) return false;
    if (!currentSchedule.deadline) return true;
    return new Date() <= new Date(currentSchedule.deadline + 'T23:59:59');
  })();

  const prevBulanKey  = selectedBulan > 1 ? BULAN_KEY[selectedBulan - 2] : null;
  const curBulanKey   = BULAN_KEY[selectedBulan - 1];

  const handleEditChange = (paketId, field, value) => {
    setEdits(prev => ({
      ...prev,
      [paketId]: { ...prev[paketId], [field]: value }
    }));
  };

  const validate = () => {
    for (const p of pakets) {
      const e = edits[p.id] || {};
      const real = parseFloat(e.realisasiFisik) || 0;
      const target = parseFloat(p.targetFisik?.[curBulanKey]) || 0;

      if (real < target && !e.faktorPenghambat.trim()) {
        return `Paket "${p.namaPaket}": Wajib mengisi Faktor Penghambat karena realisasi (${real}%) lebih kecil dari target (${target}%).`;
      }

      if (selectedBulan === 12 && real < 100 && real > 0 && !e.alasanTidakTercapai.trim()) {
        return `Paket "${p.namaPaket}": Bulan Desember dengan capaian < 100% wajib mengisi Alasan Tidak Tercapai.`;
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
      const items = pakets.map(p => {
        const e = edits[p.id] || {};
        return {
          id: p.id,
          realisasiFisik: parseFloat(e.realisasiFisik) || 0,
          faktorPenghambat: e.faktorPenghambat || '',
          faktorPendorong: e.faktorPendorong || '',
          alasanTidakTercapai: e.alasanTidakTercapai || '',
        };
      });

      const res = await fetchWithAuth('/api/admin/paket-pekerjaan/realisasi-fisik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, bulan: selectedBulan }),
      });
      const data = await res.json();
      setMsg(res.ok ? data.message : (data.error || 'Gagal menyimpan'));
      if (res.ok) await loadData();
    } finally {
      setSaving(false);
    }
  };

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
            <i className="fa-solid fa-chart-line" style={{ color: 'var(--primary-orange)', marginRight: '10px' }} />
            Realisasi Fisik Bulanan
          </h1>
          <p className="text-muted">Admin Unit Kerja — Isi capaian fisik bulanan berdasarkan paket pekerjaan</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            value={selectedBulan}
            onChange={e => setSelectedBulan(parseInt(e.target.value))}
            style={{ width: 'auto', padding: '6px 12px' }}
          >
            {BULAN_FULL.map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
          </select>
          {isScheduleOpen && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><i className="fa-solid fa-circle-notch fa-spin" /> Menyimpan...</> : <><i className="fa-solid fa-floppy-disk" /> Simpan Realisasi</>}
            </button>
          )}
        </div>
      </div>

      {/* Schedule Guard Banner */}
      {!isScheduleOpen && (
        <div style={{ marginBottom: '16px', padding: '14px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <i className="fa-solid fa-lock" style={{ color: 'var(--danger)', fontSize: '18px', flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--danger)', fontSize: '13px' }}>
              Jadwal Pengisian Realisasi {BULAN_FULL[selectedBulan - 1]} Belum Dibuka atau Sudah Ditutup
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              {currentSchedule?.deadline ? `Batas pengisian: ${currentSchedule.deadline}` : 'Jadwal belum diatur oleh Admin Sistem.'}
            </p>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ marginBottom: '14px', padding: '12px 16px', borderRadius: '8px', background: msg.includes('berhasil') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: msg.includes('berhasil') ? '#10b981' : 'var(--danger)', fontSize: '13px' }}>
          <i className={`fa-solid ${msg.includes('berhasil') ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} /> {msg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-circle-notch fa-spin" /> Memuat data...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(grouped).map(([subId, group]) => (
            <div key={subId} className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                <i className="fa-solid fa-diagram-project" style={{ color: 'var(--primary-orange)', marginRight: '8px' }} />
                {group.namaSubkegiatan || subId}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {group.items.map(p => {
                  const e    = edits[p.id] || {};
                  const real = parseFloat(e.realisasiFisik) || 0;
                  const targetCur  = parseFloat(p.targetFisik?.[curBulanKey]) || 0;
                  const targetPrev = prevBulanKey ? (parseFloat(p.targetFisik?.[prevBulanKey]) || 0) : null;
                  const realPrev   = prevBulanKey ? (parseFloat(p.realisasiFisik?.[prevBulanKey]) || 0) : null;
                  const anggaranPrev = prevBulanKey ? (parseFloat(p.realisasiAnggaran?.[prevBulanKey]) || 0) : null;

                  const deviation = real - targetCur;
                  const showHambat  = real < targetCur && real > 0;
                  const showPendorong = real > targetCur;
                  const showAlasan = selectedBulan === 12 && real < 100 && real > 0;

                  const progressColor = real >= targetCur ? '#10b981' : real >= targetCur * 0.8 ? '#f59e0b' : 'var(--danger)';

                  return (
                    <div key={p.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{p.namaPaket}</h4>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>Pagu: {formatRp(p.paguAnggaran)}</p>
                        </div>
                        <span className="badge" style={{ background: `rgba(${real >= targetCur ? '16,185,129' : '239,68,68'},0.1)`, color: progressColor, border: `1px solid rgba(${real >= targetCur ? '16,185,129' : '239,68,68'},0.3)`, fontSize: '11px' }}>
                          {real > 0 ? `Capaian: ${real}%` : 'Belum diisi'}
                        </span>
                      </div>

                      {/* Comparison table */}
                      <div style={{ display: 'grid', gridTemplateColumns: selectedBulan === 1 ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '8px', marginBottom: '14px' }}>
                        {selectedBulan > 1 && prevBulanKey && (
                          <>
                            <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', borderTop: '2px solid rgba(148,163,184,0.4)' }}>
                              <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Target {BULAN_FULL[selectedBulan-2]}</p>
                              <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)' }}>{targetPrev}%</p>
                            </div>
                            <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', borderTop: `2px solid ${realPrev >= targetPrev ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}` }}>
                              <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Realisasi {BULAN_FULL[selectedBulan-2]}</p>
                              <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700, color: realPrev >= targetPrev ? '#10b981' : 'var(--danger)' }}>{realPrev}%</p>
                            </div>
                            <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', borderTop: '2px solid rgba(245,158,11,0.4)' }}>
                              <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Anggaran {BULAN_FULL[selectedBulan-2]}</p>
                              <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>{formatRp(anggaranPrev)}</p>
                            </div>
                          </>
                        )}
                        <div style={{ padding: '10px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', borderTop: '2px solid rgba(99,102,241,0.5)' }}>
                          <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Target {BULAN_FULL[selectedBulan-1]}</p>
                          <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700, color: '#6366f1' }}>{targetCur}%</p>
                        </div>
                        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', borderTop: `2px solid ${progressColor}` }}>
                          <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Realisasi {BULAN_FULL[selectedBulan-1]}</p>
                          <input
                            type="number"
                            min={0} max={100}
                            value={e.realisasiFisik}
                            onChange={ev => isScheduleOpen && handleEditChange(p.id, 'realisasiFisik', ev.target.value === '' ? '' : Math.max(0, Math.min(100, parseFloat(ev.target.value) || 0)))}
                            disabled={!isScheduleOpen}
                            placeholder="0"
                            style={{
                              marginTop: '4px',
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: `1px solid ${progressColor}`,
                              background: 'rgba(255,255,255,0.06)',
                              color: 'var(--text-primary)',
                              fontWeight: 700,
                              fontSize: '16px',
                              cursor: isScheduleOpen ? 'text' : 'not-allowed',
                              opacity: isScheduleOpen ? 1 : 0.6,
                              outline: 'none',
                              textAlign: 'center',
                            }}
                          />
                          {real > 0 && (
                            <p style={{ margin: '4px 0 0', fontSize: '10px', color: progressColor, textAlign: 'center' }}>
                              {deviation > 0 ? `+${deviation.toFixed(1)}%` : `${deviation.toFixed(1)}%`} dari target
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Conditional feedback fields */}
                      {isScheduleOpen && showHambat && (
                        <div className="form-group" style={{ marginBottom: '10px' }}>
                          <label className="form-label" style={{ fontSize: '12px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-triangle-exclamation" /> Faktor Penghambat <span style={{ color: 'var(--danger)' }}>*</span>
                          </label>
                          <textarea
                            className="form-input"
                            rows={2}
                            value={e.faktorPenghambat}
                            onChange={ev => handleEditChange(p.id, 'faktorPenghambat', ev.target.value)}
                            placeholder="Jelaskan faktor yang menghambat capaian..."
                            style={{ fontSize: '12px', borderColor: 'rgba(239,68,68,0.4)', resize: 'vertical' }}
                          />
                        </div>
                      )}

                      {isScheduleOpen && showPendorong && (
                        <div className="form-group" style={{ marginBottom: '10px' }}>
                          <label className="form-label" style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-rocket" /> Faktor Pendorong
                          </label>
                          <textarea
                            className="form-input"
                            rows={2}
                            value={e.faktorPendorong}
                            onChange={ev => handleEditChange(p.id, 'faktorPendorong', ev.target.value)}
                            placeholder="Jelaskan faktor yang mendorong pencapaian melebihi target..."
                            style={{ fontSize: '12px', borderColor: 'rgba(16,185,129,0.4)', resize: 'vertical' }}
                          />
                        </div>
                      )}

                      {isScheduleOpen && showAlasan && (
                        <div className="form-group" style={{ marginBottom: '10px', padding: '12px', background: 'rgba(239,68,68,0.07)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>
                          <label className="form-label" style={{ fontSize: '12px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-flag" /> Alasan Tidak Tercapai 100% di Akhir Tahun <span style={{ color: 'var(--danger)' }}>*</span>
                          </label>
                          <textarea
                            className="form-input"
                            rows={3}
                            value={e.alasanTidakTercapai}
                            onChange={ev => handleEditChange(p.id, 'alasanTidakTercapai', ev.target.value)}
                            placeholder="Wajib diisi: Jelaskan mengapa target fisik tidak mencapai 100% di akhir tahun..."
                            style={{ fontSize: '12px', borderColor: 'rgba(239,68,68,0.4)', resize: 'vertical' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-inbox" style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }} />
              <p>Belum ada paket pekerjaan untuk tahun {activeYear}.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
