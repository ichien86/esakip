// State Management
let employees = [];
let currentUser = null;
let cascadingList = [];
let cascading5YearsList = [];
let employeeSelections = [];
let currentRenaksiList = [];
let selectedSubordinate = null;

// Master Data State
let masterProgramList = [];
let masterKegiatanList = [];
let masterSubkegiatanList = [];

// DOM Elements
const userSelect = document.getElementById('userSelect');
const currentUserBadge = document.getElementById('currentUserBadge');
const profileName = document.getElementById('profileName');
const profileNip = document.getElementById('profileNip');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');

// Init application
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  await loadEmployees();
  setupEventListeners();
});

// Setup sidebar navigation switching
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-target');
      
      // Update active nav class
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Update visible section
      document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
      });
      document.getElementById(target).classList.add('active');
      
      // Section-specific triggers
      switch(target) {
        case 'dashboard':
          loadDashboard();
          break;
        case 'admin-employees':
          loadAdminEmployees();
          break;
        case 'admin-cascading-5years':
          loadAdminCascading5Years();
          break;
        case 'admin-master-data':
          loadAdminMasterData();
          break;
        case 'admin-cascading':
          loadAdminCascading();
          break;
        case 'admin-monitoring-5years':
          loadMonitoring5Years();
          break;
        case 'employee-select-indicators':
          loadEmployeeSelections();
          break;
        case 'employee-renaksi':
          loadEmployeeRenaksi();
          break;
        case 'employee-realisasi':
          loadEmployeeRealisasi();
          break;
        case 'subordinate-eval':
          loadSubordinatesView();
          break;
        case 'organogram':
          renderOrganogram();
          break;
        case 'reports':
          setupReportView();
          break;
        case 'leaderboard':
          loadLeaderboard();
          break;
      }
    });
  });
}

// Fetch all employees from API
async function loadEmployees() {
  try {
    const res = await fetch('/api/employees');
    employees = await res.json();
    
    // Populate user simulator dropdown
    userSelect.innerHTML = '';
    employees.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.id;
      option.textContent = `${emp.nama} (${emp.jabatan})`;
      userSelect.appendChild(option);
    });

    // Default to the first employee
    if (employees.length > 0) {
      userSelect.value = employees[0].id;
      await handleUserSwitch(employees[0].id);
    }
  } catch (err) {
    console.error('Gagal mengambil data pegawai:', err);
  }
}

// Handle switching simulation employee
async function handleUserSwitch(id) {
  currentUser = employees.find(emp => emp.id === id);
  if (!currentUser) return;

  // Update Profile UI
  profileName.textContent = currentUser.nama;
  profileNip.textContent = `NIP. ${currentUser.nip}`;
  currentUserBadge.textContent = currentUser.jabatan;

  // Toggle visible navigation items based on Roles
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = (currentUser.role === 'admin') ? 'flex' : 'none';
  });

  const isEmployee = (currentUser.role !== 'admin');
  document.querySelectorAll('.employee-only').forEach(el => {
    el.style.display = isEmployee ? 'flex' : 'none';
  });

  const hasSubordinates = employees.some(emp => emp.parentId === currentUser.id);
  document.querySelectorAll('.superior-only').forEach(el => {
    el.style.display = (hasSubordinates && isEmployee) ? 'flex' : 'none';
  });

  // Default redirect if a user ends up on an illegal section
  const activeSection = document.querySelector('.content-section.active');
  if (activeSection) {
    const secId = activeSection.id;
    if (currentUser.role !== 'admin' && (secId === 'admin-employees' || secId === 'admin-cascading' || secId === 'admin-cascading-5years' || secId === 'admin-monitoring-5years')) {
      document.querySelector('[data-target="dashboard"]').click();
      return;
    }
    if (currentUser.role === 'admin' && (secId === 'employee-select-indicators' || secId === 'employee-renaksi' || secId === 'employee-realisasi' || secId === 'subordinate-eval')) {
      document.querySelector('[data-target="dashboard"]').click();
      return;
    }
  }

  // Refresh current view
  const activeSec = document.querySelector('.content-section.active');
  if (activeSec) {
    activeSec.classList.remove('active');
    setTimeout(() => {
      activeSec.classList.add('active');
      const target = activeSec.id;
      if (target === 'dashboard') loadDashboard();
      else if (target === 'admin-employees') loadAdminEmployees();
      else if (target === 'admin-cascading') loadAdminCascading();
      else if (target === 'admin-cascading-5years') loadCascading5Years();
      else if (target === 'admin-monitoring-5years') loadMonitoring5Years();
      else if (target === 'employee-select-indicators') loadEmployeeSelections();
      else if (target === 'employee-renaksi') loadEmployeeRenaksi();
      else if (target === 'employee-realisasi') loadEmployeeRealisasi();
      else if (target === 'subordinate-eval') loadSubordinatesView();
      else if (target === 'organogram') renderOrganogram();
      else if (target === 'reports') setupReportView();
      else if (target === 'leaderboard') loadLeaderboard();
    }, 50);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  userSelect.addEventListener('change', (e) => {
    handleUserSwitch(e.target.value);
  });

  // Admin: Employee Form
  const employeeForm = document.getElementById('employeeForm');
  if (employeeForm) {
    employeeForm.addEventListener('submit', handleEmployeeFormSubmit);
  }
  const btnResetEmpForm = document.getElementById('btnResetEmpForm');
  if (btnResetEmpForm) {
    btnResetEmpForm.addEventListener('click', resetEmployeeForm);
  }

  // Admin: Cascading Form
  const cascadingForm = document.getElementById('cascadingForm');
  if (cascadingForm) {
    cascadingForm.addEventListener('submit', handleCascadingFormSubmit);
  }

  // Admin: Cascading 5 Years Form
  const cascading5YearsForm = document.getElementById('cascading5YearsForm');
  if (cascading5YearsForm) {
    cascading5YearsForm.addEventListener('submit', handleCascading5YearsFormSubmit);
    
    // Auto calculate Target Akhir
    const tipeTargetSelect = document.getElementById('casc5TipeTarget');
    const yearInputs = ['casc5T2025', 'casc5T2026', 'casc5T2027', 'casc5T2028', 'casc5T2029', 'casc5T2030'];
    const targetAkhirInput = document.getElementById('casc5TargetAkhir');
    
    function calculateTargetAkhir() {
      const tipe = tipeTargetSelect.value;
      if (tipe === 'Akumulatif') {
        let sum = 0;
        yearInputs.forEach(id => {
          sum += parseFloat(document.getElementById(id).value) || 0;
        });
        targetAkhirInput.value = sum;
      } else {
        // Kondisi Akhir Menurun atau Kondisi Akhir Naik
        targetAkhirInput.value = document.getElementById('casc5T2030').value || '0';
      }
    }
    
    tipeTargetSelect.addEventListener('change', calculateTargetAkhir);
    yearInputs.forEach(id => {
      document.getElementById(id).addEventListener('input', calculateTargetAkhir);
    });
  }

  // Pegawai: Indicator Selection
  const selectIndicatorsForm = document.getElementById('selectIndicatorsForm');
  if (selectIndicatorsForm) {
    selectIndicatorsForm.addEventListener('submit', handleIndicatorSelectionSubmit);
  }

  // Pegawai: Renaksi Selector & Targets
  const renaksiIndicatorSelect = document.getElementById('renaksiIndicatorSelect');
  if (renaksiIndicatorSelect) {
    renaksiIndicatorSelect.addEventListener('change', loadRenaksiMonthlyInputs);
  }
  const btnSaveSpreadsheet = document.getElementById('btnSaveSpreadsheetTargets');
  if (btnSaveSpreadsheet) {
    btnSaveSpreadsheet.addEventListener('click', saveSpreadsheetTargets);
  }

  // Pegawai: Realisasi Selector & Inputs
  const realisasiIndicatorSelect = document.getElementById('realisasiIndicatorSelect');
  const realisasiBulanSelect = document.getElementById('realisasiBulanSelect');
  if (realisasiIndicatorSelect && realisasiBulanSelect) {
    realisasiIndicatorSelect.addEventListener('change', loadRealisasiForm);
    realisasiBulanSelect.addEventListener('change', loadRealisasiForm);
  }
  const realisasiForm = document.getElementById('realisasiForm');
  if (realisasiForm) {
    realisasiForm.addEventListener('submit', handleRealisasiSubmit);
  }

  // Realisasi Link Check
  const inputRealBukti = document.getElementById('inputRealBukti');
  if (inputRealBukti) {
    inputRealBukti.addEventListener('blur', () => verifyRealizationLink(inputRealBukti));
  }

  // Realisasi Value comparison
  const inputRealValue = document.getElementById('inputRealValue');
  if (inputRealValue) {
    inputRealValue.addEventListener('input', toggleConditionalRealizationFields);
  }

  // Reports
  document.getElementById('reportPegawaiSelect').addEventListener('change', (e) => {
    renderPrintReport(e.target.value);
  });
  document.getElementById('btnPrintReport').addEventListener('click', () => {
    window.print();
  });
}

