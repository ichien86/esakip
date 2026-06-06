import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';

export async function GET() {
  await dbConnect();
  const data = await Cascading5Years.find({});
  return NextResponse.json(data);
}

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const {
      id, level, text, indikator, satuan, tipeTarget, parentId, bidangPengampu,
      crossCuttingType, splitTargets,
      target2025, target2026, target2027, target2028, target2029, target2030, targetAkhir,
      anggaran2025, anggaran2026, anggaran2027, anggaran2028, anggaran2029, anggaran2030, anggaranAkhir,
      requesterRole, requesterBidang,
      sasaranSubkegiatan, definisiOperasional, metodePenghitungan, variabelJumlah, variabelPembilang, variabelPenyebut
    } = body;

    const finalBidang = Array.isArray(bidangPengampu) ? bidangPengampu : (bidangPengampu ? [bidangPengampu] : []);

    if (!level || !text || !indikator || !satuan || finalBidang.length === 0 || !tipeTarget) {
      return NextResponse.json({ error: 'Data cascading 5 tahunan tidak lengkap' }, { status: 400 });
    }

    if (requesterRole === 'admin_bidang') {
      if (level === 'tujuan') {
        return NextResponse.json({ error: 'Hanya Administrator Sistem yang dapat mengelola Tujuan Strategis.' }, { status: 403 });
      }
      const hasAccess = finalBidang.every(b => requesterBidang === b);
      if (!hasAccess) {
        return NextResponse.json({ error: `Anda hanya dapat mengelola cascading pengampuan bidang Anda (${requesterBidang})` }, { status: 403 });
      }
    }

    const itemId = id || `5y_${level.substring(0, 3)}_${Date.now()}`;

    let item = await Cascading5Years.findOne({ id: itemId });
    const updateObj = {
      id: itemId,
      level,
      text,
      indikator,
      satuan,
      tipeTarget,
      parentId: parentId || null,
      bidangPengampu: finalBidang,
      crossCuttingType: crossCuttingType || 'shared',
      splitTargets: splitTargets || {},
      target2025: target2025 || '0',
      target2026: target2026 || '0',
      target2027: target2027 || '0',
      target2028: target2028 || '0',
      target2029: target2029 || '0',
      target2030: target2030 || '0',
      targetAkhir: targetAkhir || '0',
      anggaran2025: anggaran2025 || '0',
      anggaran2026: anggaran2026 || '0',
      anggaran2027: anggaran2027 || '0',
      anggaran2028: anggaran2028 || '0',
      anggaran2029: anggaran2029 || '0',
      anggaran2030: anggaran2030 || '0',
      anggaranAkhir: anggaranAkhir || '0',
      sasaranSubkegiatan: sasaranSubkegiatan || '',
      definisiOperasional: definisiOperasional || '',
      metodePenghitungan: metodePenghitungan || 'Jumlah',
      variabelJumlah: variabelJumlah || '',
      variabelPembilang: variabelPembilang || '',
      variabelPenyebut: variabelPenyebut || ''
    };

    if (item) {
      Object.assign(item, updateObj);
      await item.save();
    } else {
      item = new Cascading5Years(updateObj);
      await item.save();
    }

    return NextResponse.json({ message: 'Cascading 5 Tahunan berhasil disimpan', data: item });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
