import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';
import Cascading5Years from '@/models/Cascading5Years';
import CascadingAnnual from '@/models/CascadingAnnual';
import MasterProgram from '@/models/MasterProgram';
import MasterKegiatan from '@/models/MasterKegiatan';
import MasterSubkegiatan from '@/models/MasterSubkegiatan';
import Selection from '@/models/Selection';
import Renaksi from '@/models/Renaksi';
import Performance from '@/models/Performance';

export async function GET(request) {
  try {
    await dbConnect();

    const dbPath = path.join(process.cwd(), 'legacy', 'db.json');
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Legacy db.json not found in legacy/ directory' }, { status: 404 });
    }

    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    await Employee.deleteMany({});
    await Cascading5Years.deleteMany({});
    await CascadingAnnual.deleteMany({});
    await MasterProgram.deleteMany({});
    await MasterKegiatan.deleteMany({});
    await MasterSubkegiatan.deleteMany({});
    await Selection.deleteMany({});
    await Renaksi.deleteMany({});
    await Performance.deleteMany({});

    const employeesToInsert = (data.employees || []).map(emp => {
      let roles = [emp.role];
      let bidangs = [emp.bidang];
      
      if (emp.id === 'admin') {
        roles = ['admin', 'admin_bidang'];
        bidangs = ['Sekretariat', 'Pencegahan & Kesiapsiagaan', 'Kedaruratan & Logistik', 'Rehabilitasi & Rekonstruksi', 'Pimpinan'];
      } else if (emp.role === 'admin_bidang') {
        roles = ['admin_bidang', 'kasi'];
      }

      return {
        id: emp.id,
        nama: emp.nama,
        nip: emp.nip,
        jabatan: emp.jabatan,
        roles,
        parentId: emp.parentId,
        bidangs
      };
    });
    await Employee.insertMany(employeesToInsert);

    const c5ToInsert = (data.cascading5Years || []).map(c5 => {
      return {
        id: c5.id,
        level: c5.level,
        text: c5.text,
        indikator: c5.indikator,
        satuan: c5.satuan,
        tipeTarget: c5.tipeTarget || 'Kondisi Akhir Naik',
        parentId: c5.parentId,
        bidangPengampu: [c5.bidangPengampu],
        crossCuttingType: 'shared',
        splitTargets: {},
        target2025: c5.target2025 || '0',
        target2026: c5.target2026 || '0',
        target2027: c5.target2027 || '0',
        target2028: c5.target2028 || '0',
        target2029: c5.target2029 || '0',
        target2030: c5.target2030 || '0',
        targetAkhir: c5.targetAkhir || '0',
        anggaran2025: '0',
        anggaran2026: '0',
        anggaran2027: '0',
        anggaran2028: '0',
        anggaran2029: '0',
        anggaran2030: '0',
        anggaranAkhir: '0'
      };
    });
    await Cascading5Years.insertMany(c5ToInsert);

    const cAnnualToInsert = (data.cascading || []).map(ca => {
      return {
        id: ca.id,
        level: ca.level,
        text: ca.text,
        indikator: ca.indikator,
        target: ca.target,
        satuan: ca.satuan,
        tipeTarget: ca.tipeTarget || 'Kondisi Akhir Naik',
        parentId: ca.parentId,
        bidangPengampu: [ca.bidangPengampu],
        crossCuttingType: 'shared',
        splitTargets: {},
        tahun: 2026
      };
    });
    await CascadingAnnual.insertMany(cAnnualToInsert);

    await MasterProgram.insertMany(data.masterProgram || []);
    await MasterKegiatan.insertMany(data.masterKegiatan || []);
    await MasterSubkegiatan.insertMany(data.masterSubkegiatan || []);

    await Selection.insertMany(data.selections || []);

    const renaksiToInsert = (data.renaksi || []).map(rx => {
      const emp = data.employees.find(e => e.id === rx.employeeId);
      return {
        id: rx.id,
        employeeId: rx.employeeId,
        bidang: emp ? emp.bidang : '',
        tahun: rx.tahun || 2026,
        indicatorId: rx.indicatorId,
        bulan: rx.bulan,
        targetBulanan: rx.targetBulanan || 0,
        realisasiBulanan: rx.realisasiBulanan,
        tanggalRealisasi: rx.tanggalRealisasi || null,
        buktiDukung: rx.buktiDukung || '',
        kendala: rx.kendala || '',
        solusi: rx.solusi || '',
        faktorPendorong: rx.faktorPendorong || '',
        inovasi: rx.inovasi || '',
        status: rx.status || 'Draft'
      };
    });
    await Renaksi.insertMany(renaksiToInsert);

    const perfToInsert = (data.performances || []).map(p => {
      return {
        id: p.id,
        employeeId: p.employeeId,
        tahun: p.tahun || 2026,
        status: p.status || 'Draft',
        targetIKU: p.targetIKU || [],
        evaluasiAtasan: p.evaluasiAtasan || {
          evaluatorId: null,
          skorAKIP: null,
          predikat: null,
          catatan: '',
          tanggalEvaluasi: null
        }
      };
    });
    await Performance.insertMany(perfToInsert);

    return NextResponse.json({
      message: 'Seeding database successful!',
      counts: {
        employees: employeesToInsert.length,
        cascading5Years: c5ToInsert.length,
        cascadingAnnual: cAnnualToInsert.length,
        masterProgram: (data.masterProgram || []).length,
        masterKegiatan: (data.masterKegiatan || []).length,
        masterSubkegiatan: (data.masterSubkegiatan || []).length,
        selections: (data.selections || []).length,
        renaksi: renaksiToInsert.length,
        performances: perfToInsert.length
      }
    });
  } catch (error) {
    console.error('Seeding error:', error);
    return NextResponse.json({ error: 'Failed to seed database', details: error.message }, { status: 500 });
  }
}
