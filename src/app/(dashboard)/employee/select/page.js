'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useSimulationInternal } from '@/context/SimulationInternalContext';
import { useUI } from '@/context/UIContext';
import { useMetadata } from '@/context/MetadataContext';

export default function EmployeeIndicatorsPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { currentUser } = useSimulationInternal();
  const { activeBidang, activeYear } = useUI();
  const { allEmployees } = useMetadata();
  const [annualNodes, setAnnualNodes] = useState([]);
  const [indicatorSummary, setIndicatorSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const resolvePenanggungJawabLabel = (val) => {
    if (!val) return 'Belum ditentukan';
    return val.split(',').map(v => {
      if (v.startsWith('jabatan:')) return v.replace('jabatan:', '');
      const emp = allEmployees.find(e => e.id === v);
      return emp ? emp.nama : v;
    }).join(', ');
  };

  // Menghitung target efektif untuk user ini — jika Split, ambil porsi miliknya
  const getEffectiveTarget = (ind) => {
    if (ind.crossCuttingType === 'split' && ind.splitTargets && currentUser) {
      // Coba cari berdasarkan employee ID
      let portion = parseFloat(ind.splitTargets[currentUser.id]);
      // Fallback: cari berdasarkan jabatan
      if (isNaN(portion) && currentUser.jabatan) {
        portion = parseFloat(ind.splitTargets[`jabatan:${currentUser.jabatan}`]);
      }
      if (!isNaN(portion)) return portion;
    }
    return parseFloat(ind.target);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/renja/${activeYear}`);
      if (res.ok) {
        const nodes = await res.json();

        // Filter: only nodes belonging to this user's bidang
        const filtered = nodes.filter(n => {
          const belongsToBidang = n.bidangPengampu.includes(activeBidang) || activeBidang === 'Pimpinan';
          if (!belongsToBidang) return false;
          if (n.crossCuttingType === 'bersama' && n.selectedBidang && activeBidang !== 'Pimpinan') {
            return n.selectedBidang === activeBidang;
          }
          return true;
        });

        // For non-admin employees: only show nodes that have indicators assigned to this user
        const userNodes = filtered.filter(node => {
          if (!node.indicators || node.indicators.length === 0) return false;
          if (!currentUser) return false;
          return node.indicators.some(ind => {
            const pics = (ind.penanggungJawab || '').split(',').map(s => s.trim()).filter(Boolean);
            return pics.includes(currentUser.id) || pics.some(p => {
              if (p.startsWith('jabatan:')) {
                const jab = p.replace('jabatan:', '');
                return currentUser.jabatan === jab;
              }
              return false;
            });
          });
        });

        setAnnualNodes(userNodes);

        // Load summary after getting nodes
        fetchWithAuth(`/api/renaksi/summary/${activeYear}`)
          .then(r => r.ok ? r.json() : {})
          .then(data => setIndicatorSummary(data))
          .catch(e => console.error('Failed to load summary', e));
      }
    } catch (e) {
      console.error('Failed to load indicators', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser, activeBidang, activeYear, fetchWithAuth]);

  useEffect(() => {
    if (currentUser) {
      const timer = setTimeout(() => loadData(), 0);
      return () => clearTimeout(timer);
    }
  }, [currentUser, loadData]);

  const getLevelColor = (level) => {
    if (['program', 'sasaran_program'].includes(level)) return { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)', badge: '#10b981', label: 'Program' };
    if (['kegiatan', 'sasaran_kegiatan'].includes(level)) return { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)', badge: '#3b82f6', label: 'Kegiatan' };
    if (['subkegiatan', 'sasaran_subkegiatan'].includes(level)) return { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', badge: '#f59e0b', label: 'Subkegiatan' };
    if (['aktivitas', 'sasaran_aktivitas'].includes(level)) return { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.3)', badge: '#8b5cf6', label: 'Aktivitas' };
    return { bg: 'rgba(15,23,42,0.3)', border: 'var(--glass-border)', badge: 'gray', label: level };
  };

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3>
          <i className="fa-solid fa-clipboard-list text-orange"></i> Indikator Kinerja Saya
        </h3>
        <p className="text-muted">
          Berikut adalah indikator kinerja yang Anda ampu di unit <strong>{activeBidang}</strong> tahun anggaran <strong>{activeYear}</strong>.
        </p>
      </div>

      <div className="panel-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '24px', marginBottom: '12px', display: 'block' }}></i>
            Memuat data indikator...
          </div>
        ) : annualNodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: '40px', marginBottom: '16px', display: 'block', opacity: 0.3 }}></i>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>Belum ada indikator yang ditugaskan kepada Anda.</div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>Hubungi Admin Unit Kerja untuk pembagian indikator.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {annualNodes.map(node => {
              const styleObj = getLevelColor(node.level);
              // Only show indicators that belong to this user
              const myIndicators = (node.indicators || []).filter(ind => {
                if (!currentUser) return false;
                const pics = (ind.penanggungJawab || '').split(',').map(s => s.trim()).filter(Boolean);
                return pics.includes(currentUser.id) || pics.some(p => {
                  if (p.startsWith('jabatan:')) {
                    return currentUser.jabatan === p.replace('jabatan:', '');
                  }
                  return false;
                });
              });

              if (myIndicators.length === 0) return null;

              return (
                <div key={node.id} style={{ borderRadius: '10px', background: styleObj.bg, border: `1px solid ${styleObj.border}`, overflow: 'hidden' }}>
                  {/* Node header */}
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ display: 'inline-block', background: styleObj.badge, color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>
                      {styleObj.label}
                    </span>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                      {(node.sasaran || node.text) && (
                        <div><span style={{ color: 'var(--text-primary)' }}>Sasaran:</span> <strong style={{ color: 'var(--primary-orange)' }}>{node.sasaran || node.text}</strong></div>
                      )}
                      {node.nomenklatur && <div><span style={{ color: 'var(--text-primary)' }}>Nomenklatur:</span> {node.nomenklatur}</div>}
                    </div>
                  </div>

                  {/* Indicators */}
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {myIndicators.map(ind => {
                      const sum = indicatorSummary[ind.id];
                      const capaianPct = sum?.capaian;
                      const capaianColor = capaianPct === null || capaianPct === undefined
                        ? '#6b7280'
                        : capaianPct >= 100 ? '#10b981'
                        : capaianPct >= 75 ? '#f59e0b'
                        : '#ef4444';
                      const capaianBg = capaianPct === null || capaianPct === undefined
                        ? 'rgba(107,114,128,0.12)'
                        : capaianPct >= 100 ? 'rgba(16,185,129,0.12)'
                        : capaianPct >= 75 ? 'rgba(245,158,11,0.12)'
                        : 'rgba(239,68,68,0.12)';

                      const allPics = (ind.penanggungJawab || '').split(',').map(s => s.trim()).filter(Boolean);
                      const isSplit = ind.crossCuttingType === 'split' && allPics.length > 1;
                      const effectiveTarget = getEffectiveTarget(ind);

                      return (
                        <div key={ind.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: '3px solid var(--primary-orange)', overflow: 'hidden' }}>
                          {/* Indicator top: name + target */}
                          <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500', marginBottom: '4px' }}>{ind.indikator}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Target{isSplit ? ' Anda' : ''}: <strong style={{ color: 'var(--text-primary)' }}>{effectiveTarget} {ind.satuan}</strong>
                                {isSplit && (
                                  <span style={{ marginLeft: '6px', color: 'var(--text-muted)', fontStyle: 'italic' }}>(dari total {ind.target} {ind.satuan})</span>
                                )}
                                <span style={{ marginLeft: '10px', background: 'rgba(255,107,0,0.1)', color: 'var(--primary-orange)', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>{ind.tipeTarget}</span>
                              </div>
                              {allPics.length > 1 && (
                                <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--primary-orange)', fontWeight: 'bold' }}>
                                  <i className="fa-solid fa-people-group" style={{ marginRight: '4px' }}></i>
                                  Bersama: {resolvePenanggungJawabLabel(ind.penanggungJawab)} · {isSplit ? 'Split Target' : 'Shared Target'}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Definisi & Metode */}
                          {(ind.definisiOperasional || ind.metodePenghitungan) && (
                            <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {ind.definisiOperasional && (
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.5' }}>
                                  <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary-orange)', marginRight: '6px', fontSize: '10px' }}></i>
                                  {ind.definisiOperasional}
                                </div>
                              )}
                              {ind.metodePenghitungan && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <i className="fa-solid fa-calculator" style={{ color: 'var(--primary-orange)', fontSize: '10px' }}></i>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Cara Hitung:</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-primary)', background: 'rgba(255,107,0,0.1)', padding: '1px 7px', borderRadius: '10px', border: '1px solid rgba(255,107,0,0.2)' }}>{ind.metodePenghitungan}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Status & CTA Buttons */}
                          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Status badges */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                              <span style={{ padding: '3px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', background: sum?.hasTarget ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: sum?.hasTarget ? '#10b981' : '#ef4444', border: `1px solid ${sum?.hasTarget ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                                <i className={`fa-solid fa-${sum?.hasTarget ? 'check' : 'xmark'}`} style={{ marginRight: '4px' }}></i>
                                {sum?.hasTarget ? `Target: ${sum.bulanTarget} bulan` : 'Belum Ada Target Renaksi'}
                              </span>
                              <span style={{ padding: '3px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', background: sum?.hasRealisasi ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: sum?.hasRealisasi ? '#10b981' : '#ef4444', border: `1px solid ${sum?.hasRealisasi ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                                <i className={`fa-solid fa-${sum?.hasRealisasi ? 'check' : 'xmark'}`} style={{ marginRight: '4px' }}></i>
                                {sum?.hasRealisasi ? `Realisasi: ${sum.bulanRealisasi} bulan` : 'Belum Ada Realisasi'}
                              </span>
                            </div>

                            {/* Progress bar (only if realisasi exists) */}
                            {sum?.hasRealisasi && (
                              <div style={{ background: capaianBg, borderRadius: '6px', padding: '8px 10px', border: `1px solid ${capaianColor}30` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Capaian</span>
                                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: capaianColor }}>
                                    {capaianPct !== null && capaianPct !== undefined ? `${capaianPct}%` : '-'}
                                  </span>
                                </div>
                                <div style={{ height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
                                  <div style={{ height: '100%', width: `${Math.min(capaianPct || 0, 100)}%`, background: capaianColor, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                                </div>
                                {sum.label && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{sum.label}</div>}
                              </div>
                            )}

                            {/* CTA Buttons */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {!sum?.hasTarget && (
                                <Link href="/employee/renaksi" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'rgba(255,107,0,0.85)', color: 'white', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', border: '1px solid rgba(255,107,0,0.5)', transition: 'all 0.2s' }}>
                                  <i className="fa-solid fa-pen-to-square"></i> Isi Target
                                </Link>
                              )}
                              {sum?.hasTarget && !sum?.hasRealisasi && (
                                <Link href="/employee/realisasi" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'rgba(59,130,246,0.85)', color: 'white', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', border: '1px solid rgba(59,130,246,0.5)', transition: 'all 0.2s' }}>
                                  <i className="fa-solid fa-chart-line"></i> Isi Realisasi
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
