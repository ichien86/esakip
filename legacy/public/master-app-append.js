
/* ==========================================================================
   MASTER DATA API (PROGRAM, KEGIATAN, SUBKEGIATAN)
   ========================================================================== */

async function loadAdminMasterData() {
  pageTitle.textContent = "Data Master";
  pageSubtitle.textContent = "Kelola pustaka standar Program, Kegiatan, dan Subkegiatan";

  try {
    const resP = await fetch('/api/master/program');
    masterProgramList = await resP.json();
    
    const resK = await fetch('/api/master/kegiatan');
    masterKegiatanList = await resK.json();
    
    const resS = await fetch('/api/master/subkegiatan');
    masterSubkegiatanList = await resS.json();
    
    renderMasterProgramTable();
    renderMasterKegiatanTable();
    renderMasterSubkegiatanTable();
    
    // Update select dropdowns in Master Form
    const mkProgramId = document.getElementById('mkProgramId');
    if(mkProgramId) {
      mkProgramId.innerHTML = '<option value="">-- Pilih Program --</option>' + masterProgramList.map(p => `<option value="${p.id}">${p.nama}</option>`).join('');
    }
    
    const mskKegiatanId = document.getElementById('mskKegiatanId');
    if(mskKegiatanId) {
      mskKegiatanId.innerHTML = '<option value="">-- Pilih Kegiatan --</option>' + masterKegiatanList.map(k => `<option value="${k.id}">${k.nama}</option>`).join('');
    }
    
  } catch (err) {
    console.error('Error loading master data', err);
  }
}

function renderMasterProgramTable() {
  const tbody = document.querySelector('#tableMasterProgram tbody');
  if(!tbody) return;
  tbody.innerHTML = masterProgramList.map(p => `<tr>
    <td>${p.id}</td>
    <td>${p.nama}</td>
    <td><button class="btn btn-sm btn-danger" onclick="deleteMasterData('program', '${p.id}')">Hapus</button></td>
  </tr>`).join('');
}

function renderMasterKegiatanTable() {
  const tbody = document.querySelector('#tableMasterKegiatan tbody');
  if(!tbody) return;
  tbody.innerHTML = masterKegiatanList.map(k => {
    const prog = masterProgramList.find(p => p.id === k.programId);
    return `<tr>
      <td>${prog ? prog.nama : '-'}</td>
      <td>${k.nama}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteMasterData('kegiatan', '${k.id}')">Hapus</button></td>
    </tr>`;
  }).join('');
}

function renderMasterSubkegiatanTable() {
  const tbody = document.querySelector('#tableMasterSubkegiatan tbody');
  if(!tbody) return;
  tbody.innerHTML = masterSubkegiatanList.map(s => {
    const keg = masterKegiatanList.find(k => k.id === s.kegiatanId);
    return `<tr>
      <td>${keg ? keg.nama : '-'}</td>
      <td>${s.nama}</td>
      <td>${s.indikator}</td>
      <td>${s.satuan}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteMasterData('subkegiatan', '${s.id}')">Hapus</button></td>
    </tr>`;
  }).join('');
}

window.deleteMasterData = async function(type, id) {
  if(!confirm('Yakin ingin menghapus data master ini?')) return;
  try {
    const res = await fetch(`/api/master/${type}/${id}`, { method: 'DELETE' });
    if(res.ok) {
      loadAdminMasterData();
    } else {
      alert('Gagal menghapus');
    }
  } catch(err) {
    console.error(err);
  }
}

document.getElementById('formMasterProgram')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nama = document.getElementById('mpNama').value;
  await fetch('/api/master/program', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ nama })
  });
  document.getElementById('mpNama').value = '';
  loadAdminMasterData();
});

document.getElementById('formMasterKegiatan')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const programId = document.getElementById('mkProgramId').value;
  const nama = document.getElementById('mkNama').value;
  await fetch('/api/master/kegiatan', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ programId, nama })
  });
  document.getElementById('mkNama').value = '';
  loadAdminMasterData();
});

document.getElementById('formMasterSubkegiatan')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const kegiatanId = document.getElementById('mskKegiatanId').value;
  const nama = document.getElementById('mskNama').value;
  const indikator = document.getElementById('mskIndikator').value;
  const satuan = document.getElementById('mskSatuan').value;
  await fetch('/api/master/subkegiatan', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ kegiatanId, nama, indikator, satuan })
  });
  document.getElementById('mskNama').value = '';
  document.getElementById('mskIndikator').value = '';
  document.getElementById('mskSatuan').value = '';
  loadAdminMasterData();
});
