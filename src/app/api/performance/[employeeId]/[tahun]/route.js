import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Performance from '@/models/Performance';

export async function GET(request, { params }) {
  try {
    await dbConnect();
    const { employeeId, tahun } = await params;
    const yearNum = parseInt(tahun);

    let perf = await Performance.findOne({ employeeId, tahun: yearNum });
    if (!perf) {
      perf = {
        id: `perf_${employeeId}_${tahun}`,
        employeeId,
        tahun: yearNum,
        status: 'Draft',
        targetIKU: [],
        evaluasiAtasan: {
          evaluatorId: null,
          skorAKIP: null,
          predikat: null,
          catatan: '',
          tanggalEvaluasi: null
        }
      };
    }
    return NextResponse.json(perf);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
