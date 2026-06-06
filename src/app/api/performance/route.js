import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Performance from '@/models/Performance';

export async function POST(request) {
  try {
    await dbConnect();
    const { employeeId, tahun, targetIKU, status } = await request.json();
    const yearNum = parseInt(tahun);

    const recordId = `perf_${employeeId}_${yearNum}`;
    let perf = await Performance.findOne({ id: recordId });

    if (perf) {
      perf.targetIKU = targetIKU || [];
      perf.status = status || 'Draft';
      await perf.save();
    } else {
      perf = new Performance({
        id: recordId,
        employeeId,
        tahun: yearNum,
        status: status || 'Draft',
        targetIKU: targetIKU || [],
        evaluasiAtasan: {
          evaluatorId: null,
          skorAKIP: null,
          predikat: null,
          catatan: '',
          tanggalEvaluasi: null
        }
      });
      await perf.save();
    }

    return NextResponse.json({ message: 'Kinerja berhasil disimpan', data: perf });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
