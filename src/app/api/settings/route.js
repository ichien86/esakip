import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Setting from '@/models/Setting';

export async function GET() {
  try {
    await dbConnect();
    const settings = await Setting.find({});
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    if (settingsObj.planning_locked === undefined) {
      settingsObj.planning_locked = false;
    }
    return NextResponse.json(settingsObj);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
