import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function POST(request) {
  try {
    await dbConnect();
    const { nip, password } = await request.json();

    if (!nip || !password) {
      return NextResponse.json({ error: 'NIP/ID dan Password wajib diisi' }, { status: 400 });
    }

    // Allow lookup by NIP or custom ID (e.g. 'admin', 'perencana')
    const employee = await Employee.findOne({
      $or: [
        { nip: nip },
        { id: nip }
      ]
    });

    if (!employee) {
      return NextResponse.json({ error: 'NIP/ID tidak terdaftar' }, { status: 401 });
    }

    if (employee.isActive === false) {
      return NextResponse.json({ error: 'Akun Anda dinonaktifkan. Silakan hubungi Administrator.' }, { status: 401 });
    }

    if (employee.password !== password) {
      return NextResponse.json({ error: 'Password salah' }, { status: 401 });
    }

    let bidangs = employee.bidangs;
    if (employee.roles.includes('admin') || employee.roles.includes('perencana')) {
      bidangs = ['Sekretariat', 'Pencegahan & Kesiapsiagaan', 'Kedaruratan & Logistik', 'Rehabilitasi & Rekonstruksi', 'Pimpinan'];
    } else if (employee.parentId) {
      const supervisor = await Employee.findOne({ id: employee.parentId });
      if (supervisor) {
        bidangs = supervisor.bidangs;
      }
    }

    let warningsCount = 0;
    try {
      const CascadingAnnual = (await import('@/models/CascadingAnnual')).default;
      const MasterProgram = (await import('@/models/MasterProgram')).default;
      const MasterKegiatan = (await import('@/models/MasterKegiatan')).default;
      const MasterSubkegiatan = (await import('@/models/MasterSubkegiatan')).default;

      // Query only nodes that belong to the user's bidangs
      const annualNodes = await CascadingAnnual.find({ bidangPengampu: { $in: bidangs }, masterId: { $ne: null } });
      const masterPrograms = await MasterProgram.find({});
      const masterKegiatans = await MasterKegiatan.find({});
      const masterSubkegiatans = await MasterSubkegiatan.find({});

      const progMap = new Map(masterPrograms.map(p => [p.id, p]));
      const kegMap = new Map(masterKegiatans.map(k => [k.id, k]));
      const subMap = new Map(masterSubkegiatans.map(s => [s.id, s]));

      for (const node of annualNodes) {
        if (node.level === 'program' || node.level === 'sasaran_program') {
          const master = progMap.get(node.masterId);
          if (master && node.text !== master.nama) warningsCount++;
        } else if (node.level === 'kegiatan' || node.level === 'sasaran_kegiatan') {
          const master = kegMap.get(node.masterId);
          if (master && node.text !== master.nama) warningsCount++;
        } else if (node.level === 'subkegiatan' || node.level === 'sasaran_subkegiatan') {
          const master = subMap.get(node.masterId);
          if (master && (node.text !== master.nama || node.indikator !== master.indikator || node.satuan !== master.satuan)) warningsCount++;
        }
      }
    } catch (e) {
      console.error('Failed to calculate warningsCount during login', e);
    }

    return NextResponse.json({
      message: 'Login berhasil',
      user: {
        id: employee.id,
        nama: employee.nama,
        nip: employee.nip,
        jabatan: employee.jabatan,
        roles: employee.roles,
        parentId: employee.parentId,
        bidangs: bidangs,
        warningsCount
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
