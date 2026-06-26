import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PaketPekerjaan from '@/models/PaketPekerjaan';

const BULAN_KEY = ['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];

// POST: Simpan realisasi fisik bulanan + evaluasi untuk satu bulan
export async function POST(request) {
  try {
    await dbConnect();
    const { items, bulan } = await request.json();
    // items = [{ id, realisasiFisik, faktorPenghambat, faktorPendorong, alasanTidakTercapai }]

    const bulanKey = BULAN_KEY[bulan - 1];

    for (const item of items) {
      // Update realisasi fisik bulan ini
      const realisasiUpdate = {};
      realisasiUpdate[`realisasiFisik.${bulanKey}`] = parseFloat(item.realisasiFisik) || 0;

      // Remove existing evaluasi for this bulan and re-insert
      await PaketPekerjaan.updateOne(
        { id: item.id },
        {
          $set: realisasiUpdate,
          $pull: { evaluasiBulanan: { bulan } }
        }
      );

      const evaluasi = {
        bulan,
        faktorPenghambat: item.faktorPenghambat || '',
        faktorPendorong: item.faktorPendorong || '',
        alasanTidakTercapai: item.alasanTidakTercapai || '',
      };

      await PaketPekerjaan.updateOne(
        { id: item.id },
        { $push: { evaluasiBulanan: evaluasi } }
      );
    }

    return NextResponse.json({ message: 'Realisasi fisik berhasil disimpan' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
