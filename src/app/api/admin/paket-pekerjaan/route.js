import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PaketPekerjaan from '@/models/PaketPekerjaan';
import Setting from '@/models/Setting';


export async function GET(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const tahun = parseInt(searchParams.get('tahun') || '2026');
    const subkegiatanId = searchParams.get('subkegiatanId');
    const bidang = searchParams.get('bidang');

    const query = { tahun };
    if (subkegiatanId) query.subkegiatanId = subkegiatanId;
    
    // Only filter by bidang if it's explicitly provided and role requires it
    const role = searchParams.get('role');
    if (role === 'admin_bidang' && bidang && bidang !== 'undefined') {
      query.bidangPengampu = bidang;
    }

    const pakets = await PaketPekerjaan.find(query).sort({ namaSubkegiatan: 1, namaPaket: 1 });
    
    // Fetch lock status
    const lockSetting = await Setting.findOne({ key: 'target_fisik_locked' });
    const isLocked = lockSetting?.value === true;

    return NextResponse.json({ pakets, isLocked });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { tahun, subkegiatanId, namaSubkegiatan, namaPaket, paguAnggaran } = body;

    const id = crypto.randomUUID();
    const paket = await PaketPekerjaan.create({
      id,
      tahun,
      subkegiatanId,
      namaSubkegiatan,
      namaPaket,
      paguAnggaran: parseFloat(paguAnggaran) || 0,
      targetFisik: {},
      realisasiFisik: {},
      realisasiAnggaran: {},
      evaluasiBulanan: [],
    });

    return NextResponse.json({ message: 'Paket pekerjaan berhasil dibuat', data: paket });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id, ...updateData } = body;

    const paket = await PaketPekerjaan.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true }
    );

    if (!paket) return NextResponse.json({ error: 'Paket tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ message: 'Paket berhasil diperbarui', data: paket });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await PaketPekerjaan.findOneAndDelete({ id });
    return NextResponse.json({ message: 'Paket berhasil dihapus' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
