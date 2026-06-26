import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Setting from '@/models/Setting';

export async function GET() {
  try {
    await dbConnect();
    const setting = await Setting.findOne({ key: 'target_fisik_locked' });
    return NextResponse.json({ locked: setting?.value === true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await dbConnect();
    const { locked } = await request.json();
    await Setting.findOneAndUpdate(
      { key: 'target_fisik_locked' },
      { value: locked === true },
      { upsert: true, new: true }
    );
    return NextResponse.json({ message: locked ? 'Target fisik dikunci' : 'Target fisik dibuka', locked });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
