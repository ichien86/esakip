'use client';

import React, { useEffect, useState } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function LeaderboardPage() {
  const { fetchWithAuth, currentUser } = useSimulation();
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBidang, setFilterBidang] = useState('Semua');

  const fetchLeaderboard = async () => {
    try {
      const res = await fetchWithAuth('/api/rewards/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboardData(data);
      }
    } catch (e) {
      console.error('Failed to load leaderboard data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [currentUser]);

  // Extract unique departments for filtering
  const allBidangs = ['Semua', ...new Set(leaderboardData.map(item => item.bidang).filter(Boolean))];

  // Filtered leaderboard
  const filteredData = leaderboardData.filter(item => {
    const matchesSearch = item.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.jabatan.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBidang = filterBidang === 'Semua' || item.bidang === filterBidang;
    return matchesSearch && matchesBidang;
  });

  // Top 3 for podium (based on unfiltered or filtered? Unfiltered represents global leaderboard)
  // Let's use the full global leaderboard for podium, but if filtering is active, maybe we show global top 3. 
  // Actually, visual podium for global ranking is best. Let's do that!
  const top1 = leaderboardData[0];
  const top2 = leaderboardData[1];
  const top3 = leaderboardData[2];

  // Helper to format submission time
  const formatTime = (timestamp) => {
    if (!timestamp || timestamp === Infinity) return 'Belum mengisi';
    const date = new Date(timestamp);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <section>
      <div className="glass-panel print-exclude" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.45) 100%)' }}>
        <div className="panel-header justify-between">
          <h3>
            <i className="fa-solid fa-trophy text-orange"></i> Penghargaan & Leaderboard Capaian Kinerja BPBD 2026
          </h3>
          <button onClick={fetchLeaderboard} className="btn btn-secondary btn-sm">
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
        
        <p className="text-muted" style={{ marginTop: '-12px', marginBottom: '16px' }}>
          Leaderboard dihitung berdasarkan rata-rata pencapaian realisasi Rencana Aksi terhadap Target Bulanan. 
          Jika terdapat skor yang sama, peringkat ditentukan oleh kecepatan waktu pelaporan terakhir (tercepat).
        </p>

        {loading ? (
          <div style={{ color: 'white', textAlign: 'center', padding: '40px 0' }}>
            <i className="fa-solid fa-circle-notch fa-spin fa-2x" style={{ color: 'var(--primary-orange)', marginBottom: '12px' }}></i>
            <p>Memuat peringkat leaderboard...</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium Section */}
            {leaderboardData.length > 0 && (
              <div className="podium-container">
                {/* 2nd Place */}
                {top2 && (
                  <div className="podium-col podium-silver">
                    <div className="podium-card glass-panel">
                      <div className="podium-badge">2</div>
                      <div className="podium-avatar">
                        <i className="fa-solid fa-medal silver-glow"></i>
                      </div>
                      <h4>{top2.nama}</h4>
                      <p className="podium-title">{top2.jabatan}</p>
                      <p className="podium-bidang">{top2.bidang || 'Pimpinan'}</p>
                      <div className="podium-score">
                        <span>{top2.averageCapaian}%</span>
                      </div>
                      <p className="podium-meta">
                        {top2.totalBulanMengisi} Bulan Diisi
                      </p>
                    </div>
                    <div className="podium-step step-silver">
                      <span>SILVER</span>
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {top1 && (
                  <div className="podium-col podium-gold">
                    <div className="podium-card glass-panel">
                      <div className="podium-crown">
                        <i className="fa-solid fa-crown gold-glow animate-bounce"></i>
                      </div>
                      <div className="podium-badge">1</div>
                      <div className="podium-avatar">
                        <i className="fa-solid fa-award gold-glow"></i>
                      </div>
                      <h4>{top1.nama}</h4>
                      <p className="podium-title">{top1.jabatan}</p>
                      <p className="podium-bidang">{top1.bidang || 'Pimpinan'}</p>
                      <div className="podium-score">
                        <span>{top1.averageCapaian}%</span>
                      </div>
                      <p className="podium-meta">
                        {top1.totalBulanMengisi} Bulan Diisi
                      </p>
                    </div>
                    <div className="podium-step step-gold">
                      <span>GOLD</span>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {top3 && (
                  <div className="podium-col podium-bronze">
                    <div className="podium-card glass-panel">
                      <div className="podium-badge">3</div>
                      <div className="podium-avatar">
                        <i className="fa-solid fa-medal bronze-glow"></i>
                      </div>
                      <h4>{top3.nama}</h4>
                      <p className="podium-title">{top3.jabatan}</p>
                      <p className="podium-bidang">{top3.bidang || 'Pimpinan'}</p>
                      <div className="podium-score">
                        <span>{top3.averageCapaian}%</span>
                      </div>
                      <p className="podium-meta">
                        {top3.totalBulanMengisi} Bulan Diisi
                      </p>
                    </div>
                    <div className="podium-step step-bronze">
                      <span>BRONZE</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Filters Bar */}
            <div className="glass-panel" style={{ marginTop: '24px', padding: '16px', background: 'rgba(30, 41, 59, 0.25)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '12px', flexGrow: 1, maxWidth: '600px' }}>
                  <div className="form-group" style={{ margin: 0, flexGrow: 1 }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Cari nama atau jabatan pegawai..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
                    <select
                      className="form-control"
                      value={filterBidang}
                      onChange={(e) => setFilterBidang(e.target.value)}
                    >
                      {allBidangs.map(b => (
                        <option key={b} value={b}>{b === 'Semua' ? 'Semua Bidang' : b}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="text-muted">
                  Menampilkan <strong>{filteredData.length}</strong> pegawai
                </div>
              </div>
            </div>

            {/* Subordinate Rankings Table */}
            <div className="glass-panel" style={{ marginTop: '20px' }}>
              <div className="panel-header">
                <h3>
                  <i className="fa-solid fa-list-ol text-muted"></i> Daftar Peringkat Seluruh Pegawai
                </h3>
              </div>
              <div className="panel-body">
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: '80px', textAlign: 'center' }}>Peringkat</th>
                        <th>Nama Pegawai</th>
                        <th>Jabatan / Bidang</th>
                        <th style={{ textAlign: 'center' }}>Bulan Diisi</th>
                        <th style={{ textAlign: 'center' }}>Rata-rata Capaian</th>
                        <th>Update Pelaporan Terakhir</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada data peringkat pegawai yang cocok</td>
                        </tr>
                      ) : (
                        filteredData.map((item, idx) => {
                          const globalRank = leaderboardData.findIndex(g => g.id === item.id) + 1;
                          
                          // Determine row styles or icons for top 3
                          let rankDisplay = globalRank;
                          if (globalRank === 1) rankDisplay = <span className="rank-badge rank-1"><i className="fa-solid fa-crown"></i> 1</span>;
                          else if (globalRank === 2) rankDisplay = <span className="rank-badge rank-2"><i className="fa-solid fa-medal"></i> 2</span>;
                          else if (globalRank === 3) rankDisplay = <span className="rank-badge rank-3"><i className="fa-solid fa-medal"></i> 3</span>;

                          return (
                            <tr key={item.id} className={globalRank <= 3 ? 'row-highlight' : ''}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{rankDisplay}</td>
                              <td>
                                <strong>{item.nama}</strong>
                              </td>
                              <td>
                                <div>{item.jabatan}</div>
                                <span className="text-muted" style={{ fontSize: '11px' }}>{item.bidang || 'Pimpinan'}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>{item.totalBulanMengisi} / 12</td>
                              <td style={{ textAlign: 'center' }}>
                                <strong className="text-orange" style={{ fontSize: '14px' }}>{item.averageCapaian}%</strong>
                              </td>
                              <td>{formatTime(item.latestSubmissionTime)}</td>
                              <td style={{ textAlign: 'center' }}>
                                {item.totalBulanMengisi > 0 ? (
                                  <span className="badge badge-finished">Aktif</span>
                                ) : (
                                  <span className="badge badge-none">Pasif</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
