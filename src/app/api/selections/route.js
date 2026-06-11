import { NextResponse } from 'next/server';
import SelectionService from '@/services/SelectionService';

export async function POST(request) {
  try {
    const body = await request.json();
    const { employeeId, selectedIndicators, assignments } = body;

    const requestYear = request.headers.get('x-requester-year') || body.tahun || '2026';
    const yearNum = parseInt(requestYear);
    const requesterBidang = request.headers.get('x-requester-bidang') || '';

    if (assignments) {
      // Mode 1: Admin Unit Kerja assignments map
      await SelectionService.saveAssignments(assignments, yearNum, requesterBidang);
      return NextResponse.json({ message: 'Penanggung jawab indikator berhasil disimpan' });
    }

    // Mode 2: Standard individual employee selection
    const finalSelected = await SelectionService.saveEmployeeSelections(employeeId, selectedIndicators, yearNum);

    return NextResponse.json({
      message: 'Indikator berhasil dipilih',
      data: {
        employeeId,
        tahun: yearNum,
        selectedIndicators: finalSelected
      }
    });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

