'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';
import { useMetadata } from '@/context/MetadataContext';
import { useUI } from '@/context/UIContext';

export default function AdminEmployeesPage() {
  const { fetchWithAuth } = useFetchWithAuth();
  const { allEmployees, refreshMetadata } = useMetadata();
  const { activeRole } = useUI();
  const [formId, setFormId] = useState('');
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [jenisJabatan, setJenisJabatan] = useState('JFU');
  const [pangkatGolongan, setPangkatGolongan] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedBidangs, setSelectedBidangs] = useState([]);
  const [pltBidangs, setPltBidangs] = useState([]);
  const [isPlt, setIsPlt] = useState(false);
  const [parentId, setParentId] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  const [allEmployeesWithSystem, setAllEmployeesWithSystem] = useState([]);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);

  // Replacement Flow State
  const [replacementPrompt, setReplacementPrompt] = useState(null);
  const [replacementTarget, setReplacementTarget] = useState('');
  const [replacementLoading, setReplacementLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showFormModal) return;
      
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT' || 
        activeEl.isContentEditable
      )) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFormModal]);

  useEffect(() => {
    if (activeRole === 'admin') {
      fetch('/api/employees?includeSystem=true')
        .then(res => res.json())
        .then(data => setAllEmployeesWithSystem(data))
        .catch(err => console.error(err));
    }
  }, [activeRole]);

  if (activeRole !== 'admin') {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        <i className="fa-solid fa-ban text-orange" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h2>Akses Ditolak</h2>
        <p className="text-muted" style={{ marginTop: '8px' }}>Hanya Administrator Sistem yang diperbolehkan mengelola data pegawai.</p>
      </div>
    );
  }

  const roleOptions = [
    { value: 'admin', label: 'Admin Sistem' },
    { value: 'perencana', label: 'Admin Perencana' },
    { value: 'admin_bidang', label: 'Admin Unit Kerja' },
    { value: 'pemimpin', label: 'Pemimpin' },
    { value: 'staff', label: 'Pejabat Fungsional' }
  ];

  const bidangOptions = [
    { value: 'Badan', label: 'Badan' },
    { value: 'Sekretariat', label: 'Sekretariat' },
    { value: 'Tata Usaha', label: 'Tata Usaha' },
    { value: 'Bidang Pencegahan dan Kesiapsiagaan', label: 'Bidang Pencegahan dan Kesiapsiagaan' },
    { value: 'Bidang Kedaruratan dan Logistik', label: 'Bidang Kedaruratan dan Logistik' },
    { value: 'Bidang Rehabilitasi dan Rekonstruksi', label: 'Bidang Rehabilitasi dan Rekonstruksi' }
  ];

  const handleRoleChange = (role) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleParentChange = (newParentId) => {
    setParentId(newParentId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (selectedRoles.length === 0) {
      setError('Pilih minimal satu role.');
      return;
    }
    if (selectedBidangs.length === 0) {
      setError('Pilih unit kerja.');
      return;
    }

    const payload = {
      nama,
      nip,
      jabatan,
      jenisJabatan,
      pangkatGolongan,
      roles: selectedRoles,
      bidangs: selectedBidangs,
      pltBidangs: isPlt ? pltBidangs : [],
      parentId: parentId || null,
      isActive,
      requesterRole: 'admin'
    };

    if (isEditing) {
      const originalEmp = allEmployees.find(e => e.id === formId);
      if (originalEmp) {
        const removedRoles = originalEmp.roles.filter(r => !selectedRoles.includes(r) || !isActive);
        
        if (removedRoles.includes('admin')) {
          const allAdmins = allEmployees.filter(e => e.roles?.includes('admin') && e.isActive !== false);
          if (allAdmins.length <= 1) {
            const candidates = allEmployees.filter(e => !e.roles?.includes('admin') && e.isActive !== false && e.id !== formId);
            setReplacementPrompt({ roleName: 'admin', roleDisplay: 'Administrator Sistem', action: 'save', payload, candidates });
            return;
          }
        }
        
        if (removedRoles.includes('perencana')) {
          const allPerencana = allEmployees.filter(e => e.roles?.includes('perencana') && e.isActive !== false);
          if (allPerencana.length <= 1) {
            const candidates = allEmployees.filter(e => !e.roles?.includes('perencana') && e.isActive !== false && e.id !== formId);
            setReplacementPrompt({ roleName: 'perencana', roleDisplay: 'Admin Perencana', action: 'save', payload, candidates });
            return;
          }
        }

        if (removedRoles.includes('admin_bidang') && originalEmp.bidangs?.length > 0) {
          const bidang = originalEmp.bidangs[0];
          const allAdminBidang = allEmployees.filter(e => e.roles?.includes('admin_bidang') && e.bidangs?.includes(bidang) && e.isActive !== false);
          if (allAdminBidang.length <= 1) {
            const candidates = allEmployees.filter(e => !e.roles?.includes('admin_bidang') && e.bidangs?.includes(bidang) && e.isActive !== false && e.id !== formId);
            setReplacementPrompt({ roleName: 'admin_bidang', roleDisplay: `Admin Unit Kerja (${bidang})`, action: 'save', payload, candidates });
            return;
          }
        }
      }
    }

    try {
      let res;
      if (isEditing) {
        res = await fetchWithAuth(`/api/admin/employees/${formId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetchWithAuth('/api/admin/employees', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setSuccess(isEditing ? 'Data pegawai berhasil diubah.' : 'Pegawai baru berhasil ditambahkan.');
        closeFormModal();
        refreshMetadata();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan data.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const editEmployee = (emp) => {
    setIsEditing(true);
    setFormId(emp.id);
    setNama(emp.nama);
    setNip(emp.nip);
    setJabatan(emp.jabatan);
    setJenisJabatan(emp.jenisJabatan || 'JFU');
    setPangkatGolongan(emp.pangkatGolongan || '');
    setSelectedRoles(emp.roles || []);
    setSelectedBidangs(emp.bidangs || []);
    setPltBidangs(emp.pltBidangs || []);
    setIsPlt((emp.pltBidangs || []).length > 0);
    setParentId(emp.parentId || '');
    setIsActive(emp.isActive !== false);
    setShowFormModal(true);
  };

  const deleteEmployee = async (id) => {
    const originalEmp = allEmployees.find(e => e.id === id);
    if (!originalEmp) return;

    const removedRoles = originalEmp.roles;
    if (removedRoles.includes('admin')) {
      const allAdmins = allEmployees.filter(e => e.roles?.includes('admin') && e.isActive !== false);
      if (allAdmins.length <= 1) {
        const candidates = allEmployees.filter(e => !e.roles?.includes('admin') && e.isActive !== false && e.id !== id);
        setReplacementPrompt({ roleName: 'admin', roleDisplay: 'Administrator Sistem', action: 'delete', targetId: id, candidates });
        return;
      }
    }
    
    if (removedRoles.includes('perencana')) {
      const allPerencana = allEmployees.filter(e => e.roles?.includes('perencana') && e.isActive !== false);
      if (allPerencana.length <= 1) {
        const candidates = allEmployees.filter(e => !e.roles?.includes('perencana') && e.isActive !== false && e.id !== id);
        setReplacementPrompt({ roleName: 'perencana', roleDisplay: 'Admin Perencana', action: 'delete', targetId: id, candidates });
        return;
      }
    }

    if (removedRoles.includes('admin_bidang') && originalEmp.bidangs?.length > 0) {
      const bidang = originalEmp.bidangs[0];
      const allAdminBidang = allEmployees.filter(e => e.roles?.includes('admin_bidang') && e.bidangs?.includes(bidang) && e.isActive !== false);
      if (allAdminBidang.length <= 1) {
        const candidates = allEmployees.filter(e => !e.roles?.includes('admin_bidang') && e.bidangs?.includes(bidang) && e.isActive !== false && e.id !== id);
        setReplacementPrompt({ roleName: 'admin_bidang', roleDisplay: `Admin Unit Kerja (${bidang})`, action: 'delete', targetId: id, candidates });
        return;
      }
    }

    if (!confirm('Yakin ingin menonaktifkan pegawai ini?')) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetchWithAuth(`/api/admin/employees/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSuccess('Pegawai berhasil dinonaktifkan.');
        refreshMetadata();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menonaktifkan pegawai.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const executeReplacement = async () => {
    if (!replacementTarget) return;
    setReplacementLoading(true);
    setError('');
    setSuccess('');

    try {
      const targetEmp = allEmployees.find(e => e.id === replacementTarget);
      if (!targetEmp) throw new Error('Pegawai pengganti tidak valid');

      const newRoles = [...(targetEmp.roles || []), replacementPrompt.roleName];
      const updateTargetRes = await fetchWithAuth(`/api/admin/employees/${replacementTarget}`, {
        method: 'PUT',
        body: JSON.stringify({
          nama: targetEmp.nama,
          nip: targetEmp.nip,
          jabatan: targetEmp.jabatan,
          jenisJabatan: targetEmp.jenisJabatan || 'JFU',
          pangkatGolongan: targetEmp.pangkatGolongan || '',
          roles: newRoles,
          bidangs: targetEmp.bidangs || [],
          parentId: targetEmp.parentId || null,
          isActive: targetEmp.isActive,
          requesterRole: 'admin'
        })
      });

      if (!updateTargetRes.ok) throw new Error('Gagal menambahkan role pada pegawai pengganti');

      if (replacementPrompt.action === 'save') {
        const res = await fetchWithAuth(`/api/admin/employees/${formId}`, {
          method: 'PUT',
          body: JSON.stringify(replacementPrompt.payload)
        });
        if (res.ok) {
          setSuccess('Data berhasil disimpan dan pengganti telah ditetapkan.');
          closeFormModal();
          refreshMetadata();
        } else {
          const err = await res.json();
          throw new Error(err.error || 'Gagal menyimpan data pegawai.');
        }
      } else if (replacementPrompt.action === 'delete') {
        const res = await fetchWithAuth(`/api/admin/employees/${replacementPrompt.targetId}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setSuccess('Pegawai dinonaktifkan dan pengganti telah ditetapkan.');
          refreshMetadata();
        } else {
          const err = await res.json();
          throw new Error(err.error || 'Gagal menonaktifkan pegawai.');
        }
      }
      
      setReplacementPrompt(null);
      setReplacementTarget('');
    } catch (err) {
      setError(err.message);
    } finally {
      setReplacementLoading(false);
    }
  };

  const closeReplacementModal = () => {
    setReplacementPrompt(null);
    setReplacementTarget('');
  };

  const reactivateEmployee = async (emp) => {
    if (!confirm(`Yakin ingin mengaktifkan kembali pegawai ${emp.nama}?`)) return;
    setError('');
    setSuccess('');

    const payload = {
      nama: emp.nama,
      nip: emp.nip,
      jabatan: emp.jabatan,
      jenisJabatan: emp.jenisJabatan || 'JFU',
      pangkatGolongan: emp.pangkatGolongan || '',
      roles: emp.roles,
      bidangs: emp.bidangs,
      parentId: emp.parentId,
      isActive: true,
      requesterRole: 'admin'
    };

    try {
      const res = await fetchWithAuth(`/api/admin/employees/${emp.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccess(`Pegawai ${emp.nama} berhasil diaktifkan kembali.`);
        refreshMetadata();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal mengaktifkan kembali pegawai.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const resetPassword = async (id, name) => {
    if (!confirm(`Yakin ingin mereset password untuk ${name}? Password akan dikembalikan ke default: bpbd@boyolali`)) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetchWithAuth('/api/admin/employees/reset-password', {
        method: 'POST',
        body: JSON.stringify({ employeeId: id, requesterRole: 'admin' })
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(data.message || 'Password berhasil direset.');
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal mereset password.');
      }
    } catch (e) {
      setError('Kesalahan jaringan.');
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setFormId('');
    setNama('');
    setNip('');
    setJabatan('');
    setJenisJabatan('JFU');
    setPangkatGolongan('');
    setSelectedRoles([]);
    setSelectedBidangs([]);
    setPltBidangs([]);
    setIsPlt(false);
    setParentId('');
    setIsActive(true);
  };

  const closeFormModal = () => {
    resetForm();
    setShowFormModal(false);
  };

  const activeEmployees = allEmployees.filter(emp => emp.id !== 'admin');

  const filteredEmployees = activeEmployees.filter(emp => {
    const term = searchTerm.toLowerCase();
    return (
      (emp.nama || '').toLowerCase().includes(term) ||
      (emp.nip || '').toLowerCase().includes(term)
    );
  });

  return (
    <section>
      {/* Header bar with Add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-users text-orange"></i>
          Manajemen Pegawai
        </h2>
        <button 
          className="btn btn-orange" 
          onClick={() => { resetForm(); setIsEditing(false); setShowFormModal(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
        >
          <i className="fa-solid fa-user-plus"></i> Tambah Pegawai
        </button>
      </div>

      {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
      {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

      {/* List Panel (Full Width) */}
      <div className="glass-panel">
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <h3 style={{ margin: 0 }}><i className="fa-solid fa-users text-orange"></i> Daftar Pegawai</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '12px' }}></i>
              <input
                ref={searchInputRef}
                type="text"
                className="form-control"
                placeholder="Cari nama / NIP... (Tekan '/')"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '13px', background: 'rgba(15, 23, 42, 0.4)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)', margin: 0 }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px', padding: 0 }}
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="panel-body">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Pegawai</th>
                  <th>Jabatan</th>
                  <th>Unit Kerja</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} style={{ opacity: emp.isActive === false ? 0.6 : 1 }}>
                    <td>
                      <strong>{emp.nama}</strong>
                      {emp.isActive === false && (
                        <span className="badge" style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#EF4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontSize: '9px',
                          marginLeft: '6px'
                        }}>
                          Nonaktif
                        </span>
                      )}
                      {emp.roles.includes('pemimpin') && (
                        <span className="badge" style={{
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#60A5FA',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          fontSize: '9px',
                          marginLeft: '6px'
                        }}>
                          Pimpinan: {emp.bidangs[0] || 'Badan'}{emp.pltBidangs && emp.pltBidangs.length > 0 ? ' (+Plt)' : ''}
                        </span>
                      )}
                      <div className="text-muted" style={{ fontSize: '11px' }}>NIP. {emp.nip}</div>
                      {emp.pangkatGolongan && <div className="text-muted" style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--primary-orange)' }}>{emp.pangkatGolongan}</div>}
                    </td>
                    <td>
                      <div>{emp.jabatan}</div>
                      <div className="badge" style={{ background: 'rgba(255,255,255,0.1)', marginTop: '4px', fontSize: '9px', fontWeight: 'normal' }}>
                        {emp.jenisJabatan || 'JFU'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {emp.bidangs && emp.bidangs.map(b => {
                            if (emp.pltBidangs && emp.pltBidangs.includes(b)) {
                               return <span key={b} className="badge" style={{ fontSize: '9px', background: 'rgba(255,107,0,0.2)', color: 'var(--primary-orange)', border: '1px solid var(--primary-orange)' }}>{b} (Plt)</span>;
                            }
                            return <span key={b} className="badge badge-draft" style={{ fontSize: '9px' }}>{b}</span>;
                          })}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => editEmployee(emp)} title="Edit Pegawai">
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button className="btn btn-sm btn-primary" onClick={() => resetPassword(emp.id, emp.nama)} title="Reset Password ke bpbd@boyolali" style={{ background: '#F59E0B' }}>
                          <i className="fa-solid fa-key"></i>
                        </button>
                        {emp.isActive !== false ? (
                          <button className="btn btn-sm btn-danger" onClick={() => deleteEmployee(emp.id)} title="Nonaktifkan Pegawai">
                            <i className="fa-solid fa-user-slash"></i>
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-secondary" onClick={() => reactivateEmployee(emp)} title="Aktifkan Kembali Pegawai" style={{ background: '#10B981', color: 'white' }}>
                            <i className="fa-solid fa-user-check"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Replacement Prompt Modal */}
      {replacementPrompt && (
        <div className="fade-in" style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.85)', 
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 99999 
        }}>
          <div className="glass-panel slide-down" style={{ 
            maxWidth: '500px', 
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 15px 40px rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,107,0,0.4)',
            borderRadius: '16px',
            overflow: 'hidden'
          }}>
            <div className="panel-header justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,107,0,0.1)' }}>
              <h5 style={{ margin: 0, fontWeight: 'bold' }}>Tunjuk Pengganti ({replacementPrompt.roleDisplay})</h5>
              <button onClick={closeReplacementModal} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
            </div>
            
            <div className="panel-body" style={{ padding: '20px' }}>
              <div className="alert-sim error fade-in" style={{ marginBottom: '20px' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>
                Tindakan ini akan menghapus satu-satunya <strong>{replacementPrompt.roleDisplay}</strong> yang tersisa. Anda wajib menunjuk penggantinya agar tidak kehilangan akses sistem.
              </div>
              
              <div className="form-group">
                <label style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Pilih Pegawai Pengganti</label>
                <select 
                  className="select-sim w-100" 
                  value={replacementTarget} 
                  onChange={(e) => setReplacementTarget(e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                  required
                >
                  <option value="">-- Pilih Pegawai --</option>
                  {replacementPrompt.candidates.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nama} - {emp.jabatan}</option>
                  ))}
                </select>
                {replacementPrompt.candidates.length === 0 && (
                  <small style={{ color: 'var(--danger-color, #ef4444)', marginTop: '8px', display: 'block' }}>
                    <i className="fa-solid fa-circle-xmark" style={{ marginRight: '5px' }}></i>
                    Tidak ada kandidat pegawai aktif di unit ini. Batalkan aksi ini dan tambahkan pegawai baru terlebih dahulu.
                  </small>
                )}
              </div>
            </div>
            
            <div className="panel-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-sim secondary" onClick={closeReplacementModal} disabled={replacementLoading}>Batal</button>
              <button 
                className="btn-sim primary" 
                onClick={executeReplacement} 
                disabled={replacementLoading || !replacementTarget || replacementPrompt.candidates.length === 0}
              >
                {replacementLoading ? <><i className="fa-solid fa-spinner fa-spin"></i> Memproses...</> : 'Tunjuk Pengganti'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Tambah/Edit Pegawai */}
      {showFormModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,107,0,0.3)'
          }}>
            <div className="panel-header justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <h3>
                <i className={`fa-solid ${isEditing ? 'fa-user-pen' : 'fa-user-plus'} text-orange`}></i>
                {isEditing ? ' Edit Data Pegawai' : ' Tambah Pegawai'}
              </h3>
              <button onClick={closeFormModal} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '24px', lineHeight: '1' }}>&times;</button>
            </div>
            
            <div className="panel-body" style={{ padding: '20px', overflowY: 'auto', flexGrow: 1 }}>
              <form onSubmit={handleSubmit}>
                <div className="form-group mb-3">
                  <label>Nama Lengkap & Gelar</label>
                  <input type="text" className="form-control" value={nama} onChange={(e) => setNama(e.target.value)} required placeholder="Contoh: Drs. Bambang, M.Si." />
                </div>
                
                <div className="form-group mb-3">
                  <label>NIP</label>
                  <input type="text" className="form-control" value={nip} onChange={(e) => setNip(e.target.value)} required placeholder="Contoh: 198009112009031005" />
                </div>

                <div className="form-group mb-3">
                  <label>Pangkat/Golongan</label>
                  <input type="text" className="form-control" value={pangkatGolongan} onChange={(e) => setPangkatGolongan(e.target.value)} placeholder="Contoh: Pembina Utama Muda, IV/c" />
                </div>

                <div className="form-group mb-3">
                  <label>Jabatan</label>
                  <input type="text" className="form-control" value={jabatan} onChange={(e) => setJabatan(e.target.value)} required placeholder="Contoh: Kepala Bidang Pencegahan" />
                </div>

                <div className="form-group mb-3">
                  <label>Jenis Jabatan</label>
                  <select className="select-sim" value={jenisJabatan} onChange={(e) => setJenisJabatan(e.target.value)} required>
                    <option value="Pimpinan Tinggi">Pimpinan Tinggi</option>
                    <option value="Administrator">Administrator</option>
                    <option value="Pengawas">Pengawas</option>
                    <option value="JFT">Jabatan Fungsional Tertentu (JFT)</option>
                    <option value="JFU">Jabatan Fungsional Umum (JFU)</option>
                  </select>
                </div>

                {/* Smart Form based on jenisJabatan */}
                {jenisJabatan !== 'Pimpinan Tinggi' && jenisJabatan !== 'Administrator' && (
                  <div className="form-group mb-3">
                    <label>Role Aplikasi (Multi-role)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(15,23,42,0.4)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                      {roleOptions.map(opt => (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={selectedRoles.includes(opt.value)}
                            onChange={() => handleRoleChange(opt.value)}
                            style={{ cursor: 'pointer' }}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {jenisJabatan === 'Administrator' && (
                  <div className="form-group mb-3">
                    <label>Unit Kerja yang Dipimpin Definitif</label>
                    <select
                      className="select-sim"
                      value={selectedBidangs[0] || ''}
                      onChange={(e) => setSelectedBidangs(e.target.value ? [e.target.value] : [])}
                      required
                    >
                      <option value="">-- Pilih Unit Kerja Definitif --</option>
                      {bidangOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {jenisJabatan !== 'Pimpinan Tinggi' && jenisJabatan !== 'Administrator' && (
                  <div className="form-group mb-3">
                    <label>Atasan Langsung</label>
                    <select className="select-sim" value={parentId} onChange={(e) => handleParentChange(e.target.value)} required>
                      <option value="">-- Pilih Atasan Langsung --</option>
                      {allEmployeesWithSystem.filter(emp => emp.id !== formId && emp.id !== 'admin' && emp.isActive !== false && emp.roles.includes('pemimpin')).map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.nama} ({emp.jabatan})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group mb-3">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={isPlt}
                      onChange={(e) => setIsPlt(e.target.checked)}
                      style={{ cursor: 'pointer', width: 'auto' }}
                    />
                    <strong>Jabat sebagai Pelaksana Tugas (Plt) di Unit Lain?</strong>
                  </label>
                </div>

                {isPlt && (
                  <div className="form-group mb-3">
                    <label style={{ fontWeight: 'bold', color: 'var(--primary-orange)' }}>
                      Pilih Unit Kerja Plt
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(15, 23, 42, 0.4)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                      {bidangOptions.filter(opt => opt.value !== (selectedBidangs[0] || '')).map(opt => {
                        const isChecked = pltBidangs.includes(opt.value);
                        const handleCheckboxChange = () => {
                          if (isChecked) {
                            setPltBidangs(pltBidangs.filter(b => b !== opt.value));
                          } else {
                            setPltBidangs([...pltBidangs, opt.value]);
                          }
                        };
                        return (
                          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={handleCheckboxChange}
                              style={{ cursor: 'pointer' }}
                            />
                            {opt.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isEditing && (
                  <div className="form-group mb-3">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        style={{ cursor: 'pointer', width: 'auto' }}
                      />
                      <strong>Pegawai Aktif</strong>
                    </label>
                    <p className="text-muted" style={{ fontSize: '11px', margin: '4px 0 0 0' }}>
                      Hilangkan centang untuk menonaktifkan akun pegawai ini tanpa menghapus data.
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={closeFormModal}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-orange">
                    <i className="fa-solid fa-circle-check"></i> Simpan Data
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
