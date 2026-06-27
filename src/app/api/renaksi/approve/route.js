import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';
import { getValidatedUser } from '@/lib/api-auth';

export async function POST(request) {
  try {
    await dbConnect();
    const { id } = await request.json();
    const { role: requesterRole } = getValidatedUser(request, request.headers.get('x-requester-role'));

    const record = await Renaksi.findOne({ id });
    if (!record) {
      return NextResponse.json({ error: 'Data renaksi tidak ditemukan' }, { status: 404 });
    }

    if (requesterRole === 'admin_bidang') {
      if (record.status !== 'Diajukan') {
        return NextResponse.json({ error: 'Realisasi harus berstatus Diajukan sebelum di-ACC oleh Admin Bidang' }, { status: 400 });
      }
      record.status = 'ACC_Admin';
      record.isCrossCuttingSelected = true;
      await record.save();

      // Set other employees' records in the same bidang/indicator/month/year to isCrossCuttingSelected = false
      await Renaksi.updateMany(
        {
          id: { $ne: record.id },
          indicatorId: record.indicatorId,
          tahun: record.tahun,
          bulan: record.bulan,
          bidang: record.bidang
        },
        { $set: { isCrossCuttingSelected: false } }
      );
    } else if (requesterRole === 'pemimpin') {
      if (record.status !== 'ACC_Admin') {
        return NextResponse.json({ error: 'Realisasi harus di-ACC oleh Admin Bidang sebelum divalidasi oleh Pemimpin' }, { status: 400 });
      }
      record.status = 'Disetujui';
      await record.save();
    } else if (requesterRole === 'perencana') {
      record.status = 'Disetujui';
      record.isCrossCuttingSelected = true;
      await record.save();

      // Set other employees' records for the same indicator/month/year across agency to isCrossCuttingSelected = false
      await Renaksi.updateMany(
        {
          id: { $ne: record.id },
          indicatorId: record.indicatorId,
          tahun: record.tahun,
          bulan: record.bulan
        },
        { $set: { isCrossCuttingSelected: false } }
      );
    } else {
      // Super admin bypass
      record.status = 'Disetujui';
      await record.save();
    }

    return NextResponse.json({ message: `Realisasi disetujui dengan status ${record.status}`, data: record });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