/* ==========================================================================
   DASHBOARD SECTION
   ========================================================================== */
async function loadDashboard() {
  pageTitle.textContent = "Dashboard Akuntabilitas";
  pageSubtitle.textContent = "Ringkasan evaluasi kinerja internal perangkat daerah";

  try {
    const resSummary = await fetch('/api/dashboard/summary');
    summaryData = await resSummary.json();

    const totalCount = summaryData.length;
    document.getElementById('dashTotalPegawai').textContent = totalCount;

    const evaluatedCount = summaryData.filter(s => s.status === 'Selesai').length;
    document.getElementById('statEvaluated').textContent = `${evaluatedCount} / ${totalCount}`;

    const scoredEmp = summaryData.filter(s => s.skorAKIP !== null);
    const avgScore = scoredEmp.length > 0
      ? (scoredEmp.reduce((sum, item) => sum + item.skorAKIP, 0) / scoredEmp.length).toFixed(1)
      : '0.0';
    document.getElementById('statAverageScore').textContent = avgScore;

    // Render summary table
    const tableBody = document.querySelector('#dashboardSummaryTable tbody');
    tableBody.innerHTML = '';

    summaryData.forEach(item => {
      const atasan = employees.find(e => e.id === item.parentId);
      const atasanNama = atasan ? atasan.nama : '-';
      
      let statusBadgeClass = 'badge-none';
      if (item.status === 'Draft') statusBadgeClass = 'badge-draft';
      if (item.status === 'Diajukan') statusBadgeClass = 'badge-submitted';
      if (item.status === 'Selesai') statusBadgeClass = 'badge-finished';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.nama}</strong></td>
        <td>${item.jabatan}</td>
        <td>${item.role === 'admin' ? 'Sekretariat' : (employees.find(e => e.id === item.id)?.bidang || '-')}</td>
        <td>${atasanNama}</td>
        <td><span class="badge ${statusBadgeClass}">${item.status}</span></td>
        <td><span class="badge badge-score">${item.skorAKIP !== null ? item.skorAKIP : '-'}</span></td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

/* ==========================================================================
   ADMIN: MANAJEMEN PEGAWAI
   ========================================================================== */
async function loadAdminEmployees() {
  pageTitle.textContent = "Manajemen Pegawai";
  pageSubtitle.textContent = "Pengaturan database user pegawai dan relasi jabatan berjenjang";

  resetEmployeeForm();
  
  // Populate parent selectors
  const empParent = document.getElementById('empParent');
  empParent.innerHTML = '<option value="">-- Tidak Ada Atasan --</option>';
  employees.forEach(emp => {
    if (emp.id !== 'admin') {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = `${emp.nama} (${emp.jabatan})`;
      empParent.appendChild(opt);
    }
  });

  // Render Table
  const tbody = document.querySelector('#adminEmpTable tbody');
  tbody.innerHTML = '';

  employees.forEach(emp => {
    if (emp.id === 'admin') return;

    // Sri Mulyani (Admin Bidang) restriction: can only see people in her Bidang
    if (currentUser.role === 'admin_bidang' && emp.bidang !== currentUser.bidang) {
      return;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${emp.nama}</strong><br>
        <span class="text-muted" style="font-size:11px;">NIP. ${emp.nip}</span>
      </td>
      <td>${emp.jabatan}</td>
      <td>${emp.bidang}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-primary btn-edit-emp" data-id="${emp.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-danger btn-delete-emp" data-id="${emp.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    
    tr.querySelector('.btn-edit-emp').addEventListener('click', () => editEmployee(emp));
    tr.querySelector('.btn-delete-emp').addEventListener('click', () => deleteEmployee(emp.id));
    tbody.appendChild(tr);
  });
}

function resetEmployeeForm() {
  document.getElementById('empFormId').value = '';
  document.getElementById('empNama').value = '';
  document.getElementById('empNip').value = '';
  document.getElementById('empJabatan').value = '';
  document.getElementById('empRole').value = 'staff';
  document.getElementById('empBidang').value = currentUser.role === 'admin_bidang' ? currentUser.bidang : 'Sekretariat';
  
  if (currentUser.role === 'admin_bidang') {
    document.getElementById('empBidang').disabled = true;
  } else {
    document.getElementById('empBidang').disabled = false;
  }

  document.getElementById('empParent').value = '';
  document.getElementById('empFormTitle').innerHTML = '<i class="fa-solid fa-user-plus text-orange"></i> Tambah Pegawai';
  document.getElementById('btnSubmitEmp').innerHTML = '<i class="fa-solid fa-circle-check"></i> Simpan Data';
  document.getElementById('btnResetEmpForm').style.display = 'none';
}

function editEmployee(emp) {
  document.getElementById('empFormId').value = emp.id;
  document.getElementById('empNama').value = emp.nama;
  document.getElementById('empNip').value = emp.nip;
  document.getElementById('empJabatan').value = emp.jabatan;
  document.getElementById('empRole').value = emp.role;
  document.getElementById('empBidang').value = emp.bidang;
  document.getElementById('empParent').value = emp.parentId || '';
  document.getElementById('empFormTitle').innerHTML = '<i class="fa-solid fa-user-pen text-orange"></i> Edit Pegawai';
  document.getElementById('btnSubmitEmp').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan';
  document.getElementById('btnResetEmpForm').style.display = 'inline-flex';
  document.getElementById('empNama').focus();
}

async function handleEmployeeFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('empFormId').value;
  const payload = {
    nama: document.getElementById('empNama').value.trim(),
    nip: document.getElementById('empNip').value.trim(),
    jabatan: document.getElementById('empJabatan').value.trim(),
    role: document.getElementById('empRole').value,
    bidang: document.getElementById('empBidang').value,
    parentId: document.getElementById('empParent').value || null,
    requesterRole: currentUser.role,
    requesterBidang: currentUser.bidang
  };

  const url = id ? `/api/admin/employees/${id}` : '/api/admin/employees';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert('Berhasil menyimpan data pegawai!');
      await loadEmployees();
      loadAdminEmployees();
    } else {
      const err = await res.json();
      alert('Gagal: ' + err.error);
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteEmployee(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus pegawai ini?')) return;
  try {
    const res = await fetch(`/api/admin/employees/${id}`, { 
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterRole: currentUser.role, requesterBidang: currentUser.bidang })
    });
    if (res.ok) {
      alert('Pegawai telah terhapus.');
      await loadEmployees();
      loadAdminEmployees();
    }
  } catch (err) {
    console.error(err);
  }
}

/* ==========================================================================
   ADMIN: CASCADING KINERJA
   ========================================================================== */
async function loadAdminCascading() {
  pageTitle.textContent = "Renja Tahunan (Cascading Kinerja)";
  pageSubtitle.textContent = "Penjabaran Rencana Strategis 5 Tahunan ke dalam program operasional tahunan";

  try {
    const res = await fetch('/api/cascading');
    cascadingList = await res.json();

    // Populate Parent Select Dropdown in form
    const cascParent = document.getElementById('cascParent');
    cascParent.innerHTML = '<option value="">-- Berdiri Sendiri (Tujuan Strategis) --</option>';
    
    // Sort cascading nodes by hierarchy order
    const order = { tujuan: 1, sasaran: 2, program: 3, kegiatan: 4, subkegiatan: 5, aktivitas: 6 };
    cascadingList.sort((a, b) => order[a.level] - order[b.level]);

    cascadingList.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `[${item.level.toUpperCase()}] ${item.text.substring(0, 50)}...`;
      cascParent.appendChild(opt);
    });

    // Sri Mulyani (Admin Bidang) level restrict: only Kegiatan down to Aktivitas
    const levelSelect = document.getElementById('cascLevel');
    if (currentUser.role === 'admin_bidang') {
      levelSelect.querySelectorAll('option').forEach(opt => {
        if (opt.value === 'tujuan' || opt.value === 'sasaran') {
          opt.disabled = true;
        } else {
          opt.disabled = false;
        }
      });
      levelSelect.value = 'program';
      document.getElementById('cascBidang').value = currentUser.bidang;
      document.getElementById('cascBidang').disabled = true;
    } else {
      levelSelect.querySelectorAll('option').forEach(opt => opt.disabled = false);
      document.getElementById('cascBidang').disabled = false;
    }

    // Render tree editor
    renderCascadingTree();
  } catch (err) {
    console.error('Gagal mengambil cascading:', err);
  }
}

function renderCascadingTree() {
  const container = document.getElementById('cascadingTreeEditor');
  container.innerHTML = '';

  // Filter root (Tujuan)
  const roots = cascadingList.filter(c => c.parentId === null || c.parentId === "");
  
  if (roots.length === 0) {
    container.innerHTML = '<p class="text-muted text-center py-4">Belum ada struktur cascading. Buat tujuan pertama di form kiri.</p>';
    return;
  }

  const rootUl = document.createElement('div');
  roots.forEach(root => {
    const nodeEl = buildCascadingNodeEl(root);
    rootUl.appendChild(nodeEl);
  });
  container.appendChild(rootUl);
}

function buildCascadingNodeEl(node) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';
  wrapper.setAttribute('data-id', node.id);

  const deleteBtn = (currentUser.role === 'admin' || (currentUser.role === 'admin_bidang' && node.bidangPengampu === currentUser.bidang))
    ? `<button class="btn btn-sm btn-danger btn-delete-node" title="Hapus"><i class="fa-solid fa-trash"></i></button>`
    : '';

  wrapper.innerHTML = `
    <div class="tree-node-header">
      <div class="node-title-area">
        <span class="node-badge badge-${node.level}">${node.level} (${node.tipeTarget || 'Kondisi Akhir Naik'})</span>
        <span class="node-desc">${node.text}</span>
        <span class="node-kpi">Indikator: <strong>${node.indikator}</strong> (Target: ${node.target} ${node.satuan}) | Pengampu: <em>${node.bidangPengampu}</em></span>
      </div>
      <div class="node-actions">
        ${deleteBtn}
      </div>
    </div>
    <div class="node-children"></div>
  `;

  if (deleteBtn) {
    wrapper.querySelector('.btn-delete-node').addEventListener('click', () => deleteCascadingNode(node.id));
  }

  // Render children
  const children = cascadingList.filter(c => c.parentId === node.id);
  const childContainer = wrapper.querySelector('.node-children');
  children.forEach(child => {
    const childEl = buildCascadingNodeEl(child);
    childContainer.appendChild(childEl);
  });

  return wrapper;
}

async function handleCascadingFormSubmit(e) {
  e.preventDefault();
  const payload = {
    level: document.getElementById('cascLevel').value,
    parentId: document.getElementById('cascParent').value || null,
    text: document.getElementById('cascText').value.trim(),
    indikator: document.getElementById('cascIndikator').value.trim(),
    target: document.getElementById('cascTarget').value.trim(),
    satuan: document.getElementById('cascSatuan').value.trim(),
    tipeTarget: document.getElementById('cascTipeTarget').value,
    bidangPengampu: document.getElementById('cascBidang').value,
    requesterRole: currentUser.role,
    requesterBidang: currentUser.bidang
  };

  try {
    const res = await fetch('/api/cascading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('Berhasil menyimpan data cascading!');
      document.getElementById('cascText').value = '';
      document.getElementById('cascIndikator').value = '';
      document.getElementById('cascTarget').value = '';
      document.getElementById('cascSatuan').value = '';
      loadAdminCascading();
    } else {
      const err = await res.json();
      alert('Gagal: ' + err.error);
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteCascadingNode(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus item cascading ini beserta seluruh turunannya?')) return;
  try {
    const res = await fetch(`/api/cascading/${id}`, { 
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterRole: currentUser.role, requesterBidang: currentUser.bidang })
    });
    if (res.ok) {
      alert('Item cascading berhasil dihapus.');
      loadAdminCascading();
    } else {
      const err = await res.json();
      alert('Gagal: ' + err.error);
    }
  } catch (err) {
    console.error(err);
  }
}

/* ==========================================================================
   PEGAWAI: PILIH INDIKATOR KINERJA
   ========================================================================== */
async function loadEmployeeSelections() {
  pageTitle.textContent = "Pilih Indikator IKU Bidang";
  pageSubtitle.textContent = "Centang Program, Kegiatan, Subkegiatan, atau Aktivitas yang ditugaskan kepada bidang kerja Anda";

  try {
    // Load cascading data
    const resCasc = await fetch('/api/cascading');
    cascadingList = await resCasc.json();

    // Load current employee selections
    const resSel = await fetch(`/api/selections/${currentUser.id}`);
    employeeSelections = await resSel.json();

    const listContainer = document.getElementById('indicatorsSelectionList');
    listContainer.innerHTML = '';

    // Normal staff cannot select macro goals (Tujuan, Sasaran, Program). Sri Mulyani (admin_bidang) also manages indicators.
    // Standard pegawai can only choose Kegiatan, Subkegiatan, and Aktivitas.
    const allowedLevels = ['kegiatan', 'subkegiatan', 'aktivitas'];
    const matchingIndicators = cascadingList.filter(
      c => allowedLevels.includes(c.level) && (c.bidangPengampu === currentUser.bidang || c.bidangPengampu === 'Pimpinan')
    );

    if (matchingIndicators.length === 0) {
      listContainer.innerHTML = `<p class="text-muted text-center">Tidak ada indikator cascading Kegiatan/Subkegiatan yang diampu bidang Anda (${currentUser.bidang}).</p>`;
      return;
    }

    matchingIndicators.forEach(item => {
      const isChecked = employeeSelections.selectedIndicators.includes(item.id);
      
      const card = document.createElement('div');
      card.className = 'selection-node-card';
      card.innerHTML = `
        <label class="checkbox-container">
          <input type="checkbox" value="${item.id}" ${isChecked ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
        <div>
          <span class="node-badge badge-${item.level}">${item.level}</span>
          <div class="node-desc" style="font-size:13px; margin-top:2px;"><strong>${item.text}</strong></div>
          <div class="node-kpi" style="font-size:11px; margin-top:2px;">Indikator: ${item.indikator} (Target: ${item.target} ${item.satuan}) [Tipe: ${item.tipeTarget || 'Kondisi Akhir Naik'}]</div>
        </div>
      `;
      listContainer.appendChild(card);
    });

  } catch (err) {
    console.error(err);
  }
}

async function handleIndicatorSelectionSubmit(e) {
  e.preventDefault();
  const checkboxes = document.querySelectorAll('#indicatorsSelectionList input[type="checkbox"]');
  const selectedIndicators = [];

  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedIndicators.push(cb.value);
    }
  });

  try {
    const res = await fetch('/api/selections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: currentUser.id,
        selectedIndicators
      })
    });

    if (res.ok) {
      alert('Pilihan indikator berhasil diperbarui!');
      loadEmployeeSelections();
    }
  } catch (err) {
    console.error(err);
  }
}

