const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read DB with safe fallbacks
function readDB() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.employees) parsed.employees = [];
    if (!parsed.performances) parsed.performances = [];
    if (!parsed.cascading) parsed.cascading = [];
    if (!parsed.selections) parsed.selections = [];
    if (!parsed.renaksi) parsed.renaksi = [];
    if (!parsed.cascading5Years) parsed.cascading5Years = [];
    if (!parsed.masterProgram) parsed.masterProgram = [];
    if (!parsed.masterKegiatan) parsed.masterKegiatan = [];
    if (!parsed.masterSubkegiatan) parsed.masterSubkegiatan = [];
    return parsed;
  } catch (err) {
    console.error('Error reading database file:', err);
    return { employees: [], performances: [], cascading: [], selections: [], renaksi: [], cascading5Years: [], masterProgram: [], masterKegiatan: [], masterSubkegiatan: [] };
  }
}

// Helper to write DB
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database file:', err);
    return false;
  }
}

/* ==========================================================================
   BASIC EMPLOYEE & STATE API
   ========================================================================== */
app.get('/api/employees', (req, res) => {
  const db = readDB();
  res.json(db.employees);
});

// Admin API: Add new employee (with Bidang Admin checks)
app.post('/api/admin/employees', (req, res) => {
  const { nama, nip, jabatan, role, parentId, bidang, requesterRole, requesterBidang } = req.body;
  if (!nama || !nip || !jabatan || !role || !bidang) {
    return res.status(400).json({ error: 'Field nama, nip, jabatan, role, dan bidang wajib diisi' });
  }

  // Bidang Admin restriction
  if (requesterRole === 'admin_bidang' && bidang !== requesterBidang) {
    return res.status(403).json({ error: 'Anda hanya diperbolehkan mengelola pegawai di bidang Anda sendiri (' + requesterBidang + ')' });
  }

  const db = readDB();
  const newEmp = {
    id: 'emp_' + Date.now(),
    nama,
    nip,
    jabatan,
    role,
    parentId: parentId || null,
    bidang
  };

  db.employees.push(newEmp);
  if (writeDB(db)) {
    res.json({ message: 'Pegawai berhasil ditambahkan', employee: newEmp });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});

// Admin API: Edit employee
app.put('/api/admin/employees/:id', (req, res) => {
  const { id } = req.params;
  const { nama, nip, jabatan, role, parentId, bidang, requesterRole, requesterBidang } = req.body;
  
  // Bidang Admin restriction
  if (requesterRole === 'admin_bidang' && bidang !== requesterBidang) {
    return res.status(403).json({ error: 'Anda hanya diperbolehkan mengelola pegawai di bidang Anda sendiri (' + requesterBidang + ')' });
  }

  const db = readDB();
  const idx = db.employees.findIndex(emp => emp.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Pegawai tidak ditemukan' });
  }

  // Double check if Bidang Admin tries to edit someone outside their department
  if (requesterRole === 'admin_bidang' && db.employees[idx].bidang !== requesterBidang) {
    return res.status(403).json({ error: 'Anda tidak memiliki hak akses mengubah pegawai di luar bidang Anda.' });
  }

  db.employees[idx] = {
    ...db.employees[idx],
    nama,
    nip,
    jabatan,
    role,
    parentId: parentId || null,
    bidang
  };

  if (writeDB(db)) {
    res.json({ message: 'Data pegawai berhasil diubah', employee: db.employees[idx] });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});

// Admin API: Delete employee
app.delete('/api/admin/employees/:id', (req, res) => {
  const { id } = req.params;
  const { requesterRole, requesterBidang } = req.body; // Can be passed via body or headers
  const db = readDB();
  const idx = db.employees.findIndex(emp => emp.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Pegawai tidak ditemukan' });
  }

  // Bidang Admin restriction
  if (requesterRole === 'admin_bidang' && db.employees[idx].bidang !== requesterBidang) {
    return res.status(403).json({ error: 'Anda tidak memiliki hak akses menghapus pegawai di luar bidang Anda.' });
  }

  db.employees.splice(idx, 1);
  if (writeDB(db)) {
    res.json({ message: 'Pegawai berhasil dihapus' });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});


/* ==========================================================================
   CASCADING KINERJA API
   ========================================================================== */
app.get('/api/cascading', (req, res) => {
  const db = readDB();
  res.json(db.cascading);
});

app.post('/api/cascading', (req, res) => {
  const { id, level, text, indikator, target, satuan, tipeTarget, parentId, bidangPengampu, requesterRole, requesterBidang } = req.body;
  if (!level || !text || !indikator || !target || !satuan || !bidangPengampu || !tipeTarget) {
    return res.status(400).json({ error: 'Data cascading tidak lengkap' });
  }

  // Admin Bidang restriction
  if (requesterRole === 'admin_bidang') {
    // Admin Bidang can only add Program/Kegiatan/Subkeg/Akt, not Tujuan/Sasaran (macro levels)
    if (level === 'tujuan' || level === 'sasaran') {
      return res.status(403).json({ error: 'Hanya Administrator Sistem yang dapat mengubah Tujuan & Sasaran Makro.' });
    }
    // Admin Bidang can only assign/create nodes for their own Bidang
    if (bidangPengampu !== requesterBidang) {
      return res.status(403).json({ error: 'Anda hanya dapat mengelola cascading pengampuan bidang Anda (' + requesterBidang + ')' });
    }
  }

  const db = readDB();
  const newItem = {
    id: id || `${level.substring(0, 3)}_${Date.now()}`,
    level,
    text,
    indikator,
    target,
    satuan,
    tipeTarget,
    parentId: parentId || null,
    bidangPengampu
  };

  const existingIdx = db.cascading.findIndex(c => c.id === newItem.id);
  if (existingIdx !== -1) {
    db.cascading[existingIdx] = newItem;
  } else {
    db.cascading.push(newItem);
  }

  if (writeDB(db)) {
    res.json({ message: 'Cascading berhasil disimpan', data: newItem });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});

app.delete('/api/cascading/:id', (req, res) => {
  const { id } = req.params;
  const { requesterRole, requesterBidang } = req.body;
  const db = readDB();
  
  const nodeIdx = db.cascading.findIndex(c => c.id === id);
  if (nodeIdx === -1) return res.status(404).json({ error: 'Node tidak ditemukan' });

  // Admin Bidang restriction
  if (requesterRole === 'admin_bidang') {
    const node = db.cascading[nodeIdx];
    if (node.level === 'tujuan' || node.level === 'sasaran') {
      return res.status(403).json({ error: 'Admin Bidang tidak diijinkan menghapus Tujuan / Sasaran Makro.' });
    }
    if (node.bidangPengampu !== requesterBidang) {
      return res.status(403).json({ error: 'Anda tidak diijinkan menghapus node di luar pengampuan bidang Anda.' });
    }
  }

  // Delete node and recursively all its descendants
  let idsToDelete = [id];
  let checkList = [id];

  while (checkList.length > 0) {
    const parent = checkList.pop();
    const children = db.cascading.filter(c => c.parentId === parent);
    children.forEach(child => {
      idsToDelete.push(child.id);
      checkList.push(child.id);
    });
  }

  db.cascading = db.cascading.filter(c => !idsToDelete.includes(c.id));

  if (writeDB(db)) {
    res.json({ message: 'Berhasil menghapus item cascading beserta turunannya' });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});


/* ==========================================================================
   CASCADING 5 TAHUNAN API
   ========================================================================== */
app.get('/api/cascading5years', (req, res) => {
  const db = readDB();
  res.json(db.cascading5Years);
});

app.post('/api/cascading5years', (req, res) => {
  const { id, level, text, indikator, satuan, tipeTarget, parentId, bidangPengampu,
          target2025, target2026, target2027, target2028, target2029, target2030, targetAkhir,
          requesterRole, requesterBidang } = req.body;
  if (!level || !text || !indikator || !satuan || !bidangPengampu || !tipeTarget || !targetAkhir) {
    return res.status(400).json({ error: 'Data cascading 5 tahunan tidak lengkap' });
  }

  if (requesterRole === 'admin_bidang') {
    if (level === 'tujuan') {
      return res.status(403).json({ error: 'Hanya Administrator Sistem yang dapat mengelola Tujuan Strategis.' });
    }
    if (bidangPengampu !== requesterBidang) {
      return res.status(403).json({ error: 'Anda hanya dapat mengelola cascading pengampuan bidang Anda (' + requesterBidang + ')' });
    }
  }

  const db = readDB();
  const newItem = {
    id: id || `5y_${level.substring(0, 3)}_${Date.now()}`,
    level, text, indikator, satuan, tipeTarget,
    parentId: parentId || null,
    bidangPengampu,
    target2025: target2025 || '0',
    target2026: target2026 || '0',
    target2027: target2027 || '0',
    target2028: target2028 || '0',
    target2029: target2029 || '0',
    target2030: target2030 || '0',
    targetAkhir
  };

  const existingIdx = db.cascading5Years.findIndex(c => c.id === newItem.id);
  if (existingIdx !== -1) {
    db.cascading5Years[existingIdx] = newItem;
  } else {
    db.cascading5Years.push(newItem);
  }

  if (writeDB(db)) {
    res.json({ message: 'Cascading 5 Tahunan berhasil disimpan', data: newItem });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});

app.delete('/api/cascading5years/:id', (req, res) => {
  const { id } = req.params;
  const { requesterRole, requesterBidang } = req.body;
  const db = readDB();

  const nodeIdx = db.cascading5Years.findIndex(c => c.id === id);
  if (nodeIdx === -1) return res.status(404).json({ error: 'Node tidak ditemukan' });

  if (requesterRole === 'admin_bidang') {
    const node = db.cascading5Years[nodeIdx];
    if (node.level === 'tujuan') {
      return res.status(403).json({ error: 'Admin Bidang tidak diijinkan menghapus Tujuan Strategis.' });
    }
    if (node.bidangPengampu !== requesterBidang) {
      return res.status(403).json({ error: 'Anda tidak diijinkan menghapus node di luar pengampuan bidang Anda.' });
    }
  }

  let idsToDelete = [id];
  let checkList = [id];
  while (checkList.length > 0) {
    const parent = checkList.pop();
    const children = db.cascading5Years.filter(c => c.parentId === parent);
    children.forEach(child => {
      idsToDelete.push(child.id);
      checkList.push(child.id);
    });
  }

  db.cascading5Years = db.cascading5Years.filter(c => !idsToDelete.includes(c.id));

  if (writeDB(db)) {
    res.json({ message: 'Berhasil menghapus item cascading 5 tahunan beserta turunannya' });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});


/* ==========================================================================
   MONITORING PROGRES 5 TAHUNAN API
   ========================================================================== */
app.get('/api/monitoring/5years', (req, res) => {
  const db = readDB();
  const items = db.cascading5Years;

  const monitoringData = items.map(item => {
    const targetAkhir = parseFloat(item.targetAkhir) || 0;
    let totalRealisasi = 0;
    const yearlyData = {};

    for (let year = 2025; year <= 2030; year++) {
      const yearTarget = parseFloat(item[`target${year}`]) || 0;
      const matchingAnnualNodes = db.cascading.filter(c =>
        c.indikator === item.indikator && c.bidangPengampu === item.bidangPengampu
      );
      const matchingIds = matchingAnnualNodes.map(n => n.id);

      const yearRenaksi = db.renaksi.filter(r =>
        r.tahun === year && matchingIds.includes(r.indicatorId) && r.realisasiBulanan !== null
      );

      let yearRealisasi = 0;
      if (item.tipeTarget === 'Akumulatif') {
        yearRealisasi = yearRenaksi.reduce((sum, r) => sum + (parseFloat(r.realisasiBulanan) || 0), 0);
      } else {
        const sorted = yearRenaksi.sort((a, b) => b.bulan - a.bulan);
        yearRealisasi = sorted.length > 0 ? (parseFloat(sorted[0].realisasiBulanan) || 0) : 0;
      }

      totalRealisasi += yearRealisasi;
      yearlyData[year] = { target: yearTarget, realisasi: yearRealisasi };
    }

    let progres = 0;
    if (targetAkhir > 0) {
      if (item.tipeTarget === 'Kondisi Akhir Menurun') {
        // Semakin rendah realisasi, semakin bagus. Anggap progres = (targetAkhir / totalRealisasi) * 100
        // Jika realisasi <= targetAkhir, progres 100%
        if (totalRealisasi === 0) progres = 0;
        else if (totalRealisasi <= targetAkhir) progres = 100;
        else progres = Math.min(100, (targetAkhir / totalRealisasi) * 100);
      } else {
        progres = Math.min(100, (totalRealisasi / targetAkhir) * 100);
      }
    }

    return {
      ...item,
      totalRealisasi: Math.round(totalRealisasi * 100) / 100,
      progres: Math.round(progres * 100) / 100,
      yearlyData
    };
  });

  res.json(monitoringData);
});


/* ==========================================================================
   MASTER DATA API (PROGRAM, KEGIATAN, SUBKEGIATAN)
   ========================================================================== */
app.get('/api/master/program', (req, res) => res.json(readDB().masterProgram));
app.post('/api/master/program', (req, res) => {
  const db = readDB();
  const newItem = { id: req.body.id || `mp_${Date.now()}`, nama: req.body.nama };
  const idx = db.masterProgram.findIndex(i => i.id === newItem.id);
  if (idx > -1) db.masterProgram[idx] = newItem; else db.masterProgram.push(newItem);
  writeDB(db) ? res.json(newItem) : res.status(500).json({error: 'Failed to write DB'});
});
app.delete('/api/master/program/:id', (req, res) => {
  const db = readDB();
  db.masterProgram = db.masterProgram.filter(i => i.id !== req.params.id);
  writeDB(db) ? res.json({message: 'Deleted'}) : res.status(500).json({error: 'Failed'});
});

app.get('/api/master/kegiatan', (req, res) => res.json(readDB().masterKegiatan));
app.post('/api/master/kegiatan', (req, res) => {
  const db = readDB();
  const newItem = { id: req.body.id || `mk_${Date.now()}`, programId: req.body.programId, nama: req.body.nama };
  const idx = db.masterKegiatan.findIndex(i => i.id === newItem.id);
  if (idx > -1) db.masterKegiatan[idx] = newItem; else db.masterKegiatan.push(newItem);
  writeDB(db) ? res.json(newItem) : res.status(500).json({error: 'Failed to write DB'});
});
app.delete('/api/master/kegiatan/:id', (req, res) => {
  const db = readDB();
  db.masterKegiatan = db.masterKegiatan.filter(i => i.id !== req.params.id);
  writeDB(db) ? res.json({message: 'Deleted'}) : res.status(500).json({error: 'Failed'});
});

app.get('/api/master/subkegiatan', (req, res) => res.json(readDB().masterSubkegiatan));
app.post('/api/master/subkegiatan', (req, res) => {
  const db = readDB();
  const newItem = { 
    id: req.body.id || `msk_${Date.now()}`, 
    kegiatanId: req.body.kegiatanId, 
    nama: req.body.nama,
    indikator: req.body.indikator,
    satuan: req.body.satuan
  };
  const idx = db.masterSubkegiatan.findIndex(i => i.id === newItem.id);
  if (idx > -1) db.masterSubkegiatan[idx] = newItem; else db.masterSubkegiatan.push(newItem);
  writeDB(db) ? res.json(newItem) : res.status(500).json({error: 'Failed to write DB'});
});
app.delete('/api/master/subkegiatan/:id', (req, res) => {
  const db = readDB();
  db.masterSubkegiatan = db.masterSubkegiatan.filter(i => i.id !== req.params.id);
  writeDB(db) ? res.json({message: 'Deleted'}) : res.status(500).json({error: 'Failed'});
});


/* ==========================================================================
   RENJA TAHUNAN API
   ========================================================================== */
app.get('/api/renja/:tahun', (req, res) => {
  const { tahun } = req.params;
  const db = readDB();
  const annualData = db.cascading.map(node => {
    const fiveYearMatch = db.cascading5Years.find(c5 =>
      c5.indikator === node.indikator && c5.bidangPengampu === node.bidangPengampu
    );
    return {
      ...node,
      target5Tahun: fiveYearMatch ? fiveYearMatch[`target${tahun}`] : null,
      targetAkhir5Tahun: fiveYearMatch ? fiveYearMatch.targetAkhir : null
    };
  });
  res.json(annualData);
});


/* ==========================================================================
   EMPLOYEE SELECTIONS API
   ========================================================================== */
app.get('/api/selections/:employeeId', (req, res) => {
  const { employeeId } = req.params;
  const db = readDB();
  const selection = db.selections.find(s => s.employeeId === employeeId && s.tahun === 2026);
  res.json(selection || { employeeId, tahun: 2026, selectedIndicators: [] });
});

app.post('/api/selections', (req, res) => {
  const { employeeId, selectedIndicators } = req.body;
  if (!employeeId || !Array.isArray(selectedIndicators)) {
    return res.status(400).json({ error: 'Format data pemilihan tidak sesuai' });
  }

  const db = readDB();
  const idx = db.selections.findIndex(s => s.employeeId === employeeId && s.tahun === 2026);
  const updatedSelection = {
    employeeId,
    tahun: 2026,
    selectedIndicators
  };

  if (idx !== -1) {
    db.selections[idx] = updatedSelection;
  } else {
    db.selections.push(updatedSelection);
  }

  if (writeDB(db)) {
    res.json({ message: 'Indikator berhasil dipilih', data: updatedSelection });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});


/* ==========================================================================
   RENKSI & REALISASI BULANAN API
   ========================================================================== */
app.get('/api/renaksi/:employeeId/:tahun', (req, res) => {
  const { employeeId, tahun } = req.params;
  const db = readDB();
  const userRenaksi = db.renaksi.filter(
    r => r.employeeId === employeeId && r.tahun === parseInt(tahun)
  );
  res.json(userRenaksi);
});

// API: Batch Save target bulanan with spreadsheet validation
app.post('/api/renaksi/target/batch', (req, res) => {
  const { employeeId, targets } = req.body; // targets: [{ indicatorId, bulan, targetBulanan }]
  if (!employeeId || !Array.isArray(targets)) {
    return res.status(400).json({ error: 'Data target wajib dikirim' });
  }

  const db = readDB();

  // Validate Accumulative target constraints
  // For each unique indicator in targets, group and sum monthly targets
  const indicatorsToVerify = [...new Set(targets.map(t => t.indicatorId))];
  
  for (let indicatorId of indicatorsToVerify) {
    const node = db.cascading.find(c => c.id === indicatorId);
    if (node && node.tipeTarget === 'Akumulatif') {
      const annualTarget = parseFloat(node.target);
      const indicatorTargets = targets.filter(t => t.indicatorId === indicatorId);
      
      // Calculate sum of targets
      const monthlySum = indicatorTargets.reduce((sum, item) => sum + (parseFloat(item.targetBulanan) || 0), 0);
      
      // Allow slight floating point tolerance (e.g. 0.01)
      if (Math.abs(monthlySum - annualTarget) > 0.05) {
        return res.status(400).json({
          error: `Validasi gagal untuk indikator "${node.indikator}". Tipe target adalah Akumulatif, sehingga jumlah target bulanan (Jan-Des) harus berjumlah persis ${annualTarget} ${node.satuan} (Input saat ini: ${monthlySum}).`
        });
      }
    }
  }

  // Save targets
  targets.forEach(item => {
    const recordId = `rx_${employeeId}_${item.indicatorId}_${item.bulan}`;
    let idx = db.renaksi.findIndex(r => r.id === recordId);
    const targetVal = parseFloat(item.targetBulanan) || 0;

    const updatedRecord = {
      id: recordId,
      employeeId,
      tahun: 2026,
      indicatorId: item.indicatorId,
      bulan: parseInt(item.bulan),
      targetBulanan: targetVal,
      realisasiBulanan: idx !== -1 ? db.renaksi[idx].realisasiBulanan : null,
      tanggalRealisasi: idx !== -1 ? db.renaksi[idx].tanggalRealisasi : null,
      buktiDukung: idx !== -1 ? db.renaksi[idx].buktiDukung : '',
      kendala: idx !== -1 ? db.renaksi[idx].kendala : '',
      solusi: idx !== -1 ? db.renaksi[idx].solusi : '',
      faktorPendorong: idx !== -1 ? db.renaksi[idx].faktorPendorong : '',
      inovasi: idx !== -1 ? db.renaksi[idx].inovasi : '',
      status: idx !== -1 ? db.renaksi[idx].status : 'Draft'
    };

    if (idx !== -1) {
      db.renaksi[idx] = updatedRecord;
    } else {
      db.renaksi.push(updatedRecord);
    }
  });

  if (writeDB(db)) {
    res.json({ message: 'Target bulanan spreadsheet berhasil disimpan' });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});

// API: Save monthly realization with conditional verification
app.post('/api/renaksi/realisasi', (req, res) => {
  const { employeeId, indicatorId, bulan, realisasiBulanan, buktiDukung, kendala, solusi, faktorPendorong, inovasi, status } = req.body;
  if (!employeeId || !indicatorId || !bulan || realisasiBulanan === undefined) {
    return res.status(400).json({ error: 'Data realisasi tidak lengkap' });
  }

  const db = readDB();
  const recordId = `rx_${employeeId}_${indicatorId}_${bulan}`;
  let idx = db.renaksi.findIndex(r => r.id === recordId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Target bulanan belum diset' });
  }

  const target = db.renaksi[idx].targetBulanan;
  const realisasi = parseFloat(realisasiBulanan);

  // Conditional validations based on target vs realization
  if (realisasi < target) {
    if (!kendala || !solusi) {
      return res.status(400).json({ error: 'Realisasi di bawah target wajib mengisi Kendala dan Solusi.' });
    }
  } else {
    if (!faktorPendorong || !inovasi) {
      return res.status(400).json({ error: 'Realisasi memenuhi/melebihi target wajib mengisi Faktor Pendorong dan Inovasi.' });
    }
  }

  db.renaksi[idx].realisasiBulanan = realisasi;
  db.renaksi[idx].buktiDukung = buktiDukung || '';
  db.renaksi[idx].status = status || 'Diajukan';

  if (realisasi < target) {
    db.renaksi[idx].kendala = kendala;
    db.renaksi[idx].solusi = solusi;
    db.renaksi[idx].faktorPendorong = '';
    db.renaksi[idx].inovasi = '';
  } else {
    db.renaksi[idx].kendala = '';
    db.renaksi[idx].solusi = '';
    db.renaksi[idx].faktorPendorong = faktorPendorong;
    db.renaksi[idx].inovasi = inovasi;
  }

  if (status === 'Diajukan' || status === 'Disetujui') {
    db.renaksi[idx].tanggalRealisasi = new Date().toISOString();
  }

  if (writeDB(db)) {
    res.json({ message: 'Realisasi bulanan berhasil disimpan', data: db.renaksi[idx] });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});

// API: Approve subordinate monthly realization
app.post('/api/renaksi/approve', (req, res) => {
  const { id } = req.body;
  const db = readDB();
  const idx = db.renaksi.findIndex(r => r.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Data renaksi tidak ditemukan' });
  }

  db.renaksi[idx].status = 'Disetujui';
  if (writeDB(db)) {
    res.json({ message: 'Realisasi disetujui', data: db.renaksi[idx] });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});


/* ==========================================================================
   REWARDS & LEADERBOARD API
   ========================================================================== */
app.get('/api/rewards/leaderboard', (req, res) => {
  const db = readDB();
  const participants = db.employees.filter(e => e.id !== 'admin');
  
  const leaderboard = participants.map(emp => {
    const records = db.renaksi.filter(
      r => r.employeeId === emp.id && r.realisasiBulanan !== null && (r.status === 'Diajukan' || r.status === 'Disetujui')
    );

    let averageCapaian = 0;
    let latestSubmissionTime = 0;

    if (records.length > 0) {
      let totalCapaian = 0;
      records.forEach(r => {
        const node = db.cascading.find(c => c.id === r.indicatorId);
        let percent = 0;

        if (r.targetBulanan > 0) {
          if (node && node.tipeTarget === 'Kondisi Akhir Menurun') {
            if (r.realisasiBulanan <= r.targetBulanan && r.realisasiBulanan > 0) {
              percent = 100;
            } else if (r.realisasiBulanan > r.targetBulanan) {
              percent = (r.targetBulanan / r.realisasiBulanan) * 100;
            } else {
              percent = 0;
            }
          } else {
            percent = (r.realisasiBulanan / r.targetBulanan) * 100;
          }
        } else if (r.realisasiBulanan > 0) {
          percent = 100;
        } else {
          percent = 100;
        }

        totalCapaian += Math.min(150, percent);
      });
      averageCapaian = totalCapaian / records.length;

      const times = records.map(r => r.tanggalRealisasi ? new Date(r.tanggalRealisasi).getTime() : 0);
      latestSubmissionTime = Math.max(...times);
    }

    return {
      id: emp.id,
      nama: emp.nama,
      jabatan: emp.jabatan,
      bidang: emp.bidang,
      averageCapaian: parseFloat(averageCapaian.toFixed(2)),
      latestSubmissionTime: latestSubmissionTime || Infinity,
      totalBulanMengisi: records.length
    };
  });

  leaderboard.sort((a, b) => {
    if (b.averageCapaian !== a.averageCapaian) {
      return b.averageCapaian - a.averageCapaian;
    }
    return a.latestSubmissionTime - b.latestSubmissionTime;
  });

  res.json(leaderboard);
});


/* ==========================================================================
   LEGACY AKIP COMPATIBILITY API
   ========================================================================== */
app.get('/api/performance/:employeeId/:tahun', (req, res) => {
  const { employeeId, tahun } = req.params;
  const db = readDB();
  const perf = db.performances.find(
    p => p.employeeId === employeeId && p.tahun === parseInt(tahun)
  );
  
  if (perf) {
    res.json(perf);
  } else {
    res.json({
      id: `perf_${employeeId}_${tahun}`,
      employeeId,
      tahun: parseInt(tahun),
      status: 'Draft',
      targetIKU: [],
      evaluasiAtasan: null
    });
  }
});

app.post('/api/performance', (req, res) => {
  const { employeeId, tahun, targetIKU, status } = req.body;
  const db = readDB();
  let index = db.performances.findIndex(
    p => p.employeeId === employeeId && p.tahun === parseInt(tahun)
  );

  const updatedRecord = {
    id: `perf_${employeeId}_${tahun}`,
    employeeId,
    tahun: parseInt(tahun),
    status: status || 'Draft',
    targetIKU: targetIKU || [],
    evaluasiAtasan: index !== -1 ? db.performances[index].evaluasiAtasan : null
  };

  if (index !== -1) {
    db.performances[index] = updatedRecord;
  } else {
    db.performances.push(updatedRecord);
  }

  if (writeDB(db)) {
    res.json({ message: 'Kinerja berhasil disimpan', data: updatedRecord });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});

app.post('/api/performance/evaluate', (req, res) => {
  const { employeeId, tahun, evaluatorId, skorAKIP, catatan } = req.body;
  const db = readDB();
  let index = db.performances.findIndex(
    p => p.employeeId === employeeId && p.tahun === parseInt(tahun)
  );

  if (index === -1) {
    return res.status(404).json({ error: 'Data capaian kinerja pegawai belum ditemukan' });
  }

  let predikat = 'D';
  const score = parseFloat(skorAKIP);
  if (score >= 90) predikat = 'AA';
  else if (score >= 80) predikat = 'A';
  else if (score >= 70) predikat = 'BB';
  else if (score >= 60) predikat = 'B';
  else if (score >= 50) predikat = 'CC';
  else if (score >= 30) predikat = 'C';

  db.performances[index].status = 'Selesai';
  db.performances[index].evaluasiAtasan = {
    evaluatorId,
    skorAKIP: score,
    predikat,
    catatan: catatan || '',
    tanggalEvaluasi: new Date().toISOString().split('T')[0]
  };

  if (writeDB(db)) {
    res.json({ message: 'Evaluasi berhasil disimpan', data: db.performances[index] });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database' });
  }
});

app.get('/api/dashboard/summary', (req, res) => {
  const db = readDB();
  const year = 2026;
  
  const summary = db.employees.map(emp => {
    const perf = db.performances.find(p => p.employeeId === emp.id && p.tahun === year);
    return {
      id: emp.id,
      nama: emp.nama,
      jabatan: emp.jabatan,
      role: emp.role,
      parentId: emp.parentId,
      status: perf ? perf.status : 'Belum Mengisi',
      skorAKIP: perf && perf.evaluasiAtasan ? perf.evaluasiAtasan.skorAKIP : null,
      predikat: perf && perf.evaluasiAtasan ? perf.evaluasiAtasan.predikat : null
    };
  });

  res.json(summary);
});

/* ==========================================================================
   LINK VERIFICATION API
   ========================================================================== */
const https = require('https');

function checkPublicLink(userUrl) {
  return new Promise((resolve) => {
    if (!userUrl.startsWith('http://') && !userUrl.startsWith('https://')) {
      resolve({ isDrive: false, isPublic: false, message: 'Tautan tidak valid (harus dimulai dengan http:// atau https://)' });
      return;
    }

    if (!userUrl.includes('drive.google.com') && !userUrl.includes('docs.google.com')) {
      resolve({ isDrive: false, isPublic: true, message: 'Bukan link Google Drive (tautan luar).' });
      return;
    }

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    https.get(userUrl, options, (res) => {
      const { statusCode } = res;
      const location = res.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        if (location.includes('accounts.google.com') || location.includes('ServiceLogin')) {
          resolve({ isDrive: true, isPublic: false, message: 'Link bersifat Privat (Butuh Akses / Login).' });
          return;
        }
        checkPublicLink(location).then(resolve);
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
        if (data.includes('ServiceLogin') || data.includes('signIn') || data.includes('accounts.google.com')) {
          res.destroy();
          resolve({ isDrive: true, isPublic: false, message: 'Link bersifat Privat (Butuh Akses / Login).' });
        }
      });

      res.on('end', () => {
        if (data.includes('ServiceLogin') || data.includes('signIn') || data.includes('accounts.google.com')) {
          resolve({ isDrive: true, isPublic: false, message: 'Link bersifat Privat (Butuh Akses / Login).' });
        } else {
          resolve({ isDrive: true, isPublic: true, message: 'Link Publik (Siap diverifikasi).' });
        }
      });
    }).on('error', (err) => {
      resolve({ isDrive: false, isPublic: false, message: 'Tautan tidak dapat dihubungi: ' + err.message });
    });
  });
}

app.post('/api/verify-link', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL wajib dikirimkan' });
  }
  const result = await checkPublicLink(url);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
