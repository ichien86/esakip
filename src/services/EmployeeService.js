import EmployeeRepository from '@/repositories/EmployeeRepository';

class EmployeeService {
  async getAllEmployees() {
    const employees = await EmployeeRepository.findAll();
    return employees.filter(emp => !emp.roles?.includes('bupati')).map(emp => emp.toObject ? emp.toObject() : emp);
  }

  async getAllEmployeesIncludingBupati() {
    const employees = await EmployeeRepository.findAll();
    return employees.map(emp => emp.toObject ? emp.toObject() : emp);
  }

  async changePassword({ employeeId, oldPassword, newPassword }) {
    if (!employeeId || !oldPassword || !newPassword) {
      const err = new Error('Data tidak lengkap');
      err.status = 400;
      throw err;
    }

    const employee = await EmployeeRepository.findOne({ id: employeeId });
    if (!employee) {
      const err = new Error('Pegawai tidak ditemukan');
      err.status = 404;
      throw err;
    }

    if (employee.password !== oldPassword) {
      const err = new Error('Password lama salah');
      err.status = 401;
      throw err;
    }

    employee.password = newPassword;
    await EmployeeRepository.saveDocument(employee);
    return true;
  }

  async changeUnit({ requesterId, bidang }) {
    if (!requesterId) {
      const err = new Error('Akses ditolak. Silakan login kembali.');
      err.status = 401;
      throw err;
    }

    if (!bidang) {
      const err = new Error('Unit kerja wajib dipilih.');
      err.status = 400;
      throw err;
    }

    const employee = await EmployeeRepository.findOne({ id: requesterId });
    if (!employee) {
      const err = new Error('Pegawai tidak ditemukan.');
      err.status = 404;
      throw err;
    }

    if (!employee.parentId) {
      const err = new Error('Anda tidak memiliki atasan langsung untuk merujuk unit kerja.');
      err.status = 400;
      throw err;
    }

    const supervisor = await EmployeeRepository.findOne({ id: employee.parentId });
    if (!supervisor) {
      const err = new Error('Atasan langsung tidak ditemukan.');
      err.status = 400;
      throw err;
    }

    if (supervisor.bidangs.length <= 1) {
      const err = new Error('Pilihan unit kerja dikunci karena atasan Anda tidak merangkap jabatan (bukan Plt).');
      err.status = 400;
      throw err;
    }

    if (!supervisor.bidangs.includes(bidang)) {
      const err = new Error('Unit kerja tidak valid. Atasan Anda tidak memimpin unit kerja ini.');
      err.status = 400;
      throw err;
    }

    employee.bidangs = [bidang];
    await EmployeeRepository.saveDocument(employee);

    return employee;
  }

