import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Selection from '@/models/Selection';
import Setting from '@/models/Setting';
import Employee from '@/models/Employee';
import CascadingAnnual from '@/models/CascadingAnnual';

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { employeeId, selectedIndicators, assignments } = body;

    const lockSetting = await Setting.findOne({ key: 'planning_locked' });
    if (lockSetting && lockSetting.value === true) {
      return NextResponse.json({ error: 'Masa penyusunan perencanaan (pemilihan IKU) telah dikunci oleh Administrator.' }, { status: 403 });
    }

    // Mode 1: Admin Unit Kerja assignments map
    if (assignments) {
      const allEmployees = await Employee.find({ isActive: true });

      for (const [indicatorId, penanggungJawab] of Object.entries(assignments)) {
        if (!penanggungJawab) continue;

        const indicator = await CascadingAnnual.findOne({ id: indicatorId, tahun: 2026 });
        if (!indicator) continue;

        let isValid = false;
        const targetIsJabatan = penanggungJawab.startsWith('jabatan:');
        const targetValue = penanggungJawab.replace('jabatan:', '');

        // 1. Tujuan & Sasaran: Only Kepala Badan (Kepala Pelaksana)
        if (indicator.level === 'tujuan' || indicator.level === 'sasaran') {
          if (targetIsJabatan && targetValue === 'Kepala Pelaksana') {
            isValid = true;
          } else if (!targetIsJabatan) {
            const emp = allEmployees.find(e => e.id === penanggungJawab);
            if (emp && (emp.jabatan === 'Kepala Pelaksana' || (emp.roles.includes('pemimpin') && emp.bidangs.includes('Badan')))) {
              isValid = true;
            }
          }
        }
        // 2. Program: Only Sekretaris or Kepala Bidang
        else if (indicator.level === 'program' || indicator.level === 'sasaran_program') {
          if (targetIsJabatan && (targetValue === 'Sekretaris' || targetValue.startsWith('Kepala Bidang') || targetValue.startsWith('Kabid'))) {
            isValid = true;
          } else if (!targetIsJabatan) {
            const emp = allEmployees.find(e => e.id === penanggungJawab);
            if (emp && emp.roles.includes('pemimpin') && (emp.jabatan.includes('Sekretaris') || emp.jabatan.includes('Kepala Bidang') || emp.jabatan.includes('Kabid'))) {
              isValid = true;
            }
          }
        }
        // 3. Kegiatan, Subkegiatan, Aktivitas: Pemimpin Tata Usaha or Staf
        else if (indicator.level === 'kegiatan' || indicator.level === 'sasaran_kegiatan' || 
                 indicator.level === 'subkegiatan' || indicator.level === 'sasaran_subkegiatan' || 
                 indicator.level === 'aktivitas' || indicator.level === 'sasaran_aktivitas') {
          if (targetIsJabatan && (targetValue === 'Kepala Sub Bagian Tata Usaha' || targetValue === 'Kepala TU' || targetValue === 'Kasi TU')) {
            isValid = true;
          } else if (!targetIsJabatan) {
            const emp = allEmployees.find(e => e.id === penanggungJawab);
            if (emp) {
              const isTULeader = emp.roles.includes('pemimpin') && emp.bidangs.includes('Tata Usaha');
              const isStaff = !emp.roles.includes('pemimpin') && emp.id !== 'admin';
              if (isTULeader || isStaff) {
                isValid = true;
              }
            }
          }
        }

        if (!isValid) {
          const displayLevel = indicator.level.replace('sasaran_', '');
          return NextResponse.json({ 
            error: `Validasi Gagal: Indikator level '${displayLevel}' (${indicator.indikator}) tidak dapat didelegasikan ke '${targetIsJabatan ? targetValue : (allEmployees.find(e => e.id === penanggungJawab)?.nama || penanggungJawab)}'.` 
          }, { status: 400 });
        }
      }

      // If all passed validation, save!
      for (const [indicatorId, penanggungJawab] of Object.entries(assignments)) {
        await CascadingAnnual.updateOne(
          { id: indicatorId, tahun: 2026 },
          { $set: { penanggungJawab: penanggungJawab || null } }
        );
      }
      return NextResponse.json({ message: 'Penanggung jawab indikator berhasil disimpan' });
    }

    // Mode 2: Standard individual employee selection (fallback/backward-compatible)
    if (!employeeId || !Array.isArray(selectedIndicators)) {
      return NextResponse.json({ error: 'Format data pemilihan tidak sesuai' }, { status: 400 });
    }

    const programIndicators = await CascadingAnnual.find({ level: 'program', tahun: 2026 });
    const programIds = programIndicators.map(node => node.id);
    const cleanedSelectedIndicators = selectedIndicators.filter(id => !programIds.includes(id));

    // Clear previous direct selections for this employee
    await CascadingAnnual.updateMany(
      { penanggungJawab: employeeId, tahun: 2026 },
      { $set: { penanggungJawab: null } }
    );

    // Apply new direct selections for this employee
    await CascadingAnnual.updateMany(
      { id: { $in: cleanedSelectedIndicators }, tahun: 2026 },
      { $set: { penanggungJawab: employeeId } }
    );

    // Keep legacy Selection collection updated for backward compatibility
    let selection = await Selection.findOne({ employeeId, tahun: 2026 });
    if (selection) {
      selection.selectedIndicators = cleanedSelectedIndicators;
      await selection.save();
    } else {
      selection = new Selection({ employeeId, selectedIndicators: cleanedSelectedIndicators, tahun: 2026 });
      await selection.save();
    }

    const employee = await Employee.findOne({ id: employeeId });
    const isKabid = employee && employee.roles && (employee.roles.includes('kabid') || (employee.roles.includes('pemimpin') && (employee.scopeLeader === 'Bidang' || employee.bidangs.some(b => b.startsWith('Bidang')))));
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
