'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSimulation } from '@/context/SimulationContext';

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
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
    switchYear
  } = useSimulation();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

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
  const showEmployeeMenu = ['staff', 'kasi', 'kabid', 'sekretaris', 'kalaksa'].includes(activeRole);
  const showSupervisorMenu = ['kasi', 'kabid', 'sekretaris', 'kalaksa', 'admin_bidang'].includes(activeRole);

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Admin Sistem',
      perencana: 'Admin Perencana',
      admin_bidang: 'Admin Bidang',
      kalaksa: 'Kepala Pelaksana',
      sekretaris: 'Sekretaris',
      kabid: 'Kepala Bidang',
      kasi: 'Kepala Seksi/Kasubag',
      staff: 'Staf Pelaksana'
    };
    return labels[role] || role;
  };

  return (
    <div className="app-container">
      <div className="background-glow"></div>

      {/* Sidebar */}
      <aside className="sidebar print-exclude">
        <div className="sidebar-brand">
          <div className="logo-wrapper">
            <i className="fa-solid fa-triangle-exclamation orange-glow"></i>
          </div>
          <div className="brand-text">
            <h2>E-AKIP</h2>
            <span>BPBD BOYOLALI</span>
          </div>
        </div>

        {/* User Simulation Swapper (Visible only to actual logged-in Admins) */}
        {user && user.roles.includes('admin') && (
          <div className="user-simulator-box">
            <label htmlFor="userSelect">
              <i className="fa-solid fa-user-ninja" style={{ color: 'var(--primary-orange)' }}></i> Simulasi Pegawai
            </label>
            <select
              id="userSelect"
              className="select-sim"
              value={simulatedUser ? simulatedUser.id : user.id}
              onChange={(e) => simulate(e.target.value)}
            >
              <option value={user.id}>-- Logged In: {user.nama} --</option>
              {allEmployees.filter(emp => emp.id !== user.id && emp.isActive !== false).map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.nama} ({emp.jabatan})
                </option>
              ))}
            </select>
            {isSimulating && (
              <div className="current-role-badge">
                Mode Simulasi Aktif
              </div>
            )}
          </div>
        )}

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
                <Link href="/admin/employees" className={`nav-item ${isLinkActive('/admin/employees') ? 'active' : ''}`}>
                  <i className="fa-solid fa-users-gear"></i> Manajemen Pegawai
                </Link>
              )}
              <Link href="/admin/master" className={`nav-item ${isLinkActive('/admin/master') ? 'active' : ''}`}>
                <i className="fa-solid fa-database"></i> Data Master
              </Link>
              <Link href="/admin/cascading-5years" className={`nav-item ${isLinkActive('/admin/cascading-5years') ? 'active' : ''}`}>
                <i className="fa-solid fa-layer-group"></i> Rencana 5 Tahunan
              </Link>
              <Link href="/admin/operational-definition" className={`nav-item ${isLinkActive('/admin/operational-definition') ? 'active' : ''}`}>
                <i className="fa-solid fa-book-bookmark"></i> Definisi Operasional
              </Link>
              <Link href="/admin/cascading-annual" className={`nav-item ${isLinkActive('/admin/cascading-annual') ? 'active' : ''}`}>
                <i className="fa-solid fa-network-wired"></i> Renja Tahunan
              </Link>
              <Link href="/admin/realisasi-schedule" className={`nav-item ${isLinkActive('/admin/realisasi-schedule') ? 'active' : ''}`}>
                <i className="fa-solid fa-calendar-check"></i> Jadwal Realisasi
              </Link>
              <Link href="/admin/monitoring-5years" className={`nav-item ${isLinkActive('/admin/monitoring-5years') ? 'active' : ''}`}>
                <i className="fa-solid fa-chart-bar"></i> Monitoring 5 Tahunan
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
      <main className="main-content">
        <header className="top-header print-exclude">
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

            {/* Multi-bidang Selector */}
            {currentUser && currentUser.bidangs && currentUser.bidangs.length > 1 && (
              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="select-sim"
                  value={activeBidang}
                  onChange={(e) => switchBidang(e.target.value)}
                  style={{ width: 'auto', background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}
                >
                  {currentUser.bidangs.map(b => (
                    <option key={b} value={b}>Bidang: {b}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="header-profile">
              <div className="profile-info">
                <h4>{currentUser?.nama || 'Guest'}</h4>
                <span>{currentUser?.jabatan || 'No Jabatan'} - {activeBidang}</span>
              </div>
              <div className="profile-avatar" onClick={logout} title="Click to Logout" style={{ cursor: 'pointer' }}>
                <i className="fa-solid fa-right-from-bracket" style={{ color: 'white' }}></i>
              </div>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
