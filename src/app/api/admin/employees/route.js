import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { nama, nip, jabatan, pangkatGolongan, roles, parentId, bidangs, requesterRole } = body;

    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Administrator Sistem yang dapat mengelola manajemen user.' }, { status: 403 });
    }

    const finalRoles = Array.isArray(roles) ? roles : (body.role ? [body.role] : []);
    let finalBidangs = Array.isArray(bidangs) ? bidangs : (body.bidang ? [body.bidang] : []);

    if (!nama || !nip || !jabatan || finalRoles.length === 0 || finalBidangs.length === 0) {
      return NextResponse.json({ error: 'Field nama, NIP, jabatan, role, dan unit kerja wajib diisi' }, { status: 400 });
    }

    let finalScopeLeader = null;
    if (finalRoles.includes('pemimpin')) {
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

    const newEmp = new Employee({
      id: 'emp_' + Date.now(),
      nama,
      nip,
      jabatan,
      pangkatGolongan: pangkatGolongan || '',
      roles: finalRoles,
      parentId: parentId || null,
      bidangs: finalBidangs,
      scopeLeader: finalScopeLeader
    });

    await newEmp.save();
    return NextResponse.json({ message: 'Pegawai berhasil ditambahkan', employee: newEmp });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
