import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import RealisasiSchedule from '@/models/RealisasiSchedule';

export async function GET(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const tahun = parseInt(searchParams.get('tahun') || '2026');

    let schedules = await RealisasiSchedule.find({ tahun }).sort({ bulan: 1 });
    if (schedules.length === 0) {
      const defaults = [];
      for (let m = 1; m <= 12; m++) {
        defaults.push({
          tahun,
          bulan: m,
          isLocked: false,
          deadline: ''
        });
      }
      schedules = await RealisasiSchedule.insertMany(defaults);
    }

    return NextResponse.json(schedules);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { schedules, requesterRole } = body;

    if (requesterRole !== 'admin' && requesterRole !== 'perencana') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Administrator Sistem atau Admin Perencana yang dapat mengubah jadwal realisasi.' }, { status: 403 });
    }

    if (!Array.isArray(schedules)) {
      return NextResponse.json({ error: 'Payload harus berupa array schedules' }, { status: 400 });
    }

    for (const item of schedules) {
      const { tahun, bulan, isLocked, deadline } = item;
      await RealisasiSchedule.findOneAndUpdate(
        { tahun, bulan },
        { $set: { isLocked: !!isLocked, deadline: deadline || '' } },
        { upsert: true }
      );
    }

    return NextResponse.json({ message: 'Jadwal realisasi berhasil diperbarui' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
