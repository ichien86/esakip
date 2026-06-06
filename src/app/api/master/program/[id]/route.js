import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import MasterProgram from '@/models/MasterProgram';

export async function DELETE(request, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    await MasterProgram.deleteOne({ id });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
