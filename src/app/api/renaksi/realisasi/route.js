import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';
import CascadingAnnual from '@/models/CascadingAnnual';
import RealisasiSchedule from '@/models/RealisasiSchedule';

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const {
      employeeId, indicatorId, bulan, realisasiBulanan, buktiDukung,
      kendala, solusi, faktorPendorong, inovasi, status,
      variabelJumlahVal, variabelPembilangVal, variabelPenyebutVal
    } = body;

    if (!employeeId || !indicatorId || !bulan) {
      return NextResponse.json({ error: 'Data realisasi tidak lengkap' }, { status: 400 });
    }

    const recordId = `rx_${employeeId}_${indicatorId}_${bulan}`;
    const record = await Renaksi.findOne({ id: recordId });

    if (!record) {
      return NextResponse.json({ error: 'Target bulanan belum diset' }, { status: 404 });
    }

    // Check realization schedule lock status
    const schedule = await RealisasiSchedule.findOne({ tahun: record.tahun || 2026, bulan: parseInt(bulan) });
    if (schedule && schedule.isLocked) {
      return NextResponse.json({ error: `Pengisian realisasi untuk Bulan ${bulan} tahun ${record.tahun || 2026} telah dikunci oleh Administrator.` }, { status: 403 });
    }

    const target = record.targetBulanan;
    const node = await CascadingAnnual.findOne({ id: indicatorId });
    
    let realisasi = 0;
    if (node && node.metodePenghitungan === 'Persentase') {
      const pembilang = parseFloat(variabelPembilangVal);
      const penyebut = parseFloat(variabelPenyebutVal);
      if (isNaN(pembilang) || isNaN(penyebut)) {
        return NextResponse.json({ error: 'Nilai pembilang dan penyebut wajib diisi angka valid.' }, { status: 400 });
      }
      if (penyebut === 0) {
        return NextResponse.json({ error: 'Nilai penyebut tidak boleh nol.' }, { status: 400 });
      }
      // Round to 2 decimal places
      realisasi = parseFloat(((pembilang / penyebut) * 100).toFixed(2));
    } else if (node && node.metodePenghitungan === 'Jumlah') {
      const val = parseFloat(variabelJumlahVal);
      if (isNaN(val)) {
        return NextResponse.json({ error: 'Nilai variabel jumlah wajib diisi angka valid.' }, { status: 400 });
      }
      realisasi = val;
    } else {
      realisasi = parseFloat(realisasiBulanan || 0);
    }

    const isDecreasing = node && node.tipeTarget === 'Kondisi Akhir Menurun';

    let isUnderperforming = false;
    if (isDecreasing) {
      isUnderperforming = realisasi > target;
    } else {
      isUnderperforming = realisasi < target;
    }

    if (isUnderperforming) {
      if (!kendala || !solusi) {
        return NextResponse.json({ error: 'Realisasi di bawah target (atau melebihi batas untuk target menurun) wajib mengisi Kendala dan Solusi.' }, { status: 400 });
      }
    } else {
      if (!faktorPendorong || !inovasi) {
        return NextResponse.json({ error: 'Realisasi memenuhi/melebihi target (atau di bawah batas untuk target menurun) wajib mengisi Faktor Pendorong dan Inovasi.' }, { status: 400 });
      }
    }

    record.realisasiBulanan = realisasi;
    record.variabelJumlahVal = variabelJumlahVal !== undefined && variabelJumlahVal !== '' ? parseFloat(variabelJumlahVal) : null;
    record.variabelPembilangVal = variabelPembilangVal !== undefined && variabelPembilangVal !== '' ? parseFloat(variabelPembilangVal) : null;
    record.variabelPenyebutVal = variabelPenyebutVal !== undefined && variabelPenyebutVal !== '' ? parseFloat(variabelPenyebutVal) : null;
    record.buktiDukung = buktiDukung || '';
    record.status = status || 'Diajukan';

    if (isUnderperforming) {
      record.kendala = kendala;
      record.solusi = solusi;
      record.faktorPendorong = '';
      record.inovasi = '';
    } else {
      record.kendala = '';
      record.solusi = '';
      record.faktorPendorong = faktorPendorong;
      record.inovasi = inovasi;
    }

    if (status === 'Diajukan' || status === 'Disetujui') {
      record.tanggalRealisasi = new Date().toISOString();
    }

    await record.save();
    return NextResponse.json({ message: 'Realisasi bulanan berhasil disimpan', data: record });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
