import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Setting from '@/models/Setting';

export async function POST(request) {
  try {
    await dbConnect();
    const { key, value, requesterRole } = await request.json();

    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Administrator Sistem yang dapat mengubah pengaturan sistem.' }, { status: 403 });
    }

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key dan Value wajib diisi' }, { status: 400 });
    }

    let setting = await Setting.findOne({ key });
    if (setting) {
      setting.value = value;
      await setting.save();
    } else {
      setting = new Setting({ key, value });
      await setting.save();
    }

    return NextResponse.json({ message: 'Pengaturan berhasil diperbarui', setting });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
