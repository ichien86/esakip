'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { useFetchWithAuth } from '@/context/useFetchWithAuth';

export default function MasterUnitKerjaManager() {
  const { fetchWithAuth } = useFetchWithAuth();
  
  const [unitKerja, setUnitKerja] = useState([]);
  const [originalData, setOriginalData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing states
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState(null); // { id, name, type, subUnits: [{id, name}] }

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetchWithAuth('/api/admin/settings/unit-kerja');
      if (res.ok) {
        const data = await res.json();
        setUnitKerja(JSON.parse(JSON.stringify(data.unitKerja || [])));
        setOriginalData(JSON.parse(JSON.stringify(data.unitKerja || [])));
      }
    } catch (err) {
      setError('Gagal memuat data Master Unit Kerja.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const generateId = (prefix) => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

  const handleAddNew = () => {
    setEditingIndex(unitKerja.length);
    setEditForm({
      id: generateId('bid'),
      name: '',
      type: 'Bidang',
      subUnits: []
    });
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditForm(JSON.parse(JSON.stringify(unitKerja[index])));
  };

  const handleDelete = (index) => {
    if (confirm('Yakin ingin menghapus Unit Kerja ini? Data yang sudah terkait dengan Unit Kerja ini mungkin akan kehilangan referensinya.')) {
      const newData = [...unitKerja];
      newData.splice(index, 1);
      setUnitKerja(newData);
    }
  };

  const handleSaveEdit = () => {
    if (!editForm.name.trim()) {
      alert('Nama Unit Kerja wajib diisi');
      return;
    }
    const newData = [...unitKerja];
    if (editingIndex >= unitKerja.length) {
      newData.push(editForm);
    } else {
      newData[editingIndex] = editForm;
    }
    setUnitKerja(newData);
    setEditingIndex(null);
    setEditForm(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  // SubUnit handlers
  const handleAddSubUnit = () => {
    const newSubUnits = [...editForm.subUnits, { id: generateId('sub'), name: '' }];
    setEditForm({ ...editForm, subUnits: newSubUnits });
  };

  const handleSubUnitChange = (subIndex, newName) => {
    const newSubUnits = [...editForm.subUnits];
    newSubUnits[subIndex].name = newName;
    setEditForm({ ...editForm, subUnits: newSubUnits });
  };

  const handleDeleteSubUnit = (subIndex) => {
    const newSubUnits = [...editForm.subUnits];
    newSubUnits.splice(subIndex, 1);
    setEditForm({ ...editForm, subUnits: newSubUnits });
  };

  const calculateNameChanges = () => {
    const changes = [];
    
    // Create maps from original data for quick lookup by ID
    const origMap = {};
    const origSubMap = {};
    
    originalData.forEach(bid => {
      if (bid.id) origMap[bid.id] = bid.name;
      (bid.subUnits || []).forEach(sub => {
        if (sub.id) origSubMap[sub.id] = sub.name;
      });
    });

    // Compare with current data
    unitKerja.forEach(bid => {
      if (bid.id && origMap[bid.id] && origMap[bid.id] !== bid.name) {
        changes.push({ oldName: origMap[bid.id], newName: bid.name, type: 'bidang' });
      }
      (bid.subUnits || []).forEach(sub => {
        if (sub.id && origSubMap[sub.id] && origSubMap[sub.id] !== sub.name) {
          changes.push({ oldName: origSubMap[sub.id], newName: sub.name, type: 'subUnit' });
        }
      });
    });

    return changes;
  };

  const handleSaveToServer = async () => {
    setError('');
    setSuccess('');
    setIsSaving(true);
    
    const nameChanges = calculateNameChanges();
    
    let confirmMsg = 'Yakin ingin menyimpan perubahan Master Unit Kerja?';
    if (nameChanges.length > 0) {
      confirmMsg += `\n\nPerhatian: Sistem mendeteksi ${nameChanges.length} perubahan nama. Sistem akan otomatis memperbarui nama ini di data Pegawai dan Renstra.`;
    }

    if (!confirm(confirmMsg)) {
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetchWithAuth('/api/admin/settings/unit-kerja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitKerja, nameChanges })
      });

      if (res.ok) {
        const result = await res.json();
        setSuccess(`Berhasil disimpan! ${result.dominoUpdates > 0 ? `(${result.dominoUpdates} data terkait otomatis diperbarui)` : ''}`);
        setOriginalData(JSON.parse(JSON.stringify(unitKerja))); // reset original data
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan data.');
      }
    } catch (err) {
      setError('Kesalahan jaringan.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center p-4">Memuat data...</div>;
  }

  return (
    <div className="master-unit-kerja-container">
      {error && <div className="alert alert-danger" style={{marginBottom: '16px'}}>{error}</div>}
      {success && <div className="alert alert-success" style={{marginBottom: '16px'}}>{success}</div>}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p className="text-muted" style={{ margin: 0 }}>
          Daftar ini akan digunakan sebagai rujukan di Manajemen Pegawai dan Penugasan Renstra.
        </p>
        <button className="btn btn-primary" onClick={handleSaveToServer} disabled={isSaving}>
          {isSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead style={{ backgroundColor: '#1e293b' }}>
            <tr>
              <th width="50">No</th>
              <th>Nama Unit Kerja Induk</th>
              <th>Tipe</th>
              <th>Sub-Unit (Bila ada)</th>
              <th width="120">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {unitKerja.length === 0 && editingIndex === null && (
              <tr>
                <td colSpan="5" className="text-center text-muted">Belum ada data Master Unit Kerja.</td>
              </tr>
            )}
            
            {unitKerja.map((item, index) => {
              if (editingIndex === index) {
                return (
                  <tr key={`edit-${index}`} style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                    <td className="text-center">{index + 1}</td>
                    <td>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={editForm.name} 
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                        placeholder="Cth: Bidang Pencegahan dan Kesiapsiagaan"
                      />
                    </td>
                    <td>
                      <select 
                        className="form-control"
                        value={editForm.type}
                        onChange={(e) => setEditForm({...editForm, type: e.target.value})}
                      >
                        <option value="Bidang">Bidang</option>
                        <option value="Sekretariat">Sekretariat</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </td>
                    <td>
                      {editForm.subUnits.map((sub, sIdx) => (
                        <div key={sIdx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input 
                            type="text"
                            className="form-control"
                            value={sub.name}
                            onChange={(e) => handleSubUnitChange(sIdx, e.target.value)}
                            placeholder="Nama Sub-Unit"
                          />
                          <button 
                            className="btn btn-sm btn-outline-danger" 
                            onClick={() => handleDeleteSubUnit(sIdx)}
                            title="Hapus Sub-Unit"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      ))}
                      <button className="btn btn-sm btn-outline-primary mt-1" onClick={handleAddSubUnit}>
                        + Tambah Sub-Unit
                      </button>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-success mr-2" onClick={handleSaveEdit}><i className="fa-solid fa-check"></i></button>
                      <button className="btn btn-sm btn-secondary" onClick={handleCancelEdit}><i className="fa-solid fa-xmark"></i></button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={item.id}>
                  <td className="text-center">{index + 1}</td>
                  <td><strong>{item.name}</strong></td>
                  <td><span className="badge badge-info">{item.type}</span></td>
                  <td>
                    {item.subUnits && item.subUnits.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {item.subUnits.map(s => <li key={s.id}>{s.name}</li>)}
                      </ul>
                    ) : (
                      <em className="text-muted">- Tidak ada -</em>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline-primary mr-2" onClick={() => handleEdit(index)} disabled={editingIndex !== null}>
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(index)} disabled={editingIndex !== null}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Row for adding new */}
            {editingIndex === unitKerja.length && (
              <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <td className="text-center">{unitKerja.length + 1}</td>
                <td>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={editForm.name} 
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    placeholder="Cth: Bidang Pencegahan dan Kesiapsiagaan"
                  />
                </td>
                <td>
                  <select 
                    className="form-control"
                    value={editForm.type}
                    onChange={(e) => setEditForm({...editForm, type: e.target.value})}
                  >
                    <option value="Bidang">Bidang</option>
                    <option value="Sekretariat">Sekretariat</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </td>
                <td>
                  {editForm.subUnits.map((sub, sIdx) => (
                    <div key={sIdx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input 
                        type="text"
                        className="form-control"
                        value={sub.name}
                        onChange={(e) => handleSubUnitChange(sIdx, e.target.value)}
                        placeholder="Nama Sub-Unit"
                      />
                      <button 
                        className="btn btn-sm btn-outline-danger" 
                        onClick={() => handleDeleteSubUnit(sIdx)}
                        title="Hapus Sub-Unit"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-sm btn-outline-primary mt-1" onClick={handleAddSubUnit}>
                    + Tambah Sub-Unit
                  </button>
                </td>
                <td>
                  <button className="btn btn-sm btn-success mr-2" onClick={handleSaveEdit}><i className="fa-solid fa-check"></i></button>
                  <button className="btn btn-sm btn-secondary" onClick={handleCancelEdit}><i className="fa-solid fa-xmark"></i></button>
                </td>
              </tr>
            )}

            {editingIndex === null && (
              <tr>
                <td colSpan="5" className="text-center">
                  <button className="btn btn-outline-primary" onClick={handleAddNew}>
                    <i className="fa-solid fa-plus mr-2"></i> Tambah Unit Kerja Baru
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
