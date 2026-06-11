'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSimulation } from '@/context/SimulationContext';

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };
  const {
    user,
    simulatedUser,
    currentUser,
    activeRole,
    activeBidang,
    activeYear,
    isSimulating,
    allEmployees,
    systemSettings,
    loading,
    logout,
    simulate,
    switchRole,
    switchBidang,
    updateCurrentUserBidang,
    switchYear,
    fetchWithAuth
  } = useSimulation();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: 'white',
        fontSize: '18px'
      }}>
        <span><i className="fa-solid fa-circle-notch fa-spin"></i> Loading...</span>
      </div>
    );
  }

  const isLinkActive = (path) => {
    return pathname === path;
  };

  // Determine which sections to show
  const showAdminMenu = activeRole === 'admin' || activeRole === 'perencana';
  const showUserManagement = activeRole === 'admin';
  const showEmployeeMenu = activeRole === 'staff' || activeRole === 'pemimpin' || activeRole === 'admin_bidang';
  const showSupervisorMenu = activeRole === 'pemimpin' || activeRole === 'admin_bidang';

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Admin Sistem',
      perencana: 'Admin Perencana',
      admin_bidang: 'Admin Unit Kerja',
      pemimpin: 'Pemimpin',
      staff: 'Pejabat Fungsional'
    };
    return labels[role] || role;
  };

  return (
    <div className="app-container">
      <div className="background-glow"></div>

      {/* Sidebar */}
      <aside className={`sidebar print-exclude ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="logo-wrapper">
            <i className="fa-solid fa-triangle-exclamation orange-glow"></i>
          </div>
          <div className="brand-text">
            <h2>E-AKIP</h2>
            <span>BPBD BOYOLALI</span>
          </div>
        </div>



        <nav className="sidebar-nav">
          {/* General navigation */}
          <Link href="/dashboard" className={`nav-item ${isLinkActive('/dashboard') ? 'active' : ''}`}>
            <i className="fa-solid fa-chart-line"></i> Dashboard
          </Link>
          <Link href="/organogram" className={`nav-item ${isLinkActive('/organogram') ? 'active' : ''}`}>
            <i className="fa-solid fa-sitemap"></i> Struktur Organisasi
          </Link>

          {/* Admin / Perencana Menu */}
          {showAdminMenu && (
            <>
              <div className="nav-group-title">ADMINISTRASI</div>
              {showUserManagement && (
                <>
                  <Link href="/admin/employees" className={`nav-item ${isLinkActive('/admin/employees') ? 'active' : ''}`}>
                    <i className="fa-solid fa-users-gear"></i> Manajemen Pegawai
                  </Link>
                  <Link href="/admin/settings" className={`nav-item ${isLinkActive('/admin/settings') ? 'active' : ''}`}>
                    <i className="fa-solid fa-gears"></i> Pengaturan Sistem
                  </Link>
                </>
              )}
              <Link href="/admin/master" className={`nav-item ${isLinkActive('/admin/master') ? 'active' : ''}`}>
                <i className="fa-solid fa-database"></i> Data Master
              </Link>
              <Link href="/admin/cascading-5years" className={`nav-item ${isLinkActive('/admin/cascading-5years') ? 'active' : ''}`}>
                <i className="fa-solid fa-layer-group"></i> Indikator Renstra
              </Link>
              <Link href="/admin/operational-definition" className={`nav-item ${isLinkActive('/admin/operational-definition') ? 'active' : ''}`}>
                <i className="fa-solid fa-book-bookmark"></i> Definisi Operasional
              </Link>
              <Link href="/admin/cascading-annual" className={`nav-item ${isLinkActive('/admin/cascading-annual') ? 'active' : ''}`}>
                <i className="fa-solid fa-network-wired"></i> Indikator Renja
              </Link>
              <Link href="/admin/realisasi-schedule" className={`nav-item ${isLinkActive('/admin/realisasi-schedule') ? 'active' : ''}`}>
                <i className="fa-solid fa-calendar-check"></i> Jadwal Realisasi
              </Link>
              <Link href="/admin/perjakin" className={`nav-item ${isLinkActive('/admin/perjakin') ? 'active' : ''}`}>
                <i className="fa-solid fa-print"></i> Cetak Perjakin
              </Link>
              <Link href="/admin/monitoring-5years" className={`nav-item ${isLinkActive('/admin/monitoring-5years') ? 'active' : ''}`}>
                <i className="fa-solid fa-chart-bar"></i> Monitoring Renstra
              </Link>
            </>
          )}

          {/* Employee Menu */}
          {showEmployeeMenu && (
            <>
              <div className="nav-group-title">KINERJA PEGAWAI</div>
              <Link href="/employee/select" className={`nav-item ${isLinkActive('/employee/select') ? 'active' : ''}`}>
                <i className="fa-solid fa-square-check"></i> Pilih Indikator IKU
              </Link>
              <Link href="/employee/renaksi" className={`nav-item ${isLinkActive('/employee/renaksi') ? 'active' : ''}`}>
                <i className="fa-solid fa-calendar-days"></i> Rencana Aksi (Renaksi) & PK
              </Link>
              <Link href="/employee/realisasi" className={`nav-item ${isLinkActive('/employee/realisasi') ? 'active' : ''}`}>
                <i className="fa-solid fa-circle-play"></i> Realisasi Bulanan
              </Link>
            </>
          )}

          {/* Supervisor Menu */}
          {showSupervisorMenu && (
            <>
              <div className="nav-group-title">VERIFIKASI ATASAN</div>
              <Link href="/supervisor/evaluation" className={`nav-item ${isLinkActive('/supervisor/evaluation') ? 'active' : ''}`}>
                <i className="fa-solid fa-user-check"></i> Penilaian Bawahan
              </Link>
            </>
          )}

          {/* Reports & Leaderboard */}
          <div className="nav-group-title">LAPORAN & APRESIASI</div>
          <Link href="/reports" className={`nav-item ${isLinkActive('/reports') ? 'active' : ''}`}>
            <i className="fa-solid fa-file-invoice"></i> Laporan AKIP
          </Link>
          <Link href="/leaderboard" className={`nav-item ${isLinkActive('/leaderboard') ? 'active' : ''}`}>
            <i className="fa-solid fa-trophy"></i> Penghargaan & Leaderboard
          </Link>
        </nav>

        <div className="sidebar-footer">
          <p>Boyolali Metal (Melangkah Tangguh & Tanggap)</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`main-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="top-header print-exclude" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={toggleSidebar} 
            className="sidebar-toggle-btn"
            title={isSidebarCollapsed ? "Tampilkan Sidebar" : "Sembunyikan Sidebar"}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              color: 'white',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '16px',
              transition: 'background 0.2s',
              flexShrink: 0
            }}
          >
            <i className={`fa-solid ${isSidebarCollapsed ? 'fa-indent' : 'fa-outdent'}`}></i>
          </button>
          <div className="header-title">
            <h1>E-AKIP BPBD Boyolali</h1>
            <p className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Aplikasi Evaluasi Kinerja Individu
              {systemSettings?.planning_locked && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--danger)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600
                }}>
                  <i className="fa-solid fa-lock"></i> Perencanaan Terkunci
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Year Selector */}
            <div className="form-group" style={{ margin: 0 }}>
              <select
                className="select-sim"
                value={activeYear}
                onChange={(e) => switchYear(e.target.value)}
                style={{ width: 'auto', background: 'var(--glass-bg)', borderColor: 'var(--glass-border)', fontWeight: 'bold', color: 'var(--primary-orange)' }}
              >
                <option value="2025">Tahun: 2025</option>
                <option value="2026">Tahun: 2026</option>
                <option value="2027">Tahun: 2027</option>
                <option value="2028">Tahun: 2028</option>
                <option value="2029">Tahun: 2029</option>
                <option value="2030">Tahun: 2030</option>
              </select>
            </div>



            {/* Multi-role Selector */}
            {currentUser && currentUser.roles && currentUser.roles.length > 1 && (
              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="select-sim"
                  value={activeRole}
                  onChange={(e) => switchRole(e.target.value)}
                  style={{ width: 'auto', background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}
                >
                  {currentUser.roles.map(r => (
                    <option key={r} value={r}>Role: {getRoleLabel(r)}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="header-profile">
              <div className="profile-info">
                <h4>{currentUser?.nama || 'Guest'}</h4>
                <span>
                  {currentUser?.jabatan || 'No Jabatan'}
                  {activeRole === 'perencana' || activeRole === 'admin'
                    ? ' - Seluruh Unit Kerja'
                    : (currentUser?.bidangs?.[0] ? ` - ${currentUser.bidangs[0]}` : '')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Link href="/profile" className="profile-avatar" title="Profil & Tanda Tangan" style={{ cursor: 'pointer', background: 'rgba(255, 107, 0, 0.2)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-user-gear" style={{ color: 'var(--primary-orange)' }}></i>
                </Link>
                <div className="profile-avatar" onClick={logout} title="Keluar (Logout)" style={{ cursor: 'pointer' }}>
                  <i className="fa-solid fa-right-from-bracket" style={{ color: 'white' }}></i>
                </div>
              </div>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
