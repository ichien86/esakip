import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function POST(request) {
  try {
    await dbConnect();

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type harus multipart/form-data.' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const requesterRole = request.headers.get('x-requester-role') || '';

    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Administrator Sistem yang dapat mengimpor data.' }, { status: 403 });
    }

    if (!file) {
      return NextResponse.json({ error: 'File Excel tidak ditemukan.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong atau tidak terbaca.' }, { status: 400 });
    }

    // Detect column keys dynamically
    const firstRow = rows[0];
    let namaKey = '';
    let nipKey = '';
    let jabatanKey = '';
    let pangkatKey = '';
    let roleKey = '';
    let atasanKey = '';
    let unitKey = '';

    Object.keys(firstRow).forEach(key => {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey.includes('nama')) namaKey = key;
      else if (lowerKey === 'nip' || lowerKey.includes('nomor induk') || lowerKey.includes('no induk')) nipKey = key;
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
    if (!jabatanKey) jabatanKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('jabatan')) || '';
    if (!pangkatKey) pangkatKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('pangkat') || k.toLowerCase().includes('gol')) || '';
    if (!roleKey) roleKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('role')) || '';
    if (!atasanKey) atasanKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('atasan')) || '';
    if (!unitKey) unitKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('unit') || k.toLowerCase().includes('bidang')) || '';

    if (!namaKey || !nipKey || !jabatanKey) {
      return NextResponse.json({ error: 'Format kolom NIP, Nama, atau Jabatan tidak terdeteksi pada file Excel.' }, { status: 400 });
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

    // Pass 1: Create or update all employees (without parentId matching yet)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const nip = row[nipKey] ? String(row[nipKey]).trim() : '';
      const nama = row[namaKey] ? String(row[namaKey]).trim() : '';
      const jabatan = row[jabatanKey] ? String(row[jabatanKey]).trim() : '';
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
      let emp = await Employee.findOne({ nip });
      if (emp) {
        emp.nama = nama;
        emp.jabatan = jabatan;
        emp.pangkatGolongan = pangkatGolongan;
        emp.roles = roles;
        emp.bidangs = units;
        emp.scopeLeader = scopeLeader;
        emp.isActive = true;
        await emp.save();
        updatedCount++;
      } else {
        emp = new Employee({
          id: 'emp_' + Date.now() + '_' + i,
          nama,
          nip,
          jabatan,
          pangkatGolongan,
          roles,
          parentId: null, // Set in Pass 2
          bidangs: units,
          scopeLeader,
          isActive: true
        });
        await emp.save();
        createdCount++;
      }
    }

    // Pass 2: Resolve parentId (Atasan) and enforce inheritance for non-leaders
    for (const row of rows) {
      const nip = row[nipKey] ? String(row[nipKey]).trim() : '';
      const nipAtasan = atasanKey && row[atasanKey] ? String(row[atasanKey]).trim() : '';

      if (!nip) continue;

      const emp = await Employee.findOne({ nip });
      if (!emp) continue;

      let hasParent = false;
      if (nipAtasan) {
        const supervisor = await Employee.findOne({ nip: nipAtasan });
        if (supervisor) {
          emp.parentId = supervisor.id;
          hasParent = true;
          
        }
      }

      if (!hasParent) {
        emp.parentId = null;
      }

      await emp.save();
    }

    return NextResponse.json({
      message: 'Impor pegawai berhasil diselesaikan',
      createdCount,
      updatedCount
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
