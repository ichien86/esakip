import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';
import Selection from '@/models/Selection';
import CascadingAnnual from '@/models/CascadingAnnual';
import { getValidatedUser } from '@/lib/api-auth';

export async function GET(request) {
  try {
    await dbConnect();

    const { role: requesterRole } = getValidatedUser(request, request.headers.get('x-requester-role'));
    const requesterBidang = request.headers.get('x-requester-bidang') || '';

    // Only admin, admin_bidang, and perencana can access these warnings
    if (!['admin', 'admin_bidang', 'perencana'].includes(requesterRole)) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    // 1. Get all deactivated employees
    const deactivatedEmployees = await Employee.find({ isActive: false });
    if (deactivatedEmployees.length === 0) {
      return NextResponse.json([]);
    }

    const deactivatedIds = deactivatedEmployees.map(e => e.id);

    const requestYear = request.headers.get('x-requester-year') || '2026';
    const yearNum = parseInt(requestYear);

    // 2. Get selections for yearNum for these deactivated employees
    const selections = await Selection.find({ employeeId: { $in: deactivatedIds }, tahun: yearNum });
    if (selections.length === 0) {
      return NextResponse.json([]);
    }

    const indicatorIds = [...new Set(selections.flatMap(s => s.selectedIndicators))];
    if (indicatorIds.length === 0) {
      return NextResponse.json([]);
    }

    // 3. Find annual cascading indicators
    const indicators = await CascadingAnnual.find({ id: { $in: indicatorIds } });

    // 4. Construct warnings list
    const warnings = [];
    for (const selection of selections) {
      const employee = deactivatedEmployees.find(e => e.id === selection.employeeId);
      if (!employee) continue;

      for (const indicatorId of selection.selectedIndicators) {
        const indicator = indicators.find(i => i.id === indicatorId);
        if (!indicator) continue;

        // If requester is admin_bidang, only show warnings for their bidang
        const isUserAdminBidang = requesterRole === 'admin_bidang';
        const belongsToBidang = indicator.bidangPengampu.includes(requesterBidang);

        if (isUserAdminBidang && !belongsToBidang) {
          continue;
        }

        warnings.push({
          indicatorId: indicator.id,
          indicatorText: indicator.indikator,
          indicatorDetail: indicator.text,
          indicatorLevel: indicator.level,
          employeeId: employee.id,
          employeeNama: employee.nama,
          employeeJabatan: employee.jabatan,
          bidangPengampu: indicator.bidangPengampu
        });
      }
    }

    return NextResponse.json(warnings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
