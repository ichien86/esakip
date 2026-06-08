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
    if (!employee) {
      return NextResponse.json({ employeeId, tahun: 2026, selectedIndicators: [] });
    }

    // 1. Direct employee assignments
    const directIndicators = await CascadingAnnual.find({ penanggungJawab: employeeId, tahun: 2026 });

    // 2. Attached position (jabatan melekat) assignments for leaders (with Plt support)
    let positionIndicators = [];
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

      const allPositionIndicators = await CascadingAnnual.find({
        penanggungJawab: /^jabatan:/,
        tahun: 2026
      });

      positionIndicators = allPositionIndicators.filter(node => {
        const targetJabatan = node.penanggungJawab.replace('jabatan:', '');
        
        // Match if employee has the exact jabatan title
        if (employee.jabatan === targetJabatan) return true;

        // Match if employee is a leader of a unit in the indicator's bidangPengampu,
        // and the target jabatan is the official leader title for that unit (Plt support)
        return employee.bidangs.some(b => {
          const officialJab = getOfficialLeaderJabatan(b);
          return officialJab === targetJabatan && node.bidangPengampu.includes(b);
        });
      });
    }

    const assignedIndicators = [...directIndicators, ...positionIndicators];
    let selected = assignedIndicators.map(node => node.id);

    // 3. Auto-add program level indicators for Kabids (as fallback / safety)
    const programIndicators = await CascadingAnnual.find({ level: 'program', tahun: 2026 });
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
      tahun: 2026,
      selectedIndicators: selected
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