/* ==========================================================================
   PEGAWAI: RENCANA AKSI (RENAKSI) & PK (SPREADSHEET LAYOUT)
   ========================================================================== */
async function loadEmployeeRenaksi() {
  pageTitle.textContent = "Penyusunan Rencana Aksi (Renaksi) & PK";
  pageSubtitle.textContent = "Tentukan target bulanan dengan format spreadsheet dan cetak Perjanjian Kinerja resmi";

  try {
    const resSel = await fetch(`/api/selections/${currentUser.id}`);
    employeeSelections = await resSel.json();

    const resCasc = await fetch('/api/cascading');
    cascadingList = await resCasc.json();

    const resRx = await fetch(`/api/renaksi/${currentUser.id}/2026`);
    currentRenaksiList = await resRx.json();

    const tbody = document.getElementById('renaksiSpreadsheetBody');
    tbody.innerHTML = '';

    const chosenNodes = cascadingList.filter(c => employeeSelections.selectedIndicators.includes(c.id));

    if (chosenNodes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="16" class="text-center text-muted py-4">Belum ada indikator terpilih. Silakan centang indikator di menu "Pilih Indikator IKU Bidang" terlebih dahulu.</td></tr>`;
      renderPKDocuments([]);
      return;
    }

    chosenNodes.forEach((node) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', node.id);

      // Create month inputs HTML
      let monthsHtml = '';
      for (let m = 1; m <= 12; m++) {
        const rx = currentRenaksiList.find(r => r.indicatorId === node.id && r.bulan === m);
        const tVal = rx ? rx.targetBulanan : 0;
        monthsHtml += `<td><input type="number" step="0.1" class="month-cell-input" data-bulan="${m}" value="${tVal}"></td>`;
      }

      tr.innerHTML = `
        <td>
          <div style="font-weight:600;">${node.indikator}</div>
          <span class="text-muted" style="font-size:11px;">${node.text.substring(0, 70)}...</span>
        </td>
        <td><span class="node-badge badge-${node.level}">${node.tipeTarget || 'Kondisi Akhir Naik'}</span></td>
        <td align="center"><strong>${node.target}</strong> <span style="font-size:11px;">${node.satuan}</span></td>
        ${monthsHtml}
        <td class="total-cell" data-target-value="${node.target}" data-target-type="${node.tipeTarget || 'Kondisi Akhir Naik'}">0</td>
      `;

      // Live sum recalculations
      const inputs = tr.querySelectorAll('.month-cell-input');
      inputs.forEach(input => {
        input.addEventListener('input', () => calculateRowSum(tr));
      });

      tbody.appendChild(tr);
      calculateRowSum(tr);
    });

    renderPKDocuments(chosenNodes);

  } catch (err) {
    console.error(err);
  }
}

function calculateRowSum(trEl) {
  const inputs = trEl.querySelectorAll('.month-cell-input');
  const totalCell = trEl.querySelector('.total-cell');
  const targetVal = parseFloat(totalCell.getAttribute('data-target-value')) || 0;
  const targetType = totalCell.getAttribute('data-target-type');

  let sum = 0;
  inputs.forEach(inp => {
    sum += parseFloat(inp.value) || 0;
  });

  // Round sum to 2 decimal places to prevent floating point anomalies
  sum = Math.round(sum * 100) / 100;
  totalCell.textContent = sum;

  if (targetType === 'Akumulatif') {
    if (Math.abs(sum - targetVal) > 0.01) {
      totalCell.className = 'total-cell invalid-sum';
      totalCell.title = `Jumlah input bulanan (${sum}) belum sesuai target tahunan (${targetVal})`;
    } else {
      totalCell.className = 'total-cell valid-sum';
      totalCell.title = `Sesuai target tahunan!`;
    }
  } else {
    // End state target doesn't require sum validation
    totalCell.className = 'total-cell valid-sum';
  }
}

async function saveSpreadsheetTargets() {
  const rows = document.querySelectorAll('#renaksiSpreadsheetBody tr[data-id]');
  const targets = [];

  for (let row of rows) {
    const indicatorId = row.getAttribute('data-id');
    const inputs = row.querySelectorAll('.month-cell-input');
    const totalCell = row.querySelector('.total-cell');
    const targetType = totalCell.getAttribute('data-target-type');
    const targetVal = parseFloat(totalCell.getAttribute('data-target-value')) || 0;

    let rowSum = 0;
    inputs.forEach(input => {
      const bulan = input.getAttribute('data-bulan');
      const targetBulanan = parseFloat(input.value) || 0;
      rowSum += targetBulanan;

      targets.push({
        indicatorId,
        bulan,
        targetBulanan
      });
    });

    rowSum = Math.round(rowSum * 100) / 100;
    if (targetType === 'Akumulatif' && Math.abs(rowSum - targetVal) > 0.01) {
      const node = cascadingList.find(c => c.id === indicatorId);
      alert(`Validasi target gagal untuk "${node.indikator}". Jumlah target bulanan adalah ${rowSum}, tetapi target tahunan Anda harus berjumlah persis ${targetVal} ${node.satuan}.`);
      return;
    }
  }

  try {
    const res = await fetch('/api/renaksi/target/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: currentUser.id,
        targets
      })
    });

    if (res.ok) {
      alert('Seluruh rencana target bulanan berhasil disimpan!');
      loadEmployeeRenaksi();
    } else {
      const err = await res.json();
      alert('Gagal menyimpan: ' + err.error);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderPKDocuments(chosenNodes) {
  // Update Meta
  document.getElementById('pkName').textContent = currentUser.nama;
  document.getElementById('pkJabatan').textContent = currentUser.jabatan;
  document.getElementById('pkSignPegawaiNama').textContent = currentUser.nama;
  document.getElementById('pkSignPegawaiNip').textContent = `NIP. ${currentUser.nip}`;

  const atasan = employees.find(e => e.id === currentUser.parentId);
  document.getElementById('pkSignAtasanNama').textContent = atasan ? atasan.nama : 'Kepala Pelaksana BPBD';
  document.getElementById('pkSignAtasanNip').textContent = atasan ? `NIP. ${atasan.nip}` : '';

  // Render Target Table
  const tbody = document.getElementById('pkTableBody');
  tbody.innerHTML = '';
  
  if (chosenNodes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" align="center" style="font-style:italic;">Belum ada indikator terpilih.</td></tr>';
  } else {
    chosenNodes.forEach((node, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td align="center">${idx + 1}</td>
        <td>${node.text}</td>
        <td>${node.indikator}</td>
        <td align="center">${node.target}</td>
        <td align="center">${node.satuan}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Render Monthly Target Matrix Table
  const renTableBody = document.getElementById('pkRenaksiTableBody');
  renTableBody.innerHTML = '';

  if (chosenNodes.length === 0) {
    renTableBody.innerHTML = '<tr><td colspan="14" align="center" style="font-style:italic;">Belum ada target bulanan diset.</td></tr>';
  } else {
    chosenNodes.forEach((node, idx) => {
      const tr = document.createElement('tr');
      let monthlyTargetsHtml = '';
      
      for (let m = 1; m <= 12; m++) {
        const rx = currentRenaksiList.find(r => r.indicatorId === node.id && r.bulan === m);
        const tVal = rx ? rx.targetBulanan : '0';
        monthlyTargetsHtml += `<td align="center">${tVal}</td>`;
      }

      tr.innerHTML = `
        <td align="center">${idx + 1}</td>
        <td><strong>${node.indikator}</strong> (${node.satuan})</td>
        ${monthlyTargetsHtml}
      `;
      renTableBody.appendChild(tr);
    });
  }
}

/* ==========================================================================
   PEGAWAI: REALISASI KINERJA BULANAN
   ========================================================================== */
async function loadEmployeeRealisasi() {
  pageTitle.textContent = "Laporan Realisasi Bulanan";
  pageSubtitle.textContent = "Kirim capaian bulanan dan verifikasi data dukung untuk penilaian atasan";

  try {
    const resSel = await fetch(`/api/selections/${currentUser.id}`);
    employeeSelections = await resSel.json();

    const resCasc = await fetch('/api/cascading');
    cascadingList = await resCasc.json();

    const resRx = await fetch(`/api/renaksi/${currentUser.id}/2026`);
    currentRenaksiList = await resRx.json();

    // Populate indicators dropdown
    const select = document.getElementById('realisasiIndicatorSelect');
    select.innerHTML = '<option value="">-- Pilih Indikator --</option>';

    const chosenNodes = cascadingList.filter(c => employeeSelections.selectedIndicators.includes(c.id));

    if (chosenNodes.length === 0) {
      select.innerHTML = '<option value="">-- Belum ada indikator terpilih --</option>';
      document.getElementById('realisasiForm').style.display = 'none';
      return;
    }

    chosenNodes.forEach(node => {
      const opt = document.createElement('option');
      opt.value = node.id;
      opt.textContent = node.indikator;
      select.appendChild(opt);
    });

    loadRealisasiForm();

  } catch (err) {
    console.error(err);
  }
}

function loadRealisasiForm() {
  const indicatorId = document.getElementById('realisasiIndicatorSelect').value;
  const bulan = document.getElementById('realisasiBulanSelect').value;
  const form = document.getElementById('realisasiForm');

  if (!indicatorId || !bulan) {
    form.style.display = 'none';
    return;
  }

  // Find target for chosen month
  const record = currentRenaksiList.find(r => r.indicatorId === indicatorId && r.bulan === parseInt(bulan));
  const node = cascadingList.find(c => c.id === indicatorId);

  if (!record) {
    document.getElementById('realisasiTargetLabel').textContent = '0 (Harap set target renaksi terlebih dahulu)';
    document.getElementById('realisasiSatuanLabel').textContent = '';
    form.style.display = 'none';
    return;
  }

  // Populate target
  document.getElementById('realisasiTargetLabel').textContent = record.targetBulanan;
  document.getElementById('realisasiSatuanLabel').textContent = node ? node.satuan : '';

  // Reset inputs
  document.getElementById('inputRealValue').value = record.realisasiBulanan !== null ? record.realisasiBulanan : '';
  document.getElementById('inputRealBukti').value = record.buktiDukung || '';
  document.getElementById('inputRealKendala').value = record.kendala || '';
  document.getElementById('inputRealSolusi').value = record.solusi || '';
  document.getElementById('inputRealPendorong').value = record.faktorPendorong || '';
  document.getElementById('inputRealInovasi').value = record.inovasi || '';

  // Trigger verify preview if exists
  const verifyBadge = form.querySelector('.verify-badge');
  if (verifyBadge) verifyBadge.innerHTML = '';
  if (record.buktiDukung) {
    verifyRealizationLink(document.getElementById('inputRealBukti'));
  }

  // Trigger conditional toggles
  toggleConditionalRealizationFields();

  form.style.display = 'block';
}

function toggleConditionalRealizationFields() {
  const target = parseFloat(document.getElementById('realisasiTargetLabel').textContent) || 0;
  const realValue = parseFloat(document.getElementById('inputRealValue').value);

  const subUnder = document.getElementById('subformUnderperform');
  const subExc = document.getElementById('subformExceeded');

  if (isNaN(realValue)) {
    subUnder.style.display = 'none';
    subExc.style.display = 'none';
    return;
  }

  if (realValue < target) {
    subUnder.style.display = 'block';
    subExc.style.display = 'none';
    document.getElementById('inputRealKendala').required = true;
    document.getElementById('inputRealSolusi').required = true;
    document.getElementById('inputRealPendorong').required = false;
    document.getElementById('inputRealInovasi').required = false;
  } else {
    subUnder.style.display = 'none';
    subExc.style.display = 'block';
    document.getElementById('inputRealKendala').required = false;
    document.getElementById('inputRealSolusi').required = false;
    document.getElementById('inputRealPendorong').required = true;
    document.getElementById('inputRealInovasi').required = true;
  }
}

async function verifyRealizationLink(inputEl) {
  const url = inputEl.value.trim();
  const wrapper = inputEl.closest('.input-verify-wrapper');
  if (!wrapper) return;

  let badge = wrapper.querySelector('.verify-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'verify-badge';
    wrapper.appendChild(badge);
  }

  if (!url) {
    badge.className = 'verify-badge';
    badge.innerHTML = '';
    return;
  }

  badge.className = 'verify-badge checking';
  badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengecek izin berbagi link...';

  try {
    const res = await fetch('/api/verify-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();

    if (data.isDrive) {
      if (data.isPublic) {
        badge.className = 'verify-badge verified-public';
        badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Drive Publik (Aman diakses)';
      } else {
        badge.className = 'verify-badge verified-private';
        badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Drive Privat (Atasan Tidak Bisa Buka)';
      }
    } else {
      if (data.isPublic) {
        badge.className = 'verify-badge verified-external';
        badge.innerHTML = '<i class="fa-solid fa-link"></i> Link Aktif';
      } else {
        badge.className = 'verify-badge verified-error';
        badge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Tautan Error';
      }
    }
  } catch (err) {
    badge.className = 'verify-badge verified-error';
    badge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Gagal memeriksa';
  }
}

async function handleRealisasiSubmit(e) {
  e.preventDefault();
  const indicatorId = document.getElementById('realisasiIndicatorSelect').value;
  const bulan = document.getElementById('realisasiBulanSelect').value;

  const payload = {
    employeeId: currentUser.id,
    indicatorId,
    bulan,
    realisasiBulanan: document.getElementById('inputRealValue').value,
    buktiDukung: document.getElementById('inputRealBukti').value.trim(),
    kendala: document.getElementById('inputRealKendala').value.trim(),
    solusi: document.getElementById('inputRealSolusi').value.trim(),
    faktorPendorong: document.getElementById('inputRealPendorong').value.trim(),
    inovasi: document.getElementById('inputRealInovasi').value.trim(),
    status: 'Diajukan'
  };

  try {
    const res = await fetch('/api/renaksi/realisasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert('Berhasil mengirimkan realisasi kinerja bulanan!');
      await loadEmployeeRealisasi();
      document.getElementById('realisasiIndicatorSelect').value = indicatorId;
      document.getElementById('realisasiBulanSelect').value = bulan;
      loadRealisasiForm();
    } else {
      const err = await res.json();
      alert('Gagal mengirim: ' + err.error);
    }
  } catch (err) {
    console.error(err);
  }
}

/* ==========================================================================
   SUPERVISOR: PENILAIAN / VERIFIKASI BAWAHAN
   ========================================================================== */
async function loadSubordinatesView() {
  pageTitle.textContent = "Penilaian Kinerja Bawahan";
  pageSubtitle.textContent = "Evaluasi akuntabilitas kinerja berjenjang untuk bawahan langsung";

  document.getElementById('evaluationDetailPanel').style.display = 'none';

  // Get direct subordinates
  const subs = employees.filter(emp => emp.parentId === currentUser.id);
  const container = document.getElementById('subordinatesContainer');
  container.innerHTML = '';

  if (subs.length === 0) {
    container.innerHTML = '<p class="text-muted">Anda tidak memiliki bawahan langsung.</p>';
    return;
  }

  subs.forEach(sub => {
    const item = document.createElement('div');
    item.className = 'subordinate-item';
    item.innerHTML = `
      <h4>${sub.nama}</h4>
      <p>${sub.jabatan} (${sub.bidang})</p>
    `;
    item.addEventListener('click', () => {
      document.querySelectorAll('.subordinate-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showSubordinateRenaksiDetails(sub);
    });
    container.appendChild(item);
  });
}

async function showSubordinateRenaksiDetails(sub) {
  selectedSubordinate = sub;
  document.getElementById('evalTargetName').textContent = sub.nama;
  document.getElementById('evalTargetJabatan').textContent = sub.jabatan;
  document.getElementById('evalTargetBidang').textContent = sub.bidang;

  try {
    const resRx = await fetch(`/api/renaksi/${sub.id}/2026`);
    const renaksi = await resRx.json();

    const resCasc = await fetch('/api/cascading');
    const cascading = await resCasc.json();

    const body = document.getElementById('evalTargetRenaksiBody');
    body.innerHTML = '';

    const pendingList = renaksi.filter(r => r.status === 'Diajukan' || r.status === 'Disetujui');
    
    if (pendingList.length === 0) {
      body.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Bawahan belum melaporkan realisasi kinerja bulanan.</td></tr>';
      document.getElementById('evaluationDetailPanel').style.display = 'block';
      return;
    }

    const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    pendingList.forEach(item => {
      const node = cascading.find(c => c.id === item.indicatorId);
      const isApproved = item.status === 'Disetujui';

      // Parse obstacles vs drivers
      let analysisHtml = '';
      if (item.realisasiBulanan < item.targetBulanan) {
        analysisHtml = `<span class="text-orange" style="font-size:11px;"><strong>Kendala:</strong> ${item.kendala}<br><strong>Solusi:</strong> ${item.solusi}</span>`;
      } else {
        analysisHtml = `<span class="text-green" style="font-size:11px;"><strong>Pendorong:</strong> ${item.faktorPendorong}<br><strong>Inovasi:</strong> ${item.inovasi || '-'}</span>`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${months[item.bulan]}</strong></td>
        <td>${node ? node.indikator : 'Indikator'}</td>
        <td align="center">${item.targetBulanan}</td>
        <td align="center"><strong>${item.realisasiBulanan}</strong></td>
        <td>
          ${item.buktiDukung ? `<a href="${item.buktiDukung}" target="_blank" class="text-orange"><i class="fa-solid fa-file-pdf"></i> Bukti</a>` : '-'}
        </td>
        <td>${analysisHtml}</td>
        <td>
          ${isApproved
            ? `<span class="badge badge-finished"><i class="fa-solid fa-circle-check"></i> Disetujui</span>`
            : `<button class="btn btn-sm btn-orange btn-approve-rx" data-id="${item.id}"><i class="fa-solid fa-check"></i> Setujui</button>`
          }
        </td>
      `;

      if (!isApproved) {
        tr.querySelector('.btn-approve-rx').addEventListener('click', async () => {
          await approveSubordinateRealisasi(item.id);
        });
      }

      body.appendChild(tr);
    });

    document.getElementById('evaluationDetailPanel').style.display = 'block';

  } catch (err) {
    console.error(err);
  }
}

