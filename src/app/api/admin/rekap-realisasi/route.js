import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';
import Employee from '@/models/Employee';
import { getValidatedUser } from '@/lib/api-auth';
import IndicatorAnnual from '@/models/IndicatorAnnual';

export async function GET(request) {
  try {
    await dbConnect();
    const { role: requesterRole, user } = getValidatedUser(request, request.headers.get('x-requester-role'));

    if (!['admin', 'perencana', 'admin_bidang'].includes(requesterRole)) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tahunParam = searchParams.get('tahun');
    const bulanParam = searchParams.get('bulan');

    if (!tahunParam) {
       return NextResponse.json({ error: 'Parameter tahun wajib diisi.' }, { status: 400 });
    }
    const tahun = parseInt(tahunParam);

    let query = { 
      tahun,
      realisasiBulanan: { $ne: null, $exists: true } 
    };
    if (bulanParam) {
      query.bulan = parseInt(bulanParam);
    }

    const renaksiRecords = await Renaksi.find(query).lean();

    if (renaksiRecords.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Ambil daftar unique Ids
    const employeeIds = [...new Set(renaksiRecords.map(r => r.employeeId))];
    const indicatorIds = [...new Set(renaksiRecords.map(r => r.indicatorId))];
    
    // Fetch relasi
    const employees = await Employee.find({ id: { $in: employeeIds } }).lean();
    const indicators = await IndicatorAnnual.find({ id: { $in: indicatorIds } }).lean();

    // Mapping
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });

    const indMap = {};
    indicators.forEach(i => { indMap[i.id] = i; });

    // Gabungkan data (satu capaian utuh per pengampu per indikator)
    let result = renaksiRecords.map(r => {
      const emp = empMap[r.employeeId] || {};
      const ind = indMap[r.indicatorId] || {};
      
      let targetTahunan = ind.target || 0;
      if (ind.crossCuttingType === 'split' && ind.splitTargets && ind.splitTargets[r.employeeId]) {
        targetTahunan = ind.splitTargets[r.employeeId];
      }

      return {
        _id: r._id,
        employeeName: emp.namaLengkap || r.employeeId,
        jabatan: emp.jabatan || '-',
        bidang: emp.bidang || '-',
        indicatorName: ind.name || '-',
        indicatorSatuan: ind.satuan || '-',
        tahun: r.tahun,
        bulan: r.bulan,
        targetTahunan: targetTahunan,
        targetBulanan: r.targetBulanan || 0,
        capaianBulanan: r.realisasiBulanan, // Ini sudah digabungkan menjadi satu capaian persentase/nilai mutlak (lihat RenaksiService)
        kendala: r.kendala || '-',
        status: r.status || '-',
        // Flatten buktiDukung url array untuk kemudahan
        buktiDukung: r.variablesRealization ? 
            r.variablesRealization.flatMap(v => {
               try {
                  const parsed = JSON.parse(v.buktiDukung || '[]');
                  return parsed.map(f => f.url).filter(u => u);
               } catch (e) { return []; }
            }) : []
      };
    });

    // Filter berdasarkan role
    if (requesterRole === 'admin_bidang') {
      const adminBidangName = user?.bidang;
      if (!adminBidangName) {
         return NextResponse.json({ error: 'Data bidang admin tidak valid.' }, { status: 400 });
      }
      result = result.filter(r => r.bidang === adminBidangName);
    }

    // Urutkan (Tahun DESC, Bulan ASC, Nama ASC)
    result.sort((a, b) => {
      if (a.tahun !== b.tahun) return b.tahun - a.tahun;
      if (a.bulan !== b.bulan) return a.bulan - b.bulan;
      return a.employeeName.localeCompare(b.employeeName);
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
