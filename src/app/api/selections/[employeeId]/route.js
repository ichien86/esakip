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

    // Load all annual nodes for this year
    const allNodes = await CascadingAnnual.find({ tahun: yearNum });
    const resolvedNodes = resolveTreePICs(allNodes);

    // Filter indicators where the employee is caretaker
    const assignedIndicators = resolvedNodes.filter(node => {
      if (!node.penanggungJawab) return false;

      const caretakers = node.penanggungJawab.split(',');

      // 1. Direct match
      if (caretakers.includes(employeeId)) return true;

      // 2. Position match (leaders & Plt)
      if (employee.roles.includes('pemimpin')) {
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
            if (employee.jabatan === targetJabatan) return true;
            const matchedPlt = employee.bidangs.some(b => {
              const officialJab = getOfficialLeaderJabatan(b);
              return officialJab === targetJabatan;
            });
            if (matchedPlt) return true;
          }
        }
      }

      return false;
    });

    let selected = assignedIndicators.map(node => node.id);

    // 3. Auto-add program level indicators for Kabids (as fallback / safety)
    const programIndicators = resolvedNodes.filter(node => node.level === 'program');
    const isKabid = employee.roles && (employee.roles.includes('kabid') || (employee.roles.includes('pemimpin') && (employee.scopeLeader === 'Bidang' || employee.bidangs.some(b => b.startsWith('Bidang')))));
    if (isKabid) {
      const empBidangs = employee.bidangs || [];
      const autoProgramIds = programIndicators
        .filter(node => node.bidangPengampu.some(b => empBidangs.includes(b)))
        .map(node => node.id);
      
      selected = [...new Set([...selected, ...autoProgramIds])];
    }

    return NextResponse.json({
      employeeId,
      tahun: yearNum,
      selectedIndicators: selected
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
