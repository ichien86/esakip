import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Selection from '@/models/Selection';
import Employee from '@/models/Employee';
import CascadingAnnual from '@/models/CascadingAnnual';

export async function GET(request, { params }) {
  try {
    await dbConnect();
    const { employeeId } = await params;

    const employee = await Employee.findOne({ id: employeeId });
    const selection = await Selection.findOne({ employeeId, tahun: 2026 });
    
    let selected = selection ? selection.selectedIndicators : [];

    // Find all program level indicators
    const programIndicators = await CascadingAnnual.find({ level: 'program', tahun: 2026 });
    const programIds = programIndicators.map(node => node.id);

    // Remove program indicators from the manually selected list (safety filter)
    selected = selected.filter(id => !programIds.includes(id));

    // If employee is a kabid, auto-add program indicators where bidangPengampu intersects with their bidangs
    const isKabid = employee && employee.roles && employee.roles.includes('kabid');
    if (isKabid) {
      const empBidangs = employee.bidangs || [];
      const autoProgramIds = programIndicators
        .filter(node => node.bidangPengampu.some(b => empBidangs.includes(b)))
        .map(node => node.id);
      
      selected = [...new Set([...selected, ...autoProgramIds])];
    }

    return NextResponse.json({
      employeeId,
      tahun: 2026,
      selectedIndicators: selected
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
