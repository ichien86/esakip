import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Selection from '@/models/Selection';
import Setting from '@/models/Setting';
import Employee from '@/models/Employee';
import CascadingAnnual from '@/models/CascadingAnnual';

export async function POST(request) {
  try {
    await dbConnect();
    const { employeeId, selectedIndicators } = await request.json();

    if (!employeeId || !Array.isArray(selectedIndicators)) {
      return NextResponse.json({ error: 'Format data pemilihan tidak sesuai' }, { status: 400 });
    }

    const lockSetting = await Setting.findOne({ key: 'planning_locked' });
    if (lockSetting && lockSetting.value === true) {
      return NextResponse.json({ error: 'Masa penyusunan perencanaan (pemilihan IKU) telah dikunci oleh Administrator.' }, { status: 403 });
    }

    // Strip out program level indicators from the manually saved list
    const programIndicators = await CascadingAnnual.find({ level: 'program', tahun: 2026 });
    const programIds = programIndicators.map(node => node.id);
    const cleanedSelectedIndicators = selectedIndicators.filter(id => !programIds.includes(id));

    let selection = await Selection.findOne({ employeeId, tahun: 2026 });
    if (selection) {
      selection.selectedIndicators = cleanedSelectedIndicators;
      await selection.save();
    } else {
      selection = new Selection({ employeeId, selectedIndicators: cleanedSelectedIndicators, tahun: 2026 });
      await selection.save();
    }

    // Dynamically merge program indicators for the returned object to keep the UI in sync
    const employee = await Employee.findOne({ id: employeeId });
    const isKabid = employee && employee.roles && employee.roles.includes('kabid');
    let finalSelected = [...cleanedSelectedIndicators];
    if (isKabid) {
      const empBidangs = employee.bidangs || [];
      const autoProgramIds = programIndicators
        .filter(node => node.bidangPengampu.some(b => empBidangs.includes(b)))
        .map(node => node.id);
      
      finalSelected = [...new Set([...finalSelected, ...autoProgramIds])];
    }

    return NextResponse.json({
      message: 'Indikator berhasil dipilih',
      data: {
        employeeId,
        tahun: 2026,
        selectedIndicators: finalSelected
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
