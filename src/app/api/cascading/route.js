import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CascadingAnnual from '@/models/CascadingAnnual';
import Cascading5Years from '@/models/Cascading5Years';
import { checkPlanningLock } from '@/lib/lock-check';

import { resolveTreePICs } from '@/lib/pic-resolver';

export async function GET() {
  await dbConnect();
  const data = await CascadingAnnual.find({});
  const resolvedData = resolveTreePICs(data);
  const mapped = resolvedData.map(node => {
    let lvl = node.level;
    if (lvl === 'program') lvl = 'sasaran_program';
    else if (lvl === 'kegiatan') lvl = 'sasaran_kegiatan';
    else if (lvl === 'subkegiatan') lvl = 'sasaran_subkegiatan';
    else if (lvl === 'aktivitas') lvl = 'sasaran_aktivitas';
    if (lvl === 'indikator_tujuan' || lvl === 'indikator_sasaran') return null;

    let indicators = node.indicators || [];
    if (indicators.length === 0 && node.indikator && node.indikator !== '-') {
      indicators = [{
        id: `ind_mig_${node.id}`,
        indikator: node.indikator,
        satuan: node.satuan || '-',
        tipeTarget: node.tipeTarget || 'Kondisi Akhir Naik',
        target: node.target || '0'
      }];
    }

    return {
      ...node,
      level: lvl,
      indicators,
      sasaran: node.sasaran || node.sasaranSubkegiatan || '',
      nomenklatur: node.nomenklatur || (['sasaran_program', 'sasaran_kegiatan', 'sasaran_subkegiatan'].includes(lvl) ? node.text : '')
    };
  }).filter(Boolean);
  return NextResponse.json(mapped);
}

export async function POST(request) {
  try {
    await dbConnect();
    const lockResponse = await checkPlanningLock(request);
    if (lockResponse) return lockResponse;

    const body = await request.json();
    const {
      id, level, text, indikator, target, satuan, tipeTarget, parentId, bidangPengampu,
      crossCuttingType, splitTargets, tahun,
      requesterRole, requesterBidang,
      sasaranSubkegiatan, definisiOperasional, metodePenghitungan, variabelJumlah, variabelPembilang, variabelPenyebut,
      masterId, anggaran, anggaranDpa, sasaran, nomenklatur, indicators
    } = body;

    const finalBidang = Array.isArray(bidangPengampu) ? bidangPengampu : (bidangPengampu ? [bidangPengampu] : []);

    if (!level || !text || finalBidang.length === 0) {
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

    // Validate global uniqueness for subkegiatan masterId
    if (level === 'sasaran_subkegiatan' || level === 'subkegiatan') {
      if (masterId) {
        const existingSubkeg = await CascadingAnnual.findOne({
          masterId: masterId,
          tahun: tahun || 2026,
          id: { $ne: itemId }
        });
        if (existingSubkeg) {
          return NextResponse.json({ error: 'Subkegiatan ini sudah digunakan di bagian lain untuk tahun ini dan tidak boleh diduplikasi.' }, { status: 400 });
        }
      }
    }

    let item = await CascadingAnnual.findOne({ id: itemId });
    const updateObj = {
      id: itemId,
      level,
      text,
      indikator: indikator || '-',
      target: target || '0',
      satuan: satuan || '-',
      tipeTarget: tipeTarget || 'Kondisi Akhir Naik',
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
      anggaran: anggaran || 0,
      anggaranDpa: anggaranDpa || 0,
      sasaran: sasaran || '',
      nomenklatur: nomenklatur || '',
      indicators: indicators || []
    };

    if (item) {
      Object.assign(item, updateObj);
      await item.save();
    } else {
      item = new CascadingAnnual(updateObj);
      await item.save();
    }

    // Sync back to Cascading5Years target & budget for the corresponding year
    try {
      const yearNum = tahun || 2026;
      const fiveYearMatch = await Cascading5Years.findOne({
        $or: [
          { level: level, text: text },
          { level: level, masterId: masterId }
        ]
      });
      if (fiveYearMatch) {
        // Sync indicator targets inside the array
        if (Array.isArray(indicators) && Array.isArray(fiveYearMatch.indicators)) {
          indicators.forEach(ind => {
            const matchInd5 = fiveYearMatch.indicators.find(i5 => i5.indikator === ind.indikator);
            if (matchInd5) {
              matchInd5[`target${yearNum}`] = ind.target;
            }
          });
          fiveYearMatch.markModified('indicators');
        }

        if (level === 'sasaran_subkegiatan' || level === 'subkegiatan') {
          fiveYearMatch[`anggaran${yearNum}`] = (anggaran || 0).toString();
          
          const val2025 = yearNum === 2025 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2025) || 0);
          const val2026 = yearNum === 2026 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2026) || 0);
          const val2027 = yearNum === 2027 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2027) || 0);
          const val2028 = yearNum === 2028 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2028) || 0);
          const val2029 = yearNum === 2029 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2029) || 0);
          const val2030 = yearNum === 2030 ? parseFloat(anggaran) : (parseFloat(fiveYearMatch.anggaran2030) || 0);
          
          fiveYearMatch.anggaranAkhir = (val2025 + val2026 + val2027 + val2028 + val2029 + val2030).toString();
        }
        await fiveYearMatch.save();
      }
    } catch (err) {
      console.error('Failed to sync to Cascading5Years:', err);
    }

    return NextResponse.json({ message: 'Cascading berhasil disimpan', data: item });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