  async updateSignature({ requesterId, signatureUrl, hasDigitalSignature }) {
    if (!requesterId) {
      const err = new Error('Akses ditolak. Silakan login kembali.');
      err.status = 401;
      throw err;
    }

    const employee = await EmployeeRepository.findOne({ id: requesterId });
    if (!employee) {
      const err = new Error('Pegawai tidak ditemukan.');
      err.status = 404;
      throw err;
    }

    if (signatureUrl !== undefined) {
      employee.signatureUrl = signatureUrl;
    }
    
    if (hasDigitalSignature !== undefined) {
      employee.hasDigitalSignature = Boolean(hasDigitalSignature);
    }

    await EmployeeRepository.saveDocument(employee);
    return employee;
  }

  
  async _prepareEmployeePayload(body, isUpdate = false) {
    const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
    
    let { nama, nip, jabatan, jenisJabatan, pangkatGolongan, roles, parentId, bidangs, pltBidangs, isActive } = body;
    jenisJabatan = jenisJabatan || 'JFU';
    
    let finalRoles = Array.isArray(roles) ? roles : (body.role ? [body.role] : []);
    let finalPltBidangs = Array.isArray(pltBidangs) ? pltBidangs : [];
    let finalParentId = parentId || null;
    let finalBidangs = [];
    let finalScopeLeader = null;

    if (jenisJabatan === 'Pimpinan Tinggi') {
      finalRoles = ['pemimpin'];
      finalBidangs = ['Badan', ...finalPltBidangs];
      finalParentId = 'bupati';
      finalScopeLeader = 'Badan';
    } else if (jenisJabatan === 'Administrator') {
      if (!finalRoles.includes('pemimpin')) finalRoles.push('pemimpin');
      
      const pimpinanTinggi = await EmployeeRepository.findOne({ jenisJabatan: 'Pimpinan Tinggi', isActive: true });
      if (pimpinanTinggi) {
        finalParentId = pimpinanTinggi.id;
      } else {
        finalParentId = 'bupati';
      }
      
      const unitKerjaDipimpin = (Array.isArray(bidangs) && bidangs.length > 0) ? bidangs[0] : (body.bidang || '');
      if (!unitKerjaDipimpin) {
         const err = new Error('Administrator wajib memiliki Unit Kerja Definitif.');
         err.status = 400; throw err;
      }
      finalBidangs = [unitKerjaDipimpin, ...finalPltBidangs];
    } else {
      if (!finalParentId) {
        const err = new Error('Pengawas, JFT, atau JFU wajib memilih Atasan Langsung.');
        err.status = 400; throw err;
      }
      const parent = await EmployeeRepository.findOne({ id: finalParentId });
      if (!parent) {
         const err = new Error('Atasan Langsung tidak ditemukan.');
         err.status = 400; throw err;
      }
      const parentPrimaryBidang = (parent.bidangs && parent.bidangs.length > 0) ? parent.bidangs[0] : '';
      finalBidangs = [parentPrimaryBidang, ...finalPltBidangs];
    }

    if (finalRoles.includes('pemimpin') && jenisJabatan !== 'Pimpinan Tinggi') {
      const leaderBidang = finalBidangs[0] || '';
      if (leaderBidang === 'Badan') {
        finalScopeLeader = 'Badan';
      } else if (leaderBidang === 'Sekretariat') {
        finalScopeLeader = 'Sekretariat';
      } else if (leaderBidang === 'Tata Usaha') {
        finalScopeLeader = 'Tata Usaha';
      } else if (leaderBidang.startsWith('Bidang')) {
        finalScopeLeader = 'Bidang';
      }
    }

    if (!nama || !nip || !jabatan || finalRoles.length === 0 || finalBidangs.length === 0) {
      const err = new Error('Field nama, NIP, jabatan, role, dan unit kerja wajib diisi');
      err.status = 400;
      throw err;
    }

    return {
      nama, nip, jabatan, jenisJabatan, pangkatGolongan, 
      roles: finalRoles, parentId: finalParentId, 
      bidangs: finalBidangs, pltBidangs: finalPltBidangs, 
      scopeLeader: finalScopeLeader,
      isActive: isActive !== undefined ? isActive : true
    };
  }

  async _processPltHandover(newEmpId, primaryBidang) {
    const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
    const CascadingAnnual = (await import('@/models/CascadingAnnual')).default;
    const Renaksi = (await import('@/models/Renaksi')).default;
    const PerjakinDocument = (await import('@/models/PerjakinDocument')).default;
    const Employee = (await import('@/models/Employee')).default;

    const oldPlts = await Employee.find({ pltBidangs: primaryBidang, id: { $ne: newEmpId }, isActive: true });
    
    for (const oldPlt of oldPlts) {
      oldPlt.pltBidangs = oldPlt.pltBidangs.filter(b => b !== primaryBidang);
      oldPlt.bidangs = oldPlt.bidangs.filter(b => b !== primaryBidang);
      await EmployeeRepository.saveDocument(oldPlt);

      await Employee.updateMany(
        { parentId: oldPlt.id, bidangs: primaryBidang },
        { $set: { parentId: newEmpId } }
      );

      await CascadingAnnual.updateMany(
        { penanggungJawab: oldPlt.id, bidangPengampu: primaryBidang },
        { $set: { penanggungJawab: newEmpId } }
      );

      await PerjakinDocument.updateMany(
        { employeeId: oldPlt.id, status: { $ne: 'Draft' } },
        { $set: { status: 'Draft' } }
      );
    }
    
    if (oldPlts.length > 0) {
      await PerjakinDocument.updateMany(
        { employeeId: newEmpId, status: { $ne: 'Draft' } },
        { $set: { status: 'Draft' } }
      );
    }
  }