async function approveSubordinateRealisasi(id) {
  try {
    const res = await fetch('/api/renaksi/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (res.ok) {
      alert('Realisasi disetujui!');
      showSubordinateRenaksiDetails(selectedSubordinate);
    }
  } catch (err) {
    console.error(err);
  }
}

/* ==========================================================================
   LEADERBOARD / PENGHARGAAN MODULE
   ========================================================================== */
async function loadLeaderboard() {
  pageTitle.textContent = "Penghargaan Capaian Kinerja";
  pageSubtitle.textContent = "Pemetaan peringkat pegawai berdasarkan persentase capaian target bulanan dan kecepatan pelaporan";

  try {
    const res = await fetch('/api/rewards/leaderboard');
    const leaderboard = await res.json();

    const podium = document.getElementById('rewardsPodium');
    const tbody = document.querySelector('#leaderboardTable tbody');
    podium.innerHTML = '';
    tbody.innerHTML = '';

    if (leaderboard.length === 0) {
      podium.innerHTML = '<p class="text-muted">Belum ada data capaian bulan ini.</p>';
      return;
    }

    // Sort into Podium Layout: Rank 2 (left), Rank 1 (center), Rank 3 (right)
    const podiumOrder = [];
    if (leaderboard[1]) podiumOrder.push({ ...leaderboard[1], rank: 2 });
    if (leaderboard[0]) podiumOrder.push({ ...leaderboard[0], rank: 1 });
    if (leaderboard[2]) podiumOrder.push({ ...leaderboard[2], rank: 3 });

    podiumOrder.forEach(item => {
      const step = document.createElement('div');
      step.className = `podium-step rank-${item.rank}`;

      let crown = '';
      if (item.rank === 1) crown = '<i class="fa-solid fa-crown text-warning" style="margin-bottom: 4px;"></i>';

      // Format Submission Speed label
      let speedText = 'Belum melapor';
      if (item.latestSubmissionTime !== Infinity) {
        const d = new Date(item.latestSubmissionTime);
        speedText = `Lapor: ${d.toLocaleDateString('id')} ${d.toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' })}`;
      }

      step.innerHTML = `
        ${crown}
        <div class="podium-avatar">
          <i class="fa-solid fa-user-astronaut"></i>
        </div>
        <div class="podium-pedestal">
          <span class="podium-number">${item.rank}</span>
          <span class="podium-name">${item.nama}</span>
          <span class="podium-score">${item.averageCapaian}%</span>
          <span class="text-muted" style="font-size:9px; margin-top:2px;">${speedText}</span>
        </div>
      `;
      podium.appendChild(step);
    });

    // Populate Rank list table
    leaderboard.forEach((item, index) => {
      let speedText = '-';
      if (item.latestSubmissionTime !== Infinity) {
        const d = new Date(item.latestSubmissionTime);
        speedText = `${d.toLocaleDateString('id')} ${d.toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' })}`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${index + 1}</strong></td>
        <td><strong>${item.nama}</strong><br><span class="text-muted" style="font-size:10px;">${item.jabatan}</span></td>
        <td>${item.bidang}</td>
        <td><span class="badge badge-score">${item.averageCapaian}%</span></td>
        <td style="font-size:11px;">${speedText}</td>
        <td><span class="badge badge-finished">${item.totalBulanMengisi} Laporan</span></td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
  }
}

/* ==========================================================================
   ORGANOGRAM TREE
   ========================================================================== */
async function renderOrganogram() {
  pageTitle.textContent = "Struktur Organisasi & Evaluasi";
  pageSubtitle.textContent = "Hierarki birokrasi BPBD Boyolali dan status pengajuan evaluasi kinerja";

  try {
    const res = await fetch('/api/dashboard/summary');
    const summary = await res.json();

    const container = document.getElementById('orgTreeContainer');
    container.innerHTML = '';

    const rootEmp = employees.find(emp => emp.parentId === null && emp.id !== 'admin');
    if (!rootEmp) return;

    const rootNodeList = document.createElement('ul');
    const rootLi = buildOrgNodeLi(rootEmp, summary);
    rootNodeList.appendChild(rootLi);
    container.appendChild(rootNodeList);
  } catch (err) {
    console.error('Gagal membangun organogram:', err);
  }
}

function buildOrgNodeLi(employee, summary) {
  const li = document.createElement('li');
  const nodeData = summary.find(s => s.id === employee.id);
  const status = nodeData ? nodeData.status : 'Belum Mengisi';
  const score = nodeData && nodeData.skorAKIP ? ` | AKIP: ${nodeData.skorAKIP}` : '';

  let statusDotClass = 'status-empty';
  if (status === 'Draft') statusDotClass = 'status-draft';
  if (status === 'Diajukan') statusDotClass = 'status-submitted';
  if (status === 'Selesai') statusDotClass = 'status-finished';

  li.innerHTML = `
    <div class="org-node" data-id="${employee.id}">
      <h4>${employee.nama}</h4>
      <p>${employee.jabatan}</p>
      <div class="text-muted" style="font-size:9px;">
        Status: ${status} ${score}
        <span class="org-status-indicator ${statusDotClass}"></span>
      </div>
    </div>
  `;

  li.querySelector('.org-node').addEventListener('click', () => {
    userSelect.value = employee.id;
    handleUserSwitch(employee.id);
  });

  const children = employees.filter(emp => emp.parentId === employee.id && emp.id !== 'admin');
  if (children.length > 0) {
    const ul = document.createElement('ul');
    children.forEach(child => {
      const childLi = buildOrgNodeLi(child, summary);
      ul.appendChild(childLi);
    });
    li.appendChild(ul);
  }

  return li;
}

/* ==========================================================================
   REPORTS / PRINT SECTION
   ========================================================================== */
function setupReportView() {
  pageTitle.textContent = "Laporan & Cetak Evaluasi";
  pageSubtitle.textContent = "Unduh dan cetak hasil penilaian akuntabilitas kinerja internal";

  const select = document.getElementById('reportPegawaiSelect');
  select.innerHTML = '';

  let allowedReportEmps = [];
  if (currentUser.role === 'admin' || currentUser.role === 'kalaksa' || currentUser.role === 'sekretaris') {
    allowedReportEmps = employees.filter(e => e.id !== 'admin');
  } else if (currentUser.role === 'kabid') {
    const directSubs = employees.filter(e => e.parentId === currentUser.id);
    const subIds = directSubs.map(d => d.id);
    const indirectSubs = employees.filter(e => subIds.includes(e.parentId));
    allowedReportEmps = [currentUser, ...directSubs, ...indirectSubs];
  } else {
    allowedReportEmps = [currentUser];
  }

  allowedReportEmps.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.nama} (${emp.jabatan})`;
    select.appendChild(opt);
  });

  if (allowedReportEmps.length > 0) {
    select.value = allowedReportEmps[0].id;
    renderPrintReport(allowedReportEmps[0].id);
  }
}

async function renderPrintReport(empId) {
  const emp = employees.find(e => e.id === empId);
  if (!emp) return;

  try {
    const res = await fetch(`/api/performance/${emp.id}/2026`);
    const perf = await res.json();
    
    const atasan = employees.find(e => e.id === emp.parentId);
    const atasanNama = atasan ? atasan.nama : 'Kepala Pelaksana BPBD Boyolali';
    const atasanNip = atasan ? atasan.nip : '-';

    document.getElementById('printName').textContent = emp.nama;
    document.getElementById('printNip').textContent = emp.nip;
    document.getElementById('printJabatan').textContent = emp.jabatan;
    document.getElementById('printAtasan').textContent = atasanNama;

    // Render IKUs in print table
    const printIkuBody = document.getElementById('printIkuBody');
    printIkuBody.innerHTML = '';
    
    if (perf.targetIKU && perf.targetIKU.length > 0) {
      perf.targetIKU.forEach((iku, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td align="center">${index + 1}</td>
          <td>${iku.indikator}</td>
          <td align="center">${iku.target}</td>
          <td align="center">${iku.realisasi}</td>
          <td align="center"><strong>${iku.capaianPersen}%</strong></td>
        `;
        printIkuBody.appendChild(tr);
      });
    } else {
      printIkuBody.innerHTML = `<tr><td colspan="5" align="center" style="font-style: italic;">Belum ada sasaran kinerja yang diisikan.</td></tr>`;
    }

    // Evaluation outputs
    const scoreVal = perf.evaluasiAtasan ? perf.evaluasiAtasan.skorAKIP.toFixed(1) : '-';
    const predicateVal = perf.evaluasiAtasan ? perf.evaluasiAtasan.predikat : '-';
    const notesVal = perf.evaluasiAtasan ? perf.evaluasiAtasan.catatan : 'Belum dievaluasi oleh atasan langsung.';
    const dateVal = perf.evaluasiAtasan ? formatDate(perf.evaluasiAtasan.tanggalEvaluasi) : formatDate(new Date());

    document.getElementById('printScore').textContent = scoreVal;
    document.getElementById('printPredikat').textContent = predicateVal;
    document.getElementById('printNotes').textContent = notesVal;
    document.getElementById('printDate').textContent = dateVal;
    document.getElementById('printSignName').textContent = atasanNama;
    document.getElementById('printSignNip').textContent = `NIP. ${atasanNip}`;

  } catch (err) {
    console.error('Gagal mencetak laporan:', err);
  }
}

