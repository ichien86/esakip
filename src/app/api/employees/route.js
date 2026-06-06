import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function GET() {
  try {
    await dbConnect();
    const employees = await Employee.find({}).sort({ id: 1 });

    const enriched = employees.map(emp => {
      let bidangs = emp.bidangs;
      if (emp.roles.includes('admin') || emp.roles.includes('perencana')) {
        bidangs = ['Sekretariat', 'Pencegahan & Kesiapsiagaan', 'Kedaruratan & Logistik', 'Rehabilitasi & Rekonstruksi', 'Pimpinan'];
      } else if (emp.parentId) {
        const supervisor = employees.find(e => e.id === emp.parentId);
        if (supervisor) {
          bidangs = supervisor.bidangs;
        }
      }
      return {
        ...emp.toObject(),
        bidangs
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
