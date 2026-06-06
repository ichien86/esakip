'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/context/SimulationContext';

export default function AdminEmployeesPage() {
  const { fetchWithAuth, allEmployees, refreshMetadata, activeRole } = useSimulation();
  const [formId, setFormId] = useState('');
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedBidangs, setSelectedBidangs] = useState([]);
  const [parentId, setParentId] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (parentId) {
      const supervisor = allEmployees.find(e => e.id === parentId);
      if (supervisor) {
        setSelectedBidangs(supervisor.bidangs || []);
      }
    }
  }, [parentId, allEmployees]);

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
    { value: 'admin_bidang', label: 'Admin Bidang' },
    { value: 'kalaksa', label: 'Kepala Pelaksana' },
    { value: 'sekretaris', label: 'Sekretaris' },
    { value: 'kabid', label: 'Kepala Bidang' },
    { value: 'kasi', label: 'Kepala Seksi/Kasubag' },
    { value: 'staff', label: 'Staf Pelaksana' }
  ];

  const bidangOptions = [
    { value: 'Pimpinan', label: 'Pimpinan' },
    { value: 'Sekretariat', label: 'Sekretariat' },
    { value: 'Pencegahan & Kesiapsiagaan', label: 'Pencegahan & Kesiapsiagaan' },
    { value: 'Kedaruratan & Logistik', label: 'Kedaruratan & Logistik' },
    { value: 'Rehabilitasi & Rekonstruksi', label: 'Rehabilitasi & Rekonstruksi' }
  ];

  const handleRoleChange = (role) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleBidangChange = (bidang) => {
    if (selectedBidangs.includes(bidang)) {
      setSelectedBidangs(selectedBidangs.filter(b => b !== bidang));
    } else {
      setSelectedBidangs([...selectedBidangs, bidang]);
    }
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
      setError('Pilih minimal satu bidang pengampu.');
      return;
    }

    const payload = {
      nama,
      nip,
      jabatan,
      roles: selectedRoles,
      bidangs: selectedBidangs,
      parentId: parentId || null,
      isActive,
      requesterRole: 'admin'
    };

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
        resetForm();
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
    setSelectedRoles(emp.roles || []);
    setSelectedBidangs(emp.bidangs || []);
    setParentId(emp.parentId || '');
    setIsActive(emp.isActive !== false);
  };

  const deleteEmployee = async (id) => {
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

  const reactivateEmployee = async (emp) => {
    if (!confirm(`Yakin ingin mengaktifkan kembali pegawai ${emp.nama}?`)) return;
    setError('');
    setSuccess('');

    const payload = {
      nama: emp.nama,
      nip: emp.nip,
      jabatan: emp.jabatan,
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
    setSelectedRoles([]);
    setSelectedBidangs([]);
    setParentId('');
    setIsActive(true);
  };

  const activeEmployees = allEmployees.filter(emp => emp.id !== 'admin');

  return (
    <section>
      <div className="grid-two-columns">
        {/* Form Panel */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3>
              <i className="fa-solid fa-user-plus text-orange"></i>
              {isEditing ? ' Edit Data Pegawai' : ' Tambah Pegawai'}
            </h3>
          </div>
          <div className="panel-body">
            {error && <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
            {success && <div style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}

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
                <label>Jabatan</label>
                <input type="text" className="form-control" value={jabatan} onChange={(e) => setJabatan(e.target.value)} required placeholder="Contoh: Kepala Bidang Pencegahan" />
              </div>

              {/* Roles Multi-select Checkboxes */}
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

              {/* Bidang Multi-select Checkboxes */}
              {parentId ? (
                <div className="form-group mb-3">
                  <label>Bidang Pengampu</label>
                  <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', padding: '12px', borderRadius: '8px', color: '#60A5FA', fontSize: '12px', lineHeight: '1.4' }}>
                    <i className="fa-solid fa-circle-info" style={{ marginRight: '6px' }}></i>
                    Bidang diwariskan otomatis dari atasan langsung: <strong>{allEmployees.find(e => e.id === parentId)?.bidangs?.join(', ') || '-'}</strong>
                  </div>
                </div>
              ) : (
                <div className="form-group mb-3">
                  <label>Bidang Pengampu (Multi-bidang)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(15,23,42,0.4)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    {bidangOptions.map(opt => (
                      <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={selectedBidangs.includes(opt.value)}
                          onChange={() => handleBidangChange(opt.value)}
                          style={{ cursor: 'pointer' }}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group mb-3">
                <label>Atasan Langsung</label>
                <select className="select-sim" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">-- Tidak ada (Root) --</option>
                  {allEmployees.filter(emp => emp.id !== formId && emp.id !== 'admin' && emp.isActive !== false).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nama} ({emp.jabatan})</option>
                  ))}
                </select>
              </div>

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

              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-orange w-full">
                  <i className="fa-solid fa-circle-check"></i> Simpan Data
                </button>
                {isEditing && (
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* List Panel */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3><i className="fa-solid fa-users text-orange"></i> Daftar Pegawai</h3>
          </div>
          <div className="panel-body">
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pegawai</th>
                    <th>Jabatan</th>
                    <th>Bidang</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEmployees.map(emp => (
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
                        <div className="text-muted" style={{ fontSize: '11px' }}>NIP. {emp.nip}</div>
                      </td>
                      <td>{emp.jabatan}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {emp.bidangs.map(b => (
                            <span key={b} className="badge badge-draft" style={{ fontSize: '9px' }}>{b}</span>
                          ))}
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
      </div>
    </section>
  );
}