// Helper date formatter
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return d.toLocaleDateString('id-ID', options);
}


/* ==========================================================================
   ADMIN: RENCANA 5 TAHUNAN (CASCADING 5 YEARS)
   ========================================================================== */
async function loadCascading5Years() {
  pageTitle.textContent = "Rencana Strategis 5 Tahunan";
  pageSubtitle.textContent = "Penyusunan Tujuan & Sasaran Strategis Periode 2025-2030 dengan rincian target per tahun";

  try {
    const res = await fetch('/api/cascading5years');
    cascading5YearsList = await res.json();

    // Populate parent dropdown
    const cascParent = document.getElementById('casc5Parent');
    cascParent.innerHTML = '<option value="">-- Berdiri Sendiri (Tujuan Strategis) --</option>';

    const order = { tujuan: 1, sasaran: 2 };
    cascading5YearsList.sort((a, b) => (order[a.level] || 99) - (order[b.level] || 99));

    cascading5YearsList.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `[${item.level.toUpperCase()}] ${item.text.substring(0, 60)}...`;
      cascParent.appendChild(opt);
    });

    render5YearsTree();
  } catch (err) {
    console.error('Gagal mengambil cascading 5 tahunan:', err);
  }
}

function render5YearsTree() {
  const container = document.getElementById('cascading5YearsTreeEditor');
  container.innerHTML = '';

  const roots = cascading5YearsList.filter(c => c.parentId === null || c.parentId === '');

  if (roots.length === 0) {
    container.innerHTML = '<p class="text-muted text-center py-4">Belum ada struktur rencana 5 tahunan. Buat tujuan strategis pertama di form kiri.</p>';
    return;
  }

  const rootWrapper = document.createElement('div');
  roots.forEach(root => {
    const nodeEl = build5YearsNodeEl(root);
    rootWrapper.appendChild(nodeEl);
  });
  container.appendChild(rootWrapper);
}

