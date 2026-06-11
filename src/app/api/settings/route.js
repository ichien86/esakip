import { NextResponse } from 'next/server';
import SettingService from '@/services/SettingService';

export async function GET() {
  try {
    const settingsObj = await SettingService.getAllSettings();
    return NextResponse.json(settingsObj);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
