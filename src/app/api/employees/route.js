import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function GET() {
  try {
    await dbConnect();
    const employees = await Employee.find({}).sort({ id: 1 });

    const enriched = employees.map(emp => {
      return emp.toObject();
    });

    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