function build5YearsNodeEl(node) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';
  wrapper.setAttribute('data-id', node.id);

  const deleteBtn = (currentUser.role === 'admin')
    ? `<button class="btn btn-sm btn-danger btn-delete-5y-node" title="Hapus"><i class="fa-solid fa-trash"></i></button>`
    : '';

  // Build yearly targets display
  let yearlyHtml = '';
  for (let y = 2025; y <= 2030; y++) {
    yearlyHtml += `<span class="year-tag"><strong>${node[`target${y}`] || '0'}</strong> (${y})</span>`;
  }
  yearlyHtml += `<span class="year-tag target-akhir">🎯 Akhir: <strong>${node.targetAkhir || '0'}</strong> ${node.satuan}</span>`;

  wrapper.innerHTML = `
    <div class="tree-node-header">
      <div class="node-title-area">
        <span class="node-badge badge-${node.level}">${node.level} (${node.tipeTarget || 'Kondisi Akhir Naik'})</span>
        <span class="node-desc">${node.text}</span>
        <span class="node-kpi">Indikator: <strong>${node.indikator}</strong> | Satuan: ${node.satuan} | Pengampu: <em>${node.bidangPengampu}</em></span>
        <div class="node-yearly-targets">${yearlyHtml}</div>
      </div>
      <div class="node-actions">
        ${deleteBtn}
      </div>
    </div>
    <div class="node-children"></div>
  `;

  if (deleteBtn) {
    wrapper.querySelector('.btn-delete-5y-node').addEventListener('click', () => delete5YearsNode(node.id));
  }

  // Render children
  const children = cascading5YearsList.filter(c => c.parentId === node.id);
  const childContainer = wrapper.querySelector('.node-children');
  children.forEach(child => {
    const childEl = build5YearsNodeEl(child);
    childContainer.appendChild(childEl);
  });

  return wrapper;
}

