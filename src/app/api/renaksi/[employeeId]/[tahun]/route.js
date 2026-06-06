import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';

export async function GET(request, { params }) {
  try {
    await dbConnect();
    const { employeeId, tahun } = await params;
    const yearNum = parseInt(tahun);

    const userRenaksi = await Renaksi.find({ employeeId, tahun: yearNum });
    return NextResponse.json(userRenaksi);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
