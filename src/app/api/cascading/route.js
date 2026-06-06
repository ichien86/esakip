import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CascadingAnnual from '@/models/CascadingAnnual';

export async function GET() {
  await dbConnect();
  const data = await CascadingAnnual.find({});
  return NextResponse.json(data);
}

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const {
      id, level, text, indikator, target, satuan, tipeTarget, parentId, bidangPengampu,
      crossCuttingType, splitTargets, tahun,
      requesterRole, requesterBidang,
      sasaranSubkegiatan, definisiOperasional, metodePenghitungan, variabelJumlah, variabelPembilang, variabelPenyebut,
      masterId, anggaran
    } = body;

    const finalBidang = Array.isArray(bidangPengampu) ? bidangPengampu : (bidangPengampu ? [bidangPengampu] : []);

    if (!level || !text || !indikator || !target || !satuan || finalBidang.length === 0 || !tipeTarget) {
      return NextResponse.json({ error: 'Data cascading tidak lengkap' }, { status: 400 });
    }

    if (requesterRole === 'admin_bidang') {
      if (level === 'tujuan' || level === 'sasaran') {
        return NextResponse.json({ error: 'Hanya Administrator Sistem yang dapat mengubah Tujuan & Sasaran Makro.' }, { status: 403 });
      }
      const hasAccess = finalBidang.every(b => requesterBidang === b);
      if (!hasAccess) {
        return NextResponse.json({ error: `Anda hanya dapat mengelola cascading pengampuan bidang Anda (${requesterBidang})` }, { status: 403 });
      }
    }

    const itemId = id || `${level.substring(0, 3)}_${Date.now()}`;

    let item = await CascadingAnnual.findOne({ id: itemId });
    const updateObj = {
      id: itemId,
      level,
      text,
      indikator,
      target,
      satuan,
      tipeTarget,
      parentId: parentId || null,
      bidangPengampu: finalBidang,
      crossCuttingType: crossCuttingType || 'shared',
      splitTargets: splitTargets || {},
      tahun: tahun || 2026,
      sasaranSubkegiatan: sasaranSubkegiatan || '',
      definisiOperasional: definisiOperasional || '',
      metodePenghitungan: metodePenghitungan || 'Jumlah',
      variabelJumlah: variabelJumlah || '',
      variabelPembilang: variabelPembilang || '',
      variabelPenyebut: variabelPenyebut || '',
      masterId: masterId || null,
      anggaran: anggaran || 0
    };

    if (item) {
      Object.assign(item, updateObj);
      await item.save();
    } else {
      item = new CascadingAnnual(updateObj);
      await item.save();
    }

    return NextResponse.json({ message: 'Cascading berhasil disimpan', data: item });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