async function handleCascading5YearsFormSubmit(e) {
  e.preventDefault();
  const payload = {
    level: document.getElementById('casc5Level').value,
    parentId: document.getElementById('casc5Parent').value || null,
    text: document.getElementById('casc5Text').value.trim(),
    indikator: document.getElementById('casc5Indikator').value.trim(),
    satuan: document.getElementById('casc5Satuan').value.trim(),
    tipeTarget: document.getElementById('casc5TipeTarget').value,
    bidangPengampu: document.getElementById('casc5Bidang').value,
    target2025: document.getElementById('casc5T2025').value.trim() || '0',
    target2026: document.getElementById('casc5T2026').value.trim() || '0',
    target2027: document.getElementById('casc5T2027').value.trim() || '0',
    target2028: document.getElementById('casc5T2028').value.trim() || '0',
    target2029: document.getElementById('casc5T2029').value.trim() || '0',
    target2030: document.getElementById('casc5T2030').value.trim() || '0',
    targetAkhir: document.getElementById('casc5TargetAkhir').value.trim(),
    requesterRole: currentUser.role,
    requesterBidang: currentUser.bidang
  };

  if (!payload.targetAkhir) {
    alert('Target Akhir wajib diisi!');
    return;
  }

  try {
    const res = await fetch('/api/cascading5years', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('Berhasil menyimpan sasaran strategis 5 tahunan!');
      // Reset form
      document.getElementById('casc5Text').value = '';
      document.getElementById('casc5Indikator').value = '';
      document.getElementById('casc5Satuan').value = '';
      document.getElementById('casc5TargetAkhir').value = '';
      for (let y = 2025; y <= 2030; y++) {
        document.getElementById(`casc5T${y}`).value = '';
      }
      loadCascading5Years();
    } else {
      const err = await res.json();
      alert('Gagal: ' + err.error);
    }
  } catch (err) {
    console.error(err);
  }
}

