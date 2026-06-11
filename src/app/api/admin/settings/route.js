import { NextResponse } from 'next/server';
import SettingService from '@/services/SettingService';

export async function POST(request) {
  try {
    const body = await request.json();
    const setting = await SettingService.updateSetting(body);

    return NextResponse.json({ message: 'Pengaturan berhasil diperbarui', setting });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