  async createEmployee({ body, requesterRole }) {
    if (requesterRole !== 'admin') {
      const err = new Error('Akses ditolak. Hanya Administrator Sistem yang dapat mengelola manajemen user.');
      err.status = 403;
      throw err;
    }

    const payload = await this._prepareEmployeePayload(body, false);
    
    const Employee = (await import('@/models/Employee')).default;
    const newEmpId = 'emp_' + Date.now();
    const newEmp = new Employee({
      id: newEmpId,
      ...payload
    });

    const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
    await EmployeeRepository.saveDocument(newEmp);

    if (payload.roles.includes('pemimpin') && payload.bidangs.length > 0) {
      const primaryBidang = payload.bidangs[0];
      if (primaryBidang && !payload.pltBidangs.includes(primaryBidang)) {
        await this._processPltHandover(newEmp.id, primaryBidang);
      }
    }

    return newEmp;
  }

  async updateEmployee({ id, body, requesterRole, yearNum = 2026 }) {
    if (requesterRole !== 'admin') {
      const err = new Error('Akses ditolak. Hanya Administrator Sistem yang dapat melakukan manajemen user.');
      err.status = 403;
      throw err;
    }

    const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
    const emp = await EmployeeRepository.findOne({ id });
    if (!emp) {
      const err = new Error('Pegawai tidak ditemukan');
      err.status = 404;
      throw err;
    }

    const payload = await this._prepareEmployeePayload(body, true);
    const { roles, bidangs, isActive } = payload;

    const isRemovingAdmin = emp.roles.includes('admin') && (!roles.includes('admin') || isActive === false);
    const isRemovingPerencana = emp.roles.includes('perencana') && (!roles.includes('perencana') || isActive === false);
    
    if (isRemovingAdmin) {
      const allAdmins = await EmployeeRepository.find({ roles: 'admin', isActive: true });
      if (allAdmins.length <= 1) {
        const err = new Error('Tidak dapat menghapus peran Admin Sistem. Harus ada minimal 1 Admin Sistem aktif. Silakan tunjuk pegawai lain terlebih dahulu.');
        err.status = 400;
        throw err;
      }
    }

    if (isRemovingPerencana) {
      const allPerencana = await EmployeeRepository.find({ roles: 'perencana', isActive: true });
      if (allPerencana.length <= 1) {
        const err = new Error('Tidak dapat menghapus peran Admin Perencana. Harus ada minimal 1 Admin Perencana aktif.');
        err.status = 400;
        throw err;
      }
    }

    const oldBidangs = emp.bidangs || [];
    const isRemovingAdminBidang = emp.roles.includes('admin_bidang') && (!roles.includes('admin_bidang') || isActive === false);
    if (isRemovingAdminBidang && oldBidangs.length > 0) {
      const bidang = oldBidangs[0];
      const allAdminBidang = await EmployeeRepository.find({ roles: 'admin_bidang', bidangs: bidang, isActive: true });
      if (allAdminBidang.length <= 1) {
        const err = new Error(`Tidak dapat menghapus peran Admin Unit Kerja. Harus ada minimal 1 Admin Unit Kerja untuk unit ${bidang}.`);
        err.status = 400;
        throw err;
      }
    }

    if (oldBidangs.length > 0 && oldBidangs[0] !== bidangs[0]) {
      const Selection = (await import('@/models/Selection')).default;
      const CascadingAnnual = (await import('@/models/CascadingAnnual')).default;
      const Renaksi = (await import('@/models/Renaksi')).default;
      const Notification = (await import('@/models/Notification')).default;
      const Employee = (await import('@/models/Employee')).default;

      const oldBidang = oldBidangs[0];

      const oldUnitIndicators = await CascadingAnnual.find({
        penanggungJawab: id,
        bidangPengampu: oldBidang,
        tahun: yearNum
      });
      const oldUnitIndicatorIds = oldUnitIndicators.map(ind => ind.id);

      if (oldUnitIndicatorIds.length > 0) {
        await CascadingAnnual.updateMany(
          { id: { $in: oldUnitIndicatorIds }, tahun: yearNum },
          { $set: { penanggungJawab: null } }
        );

        await Renaksi.deleteMany({ employeeId: id, indicatorId: { $in: oldUnitIndicatorIds }, tahun: yearNum });

        const selection = await Selection.findOne({ employeeId: id, tahun: yearNum });
        if (selection && selection.selectedIndicators) {
          selection.selectedIndicators = selection.selectedIndicators.filter(indId => !oldUnitIndicatorIds.includes(indId));
          await selection.save();
        }

        for (const indicator of oldUnitIndicators) {
          const activeEmployeesInOldBidang = await Employee.find({ bidangs: oldBidang, isActive: true });
          const activePICIds = activeEmployeesInOldBidang.map(e => e.id);
          const activePICJabatans = activeEmployeesInOldBidang.filter(e => e.roles.includes('pemimpin')).map(e => `jabatan:${e.jabatan}`);

          const activePicCount = await CascadingAnnual.countDocuments({
            id: indicator.id,
            tahun: yearNum,
            $or: [
              { penanggungJawab: { $in: activePICIds } },
              { penanggungJawab: { $in: activePICJabatans } }
            ]
          });

          if (activePicCount === 0) {
            const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const newNotif = new Notification({
              id: notifId,
              bidang: oldBidang,
              message: `Pegawai ${emp.nama} telah pindah unit kerja ke ${bidangs[0]}. Indikator '${indicator.indikator}' (${indicator.text}) kini tidak memiliki penanggung jawab di bidang Anda.`
            });
            await newNotif.save();
          }
        }
      }
    }

    Object.assign(emp, payload);

    await EmployeeRepository.saveDocument(emp);

    if (payload.roles.includes('pemimpin') && payload.bidangs.length > 0) {
      const primaryBidang = payload.bidangs[0];
      if (primaryBidang && !payload.pltBidangs.includes(primaryBidang)) {
        await this._processPltHandover(emp.id, primaryBidang);
      }
    }

    return emp;
  }

