import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Performance from '@/models/Performance';

export async function POST(request) {
  try {
    await dbConnect();
    const { employeeId, tahun, evaluatorId, skorAKIP, catatan } = await request.json();
    const yearNum = parseInt(tahun);

    const recordId = `perf_${employeeId}_${yearNum}`;
    let perf = await Performance.findOne({ id: recordId });

    if (!perf) {
      return NextResponse.json({ error: 'Data capaian kinerja pegawai belum ditemukan' }, { status: 404 });
    }

    let predikat = 'D';
    const score = parseFloat(skorAKIP);
    if (score >= 90) predikat = 'AA';
    else if (score >= 80) predikat = 'A';
    else if (score >= 70) predikat = 'BB';
    else if (score >= 60) predikat = 'B';
    else if (score >= 50) predikat = 'CC';
    else if (score >= 30) predikat = 'C';

    perf.status = 'Selesai';
    perf.evaluasiAtasan = {
      evaluatorId,
      skorAKIP: score,
      predikat,
      catatan: catatan || '',
      tanggalEvaluasi: new Date().toISOString().split('T')[0]
    };

    await perf.save();
    return NextResponse.json({ message: 'Evaluasi berhasil disimpan', data: perf });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
