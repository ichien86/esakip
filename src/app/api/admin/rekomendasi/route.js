import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';
import Employee from '@/models/Employee';
import { getValidatedUser } from '@/lib/api-auth';

export async function GET(request) {
  try {
    await dbConnect();
    const { role: requesterRole, user } = getValidatedUser(request, request.headers.get('x-requester-role'));

    if (!['admin', 'perencana', 'admin_bidang'].includes(requesterRole)) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tahunParam = searchParams.get('tahun');

    // Filter dokumen renaksi yang memiliki statusRekomendasi selain Kosong
    let query = {
      statusRekomendasi: { $ne: 'Kosong' }
    };

    if (tahunParam) {
      query.tahun = parseInt(tahunParam);
    }

    const renaksiRecords = await Renaksi.find(query).lean();

    if (renaksiRecords.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Ambil daftar employeeId dari hasil query
    const employeeIds = [...new Set(renaksiRecords.map(r => r.employeeId))];
    
    // Fetch data employee
    const employees = await Employee.find({ id: { $in: employeeIds } }).lean();
    
    // Mapping employee
    const empMap = {};
    employees.forEach(e => {
      empMap[e.id] = e;
    });

    // Gabungkan data
    let result = renaksiRecords.map(r => {
      const emp = empMap[r.employeeId] || {};
      return {
        ...r,
        employeeName: emp.namaLengkap || r.employeeId,
        jabatan: emp.jabatan || '-',
        bidang: emp.bidang || '-'
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

    // Urutkan (Tahun DESC, Bulan DESC, Nama ASC)
    result.sort((a, b) => {
      if (b.tahun !== a.tahun) return b.tahun - a.tahun;
      if (b.bulan !== a.bulan) return b.bulan - a.bulan;
      return a.employeeName.localeCompare(b.employeeName);
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
