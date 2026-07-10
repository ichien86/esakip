import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Selection from '@/models/Selection';
import Employee from '@/models/Employee';
import CascadingAnnual from '@/models/CascadingAnnual';

import { resolveTreePICs } from '@/lib/pic-resolver';

export async function GET(request, { params }) {
  try {
    await dbConnect();
    const { employeeId } = await params;
    const requestYear = request.headers.get('x-requester-year') || '2026';
    const yearNum = parseInt(requestYear);

    const employee = await Employee.findOne({ id: employeeId });
    if (!employee) {
      return NextResponse.json({ employeeId, tahun: yearNum, selectedIndicators: [] });
    }

    // Load all annual nodes and indicators for this year
    const allNodes = await CascadingAnnual.find({ tahun: yearNum });
    const IndicatorAnnual = (await import('@/models/IndicatorAnnual')).default;
    const allIndicators = await IndicatorAnnual.find({ tahun: yearNum });
    const resolvedNodes = resolveTreePICs(allNodes, allIndicators);

    // Filter indicators where the employee is caretaker
    const checkCaretakers = (picStr, emp) => {
      if (!picStr) return false;
      const caretakers = picStr.split(',');
      if (caretakers.includes(emp.id)) return true;

      if (emp.roles && emp.roles.includes('pemimpin')) {
        const getOfficialLeaderJabatan = (bidang) => {
          const map = {
            'Badan': 'Kepala Pelaksana',
            'Sekretariat': 'Sekretaris',
            'Tata Usaha': 'Kepala Sub Bagian Tata Usaha',
            'Bidang Pencegahan dan Kesiapsiagaan': 'Kepala Bidang Pencegahan dan Kesiapsiagaan',
            'Bidang Kedaruratan dan Logistik': 'Kepala Bidang Kedaruratan dan Logistik',
            'Bidang Rehabilitasi dan Rekonstruksi': 'Kepala Bidang Rehabilitasi dan Rekonstruksi'
          };
          return map[bidang] || `Kepala ${bidang}`;
        };

        for (const pic of caretakers) {
          if (pic.startsWith('jabatan:')) {
            const targetJabatan = pic.replace('jabatan:', '');
            if (emp.jabatan === targetJabatan) return true;
            if (emp.bidangs) {
              const matchedPlt = emp.bidangs.some(b => getOfficialLeaderJabatan(b) === targetJabatan);
              if (matchedPlt) return true;
            }
          }
          if (pic.startsWith('subunit:')) {
            const targetSub = pic.replace('subunit:', '');
            if (emp.subUnit === targetSub) return true;
          }
        }
      }
      return false;
    };

    let selectedIdsSet = new Set();

    resolvedNodes.forEach(node => {
      // 1. Check if node itself is assigned (legacy or header nodes)
      if (checkCaretakers(node.penanggungJawab, employee)) {
        selectedIdsSet.add(node.id);
      }
      
      // 2. Check if any specific indicators are assigned
      if (node.indicators && node.indicators.length > 0) {
        node.indicators.forEach(ind => {
          if (checkCaretakers(ind.penanggungJawab, employee)) {
            selectedIdsSet.add(ind.id);
            selectedIdsSet.add(node.id); // Also include parent node id so it renders properly in legacy views
          }
        });
      }
    });

    let selected = Array.from(selectedIdsSet);

    // 3. Auto-add program level indicators for Kabids (as fallback / safety)
    const programIndicators = resolvedNodes.filter(node => node.level === 'program' || node.level === 'sasaran_program');
    const isKabid = employee.roles && (employee.roles.includes('kabid') || (employee.roles.includes('pemimpin') && (employee.scopeLeader === 'Bidang' || employee.bidangs?.some(b => b.startsWith('Bidang')))));
    if (isKabid) {
      const empBidangs = employee.bidangs || [];
      const autoProgramNodes = programIndicators.filter(node => node.bidangPengampu?.some(b => empBidangs.includes(b)));
      autoProgramNodes.forEach(node => {
        selectedIdsSet.add(node.id);
        if (node.indicators) node.indicators.forEach(ind => selectedIdsSet.add(ind.id));
      });
    }

    // 4. Auto-add tujuan & sasaran level indicators for Kepala Badan (Top Leadership)
    const isKepalaBadan = employee.roles && employee.roles.includes('pemimpin') && employee.scopeLeader === 'Badan';
    if (isKepalaBadan) {
      const topNodes = resolvedNodes.filter(node => node.level === 'tujuan' || node.level === 'sasaran');
      topNodes.forEach(node => {
        selectedIdsSet.add(node.id);
        if (node.indicators) node.indicators.forEach(ind => selectedIdsSet.add(ind.id));
      });
    }

    selected = Array.from(selectedIdsSet);

    return NextResponse.json({
      employeeId,
      tahun: yearNum,
      selectedIndicators: selected
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
