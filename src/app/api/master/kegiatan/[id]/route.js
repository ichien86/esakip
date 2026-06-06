import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import MasterKegiatan from '@/models/MasterKegiatan';

export async function DELETE(request, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    await MasterKegiatan.deleteOne({ id });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