async function delete5YearsNode(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus item ini beserta seluruh turunannya?')) return;
  try {
    const res = await fetch(`/api/cascading5years/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterRole: currentUser.role, requesterBidang: currentUser.bidang })
    });
    if (res.ok) {
      alert('Item berhasil dihapus.');
      loadCascading5Years();
    } else {
      const err = await res.json();
      alert('Gagal: ' + err.error);
    }
  } catch (err) {
    console.error(err);
  }
}


/* ==========================================================================
   ADMIN: MONITORING PROGRES 5 TAHUNAN
   ========================================================================== */
async function loadMonitoring5Years() {
  pageTitle.textContent = "Monitoring Progres 5 Tahunan";
  pageSubtitle.textContent = "Dashboard capaian kinerja terhadap Target Akhir Rencana Strategis 2025-2030";

  const container = document.getElementById('monitoringCardsContainer');
  container.innerHTML = '<p class="text-muted text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data monitoring...</p>';

  try {
    const res = await fetch('/api/monitoring/5years');
    const data = await res.json();

    container.innerHTML = '';

    if (data.length === 0) {
      container.innerHTML = '<p class="text-muted text-center py-4">Belum ada data rencana strategis 5 tahunan.</p>';
      return;
    }

    // Group by tree (roots first, then children)
    const roots = data.filter(d => !d.parentId || d.parentId === '');
    const children = data.filter(d => d.parentId && d.parentId !== '');

    // Render each root and its children
    roots.forEach(root => {
      const rootCard = buildMonitoringCard(root);
      container.appendChild(rootCard);

      const rootChildren = children.filter(c => c.parentId === root.id);
      rootChildren.forEach(child => {
        const childCard = buildMonitoringCard(child, true);
        container.appendChild(childCard);
      });
    });

    // Trigger progress bar animation after render
    requestAnimationFrame(() => {
      document.querySelectorAll('.progress-bar-fill').forEach(bar => {
        const targetWidth = bar.getAttribute('data-progress');
        bar.style.width = targetWidth + '%';
      });
    });

  } catch (err) {
    console.error('Error loading monitoring:', err);
    container.innerHTML = '<p class="text-muted text-center py-4">Gagal memuat data monitoring.</p>';
  }
}

function buildMonitoringCard(item, isChild = false) {
  const card = document.createElement('div');
  card.className = 'monitoring-card';
  if (isChild) {
    card.style.marginLeft = '30px';
    card.style.borderLeftColor = 'rgba(255, 107, 0, 0.4)';
    card.style.borderLeftWidth = '3px';
  }

  // Determine progress color
  let progressColor = 'var(--primary-orange)';
  if (item.progres >= 80) progressColor = 'var(--success)';
  else if (item.progres >= 50) progressColor = 'var(--warning)';
  else if (item.progres > 0) progressColor = 'var(--primary-orange)';

  // Build yearly cells
  let yearlyCellsHtml = '';
  for (let y = 2025; y <= 2030; y++) {
    const yd = item.yearlyData[y];
    const hasData = yd && yd.realisasi > 0;
    yearlyCellsHtml += `
      <div class="year-cell">
        <div class="year-label">${y}</div>
        <div class="year-target">${yd ? yd.target : 0}</div>
        <div class="year-realisasi ${hasData ? '' : 'no-data'}">
          ${hasData ? `<i class="fa-solid fa-check-circle"></i> ${yd.realisasi}` : '<i class="fa-solid fa-minus"></i> -'}
        </div>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="monitoring-card-header">
      <div class="mc-title">
        <span class="node-badge badge-${item.level}" style="margin-bottom:6px;">${item.level}</span>
        <h4>${item.text}</h4>
        <div class="mc-indicator">Indikator: <strong style="color:var(--primary-orange);">${item.indikator}</strong> (${item.satuan}) — ${item.tipeTarget}</div>
      </div>
      <div class="mc-progress-badge" style="color:${progressColor};">
        ${item.progres}%
      </div>
    </div>

    <div class="progress-bar-container">
      <div class="progress-bar-fill" data-progress="${item.progres}" style="width:0%;background:linear-gradient(90deg, ${progressColor}, ${progressColor}dd);"></div>
    </div>

    <div class="monitoring-yearly-grid">
      ${yearlyCellsHtml}
    </div>

    <div class="monitoring-meta">
      <div>
        <span>Pengampu: <strong>${item.bidangPengampu}</strong></span>
        &nbsp;|&nbsp;
        <span>Total Realisasi: <strong>${item.totalRealisasi}</strong> ${item.satuan}</span>
      </div>
      <div>
        Target Akhir: <span class="meta-target-akhir">${item.targetAkhir} ${item.satuan}</span>
      </div>
    </div>
  `;

  return card;
}

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