  async deleteEmployee({ id, requesterRole }) {
    if (requesterRole !== 'admin') {
      const err = new Error('Akses ditolak. Hanya Administrator Sistem yang dapat melakukan manajemen user.');
      err.status = 403;
      throw err;
    }

    const emp = await EmployeeRepository.findOne({ id });
    if (!emp) {
      const err = new Error('Pegawai tidak ditemukan');
      err.status = 404;
      throw err;
    }

    // --- Role Deletion Validations ---
    if (emp.roles.includes('admin')) {
      const allAdmins = await EmployeeRepository.find({ roles: 'admin', isActive: true });
      if (allAdmins.length <= 1) {
        const err = new Error('Tidak dapat menonaktifkan Admin Sistem terakhir. Tunjuk pegawai lain sebagai Admin Sistem terlebih dahulu.');
        err.status = 400;
        throw err;
      }
    }

    if (emp.roles.includes('perencana')) {
      const allPerencana = await EmployeeRepository.find({ roles: 'perencana', isActive: true });
      if (allPerencana.length <= 1) {
        const err = new Error('Tidak dapat menonaktifkan Admin Perencana terakhir.');
        err.status = 400;
        throw err;
      }
    }

    if (emp.roles.includes('admin_bidang') && emp.bidangs && emp.bidangs.length > 0) {
      const bidang = emp.bidangs[0];
      const allAdminBidang = await EmployeeRepository.find({ roles: 'admin_bidang', bidangs: bidang, isActive: true });
      if (allAdminBidang.length <= 1) {
        const err = new Error(`Tidak dapat menonaktifkan Admin Unit Kerja terakhir untuk unit ${bidang}.`);
        err.status = 400;
        throw err;
      }
    }
    // ---------------------------------

    emp.isActive = false;
    await EmployeeRepository.saveDocument(emp);
    return true;
  }
  async resetPassword({ id, newPassword, requesterRole }) {
    if (requesterRole !== 'admin') {
      const err = new Error('Akses ditolak. Hanya Administrator Sistem yang dapat melakukan reset password.');
      err.status = 403;
      throw err;
    }

    if (!newPassword || newPassword.length < 6) {
      const err = new Error('Password baru wajib diisi minimal 6 karakter');
      err.status = 400;
      throw err;
    }

    const emp = await EmployeeRepository.findOne({ id });
    if (!emp) {
      const err = new Error('Pegawai tidak ditemukan');
      err.status = 404;
      throw err;
    }

    emp.password = newPassword;
    await EmployeeRepository.saveDocument(emp);
    return true;
  }

  async importEmployees({ fileBuffer, requesterRole }) {
    if (requesterRole !== 'admin') {
      const err = new Error('Akses ditolak. Hanya Administrator Sistem yang dapat mengimpor data.');
      err.status = 403;
      throw err;
    }

    const xlsx = await import('xlsx');
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      const err = new Error('File Excel kosong atau tidak terbaca.');
      err.status = 400;
      throw err;
    }

