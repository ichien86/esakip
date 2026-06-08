import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';
import { checkPlanningLock } from '@/lib/lock-check';

export async function GET() {
  await dbConnect();
  const data = await Cascading5Years.find({});
  const mapped = data.map(node => {
    let lvl = node.level;
    if (lvl === 'program') lvl = 'sasaran_program';
    else if (lvl === 'kegiatan') lvl = 'sasaran_kegiatan';
    else if (lvl === 'subkegiatan') lvl = 'sasaran_subkegiatan';
    else if (lvl === 'aktivitas') lvl = 'sasaran_aktivitas';

    let indicators = node.indicators || [];
    if (indicators.length === 0 && node.indikator && node.indikator !== '-') {
      indicators = [{
        id: `ind_mig_${node.id}`,
        indikator: node.indikator,
        satuan: node.satuan || '-',
        tipeTarget: node.tipeTarget || 'Kondisi Akhir Naik',
        target2025: node.target2025 || '0',
        target2026: node.target2026 || '0',
        target2027: node.target2027 || '0',
        target2028: node.target2028 || '0',
        target2029: node.target2029 || '0',
        target2030: node.target2030 || '0',
        targetAkhir: node.targetAkhir || '0'
      }];
    }

    return {
      ...node.toObject(),
      level: lvl,
      indicators,
      sasaran: node.sasaran || node.sasaranSubkegiatan || '',
      nomenklatur: node.nomenklatur || (['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan'].includes(lvl) ? node.text : '')
    };
  });
  return NextResponse.json(mapped);
}

export async function POST(request) {
  try {
    await dbConnect();
    const lockResponse = await checkPlanningLock(request);
    if (lockResponse) return lockResponse;

    const body = await request.json();
    const {
      id, level, text, indikator, satuan, tipeTarget, parentId, bidangPengampu,
      crossCuttingType, splitTargets,
      target2025, target2026, target2027, target2028, target2029, target2030, targetAkhir,
      anggaran2025, anggaran2026, anggaran2027, anggaran2028, anggaran2029, anggaran2030, anggaranAkhir,
      requesterRole, requesterBidang,
      sasaranSubkegiatan, definisiOperasional, metodePenghitungan, variabelJumlah, variabelPembilang, variabelPenyebut,
      sasaran, nomenklatur, indicators, masterId
    } = body;

    const finalBidang = Array.isArray(bidangPengampu) ? bidangPengampu : (bidangPengampu ? [bidangPengampu] : []);

    if (!level || !text || finalBidang.length === 0) {
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

    // Validate global uniqueness for subkegiatan masterId
    if (level === 'sasaran_subkegiatan' || level === 'subkegiatan') {
      if (masterId) {
        const existingSubkeg = await Cascading5Years.findOne({
          masterId: masterId,
          id: { $ne: itemId }
        });
        if (existingSubkeg) {
          return NextResponse.json({ error: 'Subkegiatan ini sudah digunakan di bagian lain dan tidak boleh diduplikasi.' }, { status: 400 });
        }
      }
    }

    let item = await Cascading5Years.findOne({ id: itemId });
    const updateObj = {
      id: itemId,
      level,
      text,
      indikator: indikator || '-',
      satuan: satuan || '-',
      tipeTarget: tipeTarget || 'Kondisi Akhir Naik',
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
      variabelPenyebut: variabelPenyebut || '',
      sasaran: sasaran || '',
      nomenklatur: nomenklatur || '',
      indicators: indicators || [],
      masterId: masterId || null
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