    // Detect column keys dynamically
    const firstRow = rows[0];
    let namaKey = '';
    let nipKey = '';
    let jabatanKey = '';
    let jenisJabatanKey = '';
    let pangkatKey = '';
    let roleKey = '';
    let atasanKey = '';
    let unitKey = '';

    Object.keys(firstRow).forEach(key => {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey.includes('nama')) namaKey = key;
      else if (lowerKey === 'nip' || lowerKey.includes('nomor induk') || lowerKey.includes('no induk')) nipKey = key;
      else if (lowerKey.includes('jenis jabatan') || lowerKey.includes('jenis_jabatan')) jenisJabatanKey = key;
      else if (lowerKey.includes('jabatan')) jabatanKey = key;
      else if (lowerKey.includes('pangkat') || lowerKey.includes('golongan') || lowerKey.includes('ruang')) pangkatKey = key;
      else if (lowerKey.includes('role') || lowerKey.includes('hak akses')) roleKey = key;
      else if (lowerKey.includes('atasan') || lowerKey.includes('nip atasan') || lowerKey.includes('supervisor')) atasanKey = key;
      else if (lowerKey === 'unit kerja' || lowerKey === 'unit_kerja') unitKey = key;
      else if ((lowerKey.includes('unit') || lowerKey.includes('bidang') || lowerKey.includes('bagian')) && !unitKey) unitKey = key;
    });

    // Fallbacks
    if (!namaKey) namaKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('nama')) || '';
    if (!nipKey) nipKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('nip')) || '';
    if (!jenisJabatanKey) jenisJabatanKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('jenis jabatan')) || '';
    if (!jabatanKey) jabatanKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('jabatan') && !k.toLowerCase().includes('jenis')) || '';
    if (!pangkatKey) pangkatKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('pangkat') || k.toLowerCase().includes('gol')) || '';
    if (!roleKey) roleKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('role')) || '';
    if (!atasanKey) atasanKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('atasan')) || '';
    if (!unitKey) unitKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('unit') || k.toLowerCase().includes('bidang')) || '';

    if (!namaKey || !nipKey || !jabatanKey) {
      const err = new Error('Format kolom NIP, Nama, atau Jabatan tidak terdeteksi pada file Excel.');
      err.status = 400;
      throw err;
    }

    // Role mapping helper
    const mapRole = (val) => {
      if (!val) return ['staff'];
      const clean = String(val).toLowerCase().trim();
      if (clean.includes('admin sistem') || clean === 'admin' || clean.includes('sistem')) return ['admin'];
      if (clean.includes('perencana')) return ['perencana'];
      if (clean.includes('admin bidang') || clean === 'admin_bidang') return ['admin_bidang'];
      if (clean.includes('pemimpin') || clean.includes('kepala') || clean === 'kabid' || clean === 'kasi') return ['pemimpin'];
      return ['staff'];
    };

    // Unit Kerja mapping helper
    const mapUnitKerja = (val) => {
      if (!val) return 'Sekretariat'; // default
      const clean = String(val).toLowerCase().trim();
      if (clean === 'badan' || clean.includes('kepala badan')) return 'Badan';
      if (clean.includes('sekretariat')) return 'Sekretariat';
      if (clean.includes('tata usaha') || clean === 'tu') return 'Tata Usaha';
      if (clean.includes('pencegahan') || clean.includes('kesiapsiagaan')) return 'Bidang Pencegahan dan Kesiapsiagaan';
      if (clean.includes('kedaruratan') || clean.includes('logistik')) return 'Bidang Kedaruratan dan Logistik';
      if (clean.includes('rehabilitasi') || clean.includes('rekonstruksi')) return 'Bidang Rehabilitasi dan Rekonstruksi';
      
      // Fallback
      return val; 
    };

    let createdCount = 0;
    let updatedCount = 0;

    const Employee = (await import('@/models/Employee')).default;

    // Pass 1: Create or update all employees (without parentId matching yet)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const nip = row[nipKey] ? String(row[nipKey]).trim() : '';
      const nama = row[namaKey] ? String(row[namaKey]).trim() : '';
      const jabatan = row[jabatanKey] ? String(row[jabatanKey]).trim() : '';
      const jenisJabatan = jenisJabatanKey && row[jenisJabatanKey] ? String(row[jenisJabatanKey]).trim() : 'JFU';
      const pangkatGolongan = pangkatKey && row[pangkatKey] ? String(row[pangkatKey]).trim() : '';
      const rawRole = roleKey && row[roleKey] ? String(row[roleKey]).trim() : '';
      const rawUnit = unitKey && row[unitKey] ? String(row[unitKey]).trim() : '';

      if (!nip || !nama || !jabatan) continue;

      const roles = mapRole(rawRole);
      
      let units = [];
      if (rawUnit) {
        units = rawUnit.split(',').map(u => mapUnitKerja(u.trim()));
      } else {
        units = [mapUnitKerja(rawUnit)];
      }

      // Auto compute scopeLeader for Pemimpin
      let scopeLeader = null;
      if (roles.includes('pemimpin')) {
        const primaryUnit = units[0] || '';
        if (primaryUnit === 'Badan') scopeLeader = 'Badan';
        else if (primaryUnit === 'Sekretariat') scopeLeader = 'Sekretariat';
        else if (primaryUnit === 'Tata Usaha') scopeLeader = 'Tata Usaha';
        else if (primaryUnit.startsWith('Bidang')) scopeLeader = 'Bidang';
      }

      // Check if employee already exists
      let emp = await EmployeeRepository.findOne({ nip });
      if (emp) {
        emp.nama = nama;
        emp.jabatan = jabatan;
        if (jenisJabatan) emp.jenisJabatan = jenisJabatan;
        emp.pangkatGolongan = pangkatGolongan;
        emp.roles = roles;
        emp.bidangs = units;
        emp.scopeLeader = scopeLeader;
        emp.isActive = true;
        await EmployeeRepository.saveDocument(emp);
        updatedCount++;
      } else {
        emp = new Employee({
          id: 'emp_' + Date.now() + '_' + i,
          nama,
          nip,
          jabatan,
          jenisJabatan,
          pangkatGolongan,
          roles,
          parentId: null, // Set in Pass 2
          bidangs: units,
          scopeLeader,
          isActive: true
        });
        await EmployeeRepository.saveDocument(emp);
        createdCount++;
      }
    }

    // Pass 2: Resolve parentId (Atasan) and enforce inheritance for non-leaders
    for (const row of rows) {
      const nip = row[nipKey] ? String(row[nipKey]).trim() : '';
      const nipAtasan = atasanKey && row[atasanKey] ? String(row[atasanKey]).trim() : '';

      if (!nip) continue;

      const emp = await EmployeeRepository.findOne({ nip });
      if (!emp) continue;

      let hasParent = false;
      if (nipAtasan) {
        const supervisor = await EmployeeRepository.findOne({ nip: nipAtasan });
        if (supervisor) {
          emp.parentId = supervisor.id;
          hasParent = true;
        }
      }

      if (!hasParent) {
        emp.parentId = null;
      }

      await EmployeeRepository.saveDocument(emp);
    }

    return { createdCount, updatedCount };
  }

  async getProfile(employeeId) {
    const emp = await EmployeeRepository.findOne({ id: employeeId });
    if (!emp) {
      const err = new Error('Pegawai tidak ditemukan');
      err.status = 404;
      throw err;
    }
    return {
      id: emp.id,
      nama: emp.nama,
      nip: emp.nip,
      jabatan: emp.jabatan,
      pangkatGolongan: emp.pangkatGolongan,
      roles: emp.roles,
      bidangs: emp.bidangs,
      signatureUrl: emp.signatureUrl,
      hasDigitalSignature: emp.hasDigitalSignature
    };
  }

  async updateProfileSignature(employeeId, data) {
    const emp = await EmployeeRepository.findOne({ id: employeeId });
    if (!emp) {
      const err = new Error('Pegawai tidak ditemukan');
      err.status = 404;
      throw err;
    }

    if (data.hasDigitalSignature !== undefined) {
      emp.hasDigitalSignature = Boolean(data.hasDigitalSignature);
    }
    if (data.signatureUrl !== undefined) {
      emp.signatureUrl = data.signatureUrl; // This can be a base64 string or URL
    }

    await EmployeeRepository.saveDocument(emp);
    
    return {
      id: emp.id,
      nama: emp.nama,
      signatureUrl: emp.signatureUrl,
      hasDigitalSignature: emp.hasDigitalSignature
    };
  }
}

const employeeService = new EmployeeService();
export default employeeService;
