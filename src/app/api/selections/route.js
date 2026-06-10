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

    const requestYear = request.headers.get('x-requester-year') || body.tahun || '2026';
    const yearNum = parseInt(requestYear);

    const lockSetting = await Setting.findOne({ key: 'planning_locked' });
    if (lockSetting && lockSetting.value === true) {
      return NextResponse.json({ error: 'Masa penyusunan perencanaan (pemilihan IKU) telah dikunci oleh Administrator.' }, { status: 403 });
    }

    // Mode 1: Admin Unit Kerja assignments map
    if (assignments) {
      const allEmployees = await Employee.find({ isActive: true });

      for (const [indicatorId, penanggungJawab] of Object.entries(assignments)) {
        if (!penanggungJawab) continue;

        const indicator = await CascadingAnnual.findOne({ id: indicatorId, tahun: yearNum });
        if (!indicator) continue;

        let isValid = false;
        const targetIsJabatan = penanggungJawab.startsWith('jabatan:');
        const targetValue = penanggungJawab.replace('jabatan:', '');

        // Only validate and process assignments for subkegiatan/aktivitas levels
        if (indicator.level === 'subkegiatan' || indicator.level === 'sasaran_subkegiatan' || 
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
        } else {
          // Higher levels (Tujuan, Sasaran, Program, Kegiatan) cannot be directly assigned.
          // Since they are derived bottom-up, they are considered valid by default if no assignment is actually saved.
          isValid = true;
        }

        if (!isValid) {
          const displayLevel = indicator.level.replace('sasaran_', '');
          return NextResponse.json({ 
            error: `Validasi Gagal: Indikator level '${displayLevel}' (${indicator.indikator}) tidak dapat didelegasikan ke '${targetIsJabatan ? targetValue : (allEmployees.find(e => e.id === penanggungJawab)?.nama || penanggungJawab)}'.` 
          }, { status: 400 });
        }
      }

      // If all passed validation, save assignments only for subkegiatan and aktivitas levels
      const requesterBidang = request.headers.get('x-requester-bidang') || '';
      const cleanStr = (s) => (s || '').toLowerCase().replace(/dan/g, '').replace(/&/g, '').replace(/bidang/g, '').replace(/[^a-z]/g, '').trim();
      const matchBidangs = (b1, b2) => cleanStr(b1) === cleanStr(b2);
      const isJabatanInBidang = (jab, bid) => cleanStr(jab).includes(cleanStr(bid));

      for (const [indicatorId, penanggungJawab] of Object.entries(assignments)) {
        const indicator = await CascadingAnnual.findOne({ id: indicatorId, tahun: yearNum });
        if (indicator && ['subkegiatan', 'sasaran_subkegiatan', 'aktivitas', 'sasaran_aktivitas'].includes(indicator.level)) {
          let nextPenanggungJawab = penanggungJawab || null;

          // Merge caretaker if indicator is cross-cutting (assigned to multiple bidangs)
          if (indicator.bidangPengampu && indicator.bidangPengampu.length > 1 && requesterBidang) {
            const currentVal = indicator.penanggungJawab || '';
            const currentList = currentVal.split(',').map(s => s.trim()).filter(Boolean);
            const otherBidangsCaretakers = [];

            for (const pic of currentList) {
              let belongsToRequesterBidang = false;
              if (pic.startsWith('jabatan:')) {
                const position = pic.replace('jabatan:', '');
                belongsToRequesterBidang = isJabatanInBidang(position, requesterBidang);
              } else {
                const emp = allEmployees.find(e => e.id === pic);
                if (emp && emp.bidangs) {
                  belongsToRequesterBidang = emp.bidangs.some(b => matchBidangs(b, requesterBidang));
                }
              }

              if (!belongsToRequesterBidang) {
                otherBidangsCaretakers.push(pic);
              }
            }

            if (penanggungJawab) {
              otherBidangsCaretakers.push(penanggungJawab);
            }

            nextPenanggungJawab = [...new Set(otherBidangsCaretakers)].filter(Boolean).join(',') || null;
          }

          await CascadingAnnual.updateOne(
            { id: indicatorId, tahun: yearNum },
            { $set: { penanggungJawab: nextPenanggungJawab } }
          );
        }
      }
      return NextResponse.json({ message: 'Penanggung jawab indikator berhasil disimpan' });
    }

    // Mode 2: Standard individual employee selection (fallback/backward-compatible)
    if (!employeeId || !Array.isArray(selectedIndicators)) {
      return NextResponse.json({ error: 'Format data pemilihan tidak sesuai' }, { status: 400 });
    }

    // Filter selection to only allow subkegiatan and aktivitas levels
    const selectableIndicators = await CascadingAnnual.find({
      id: { $in: selectedIndicators },
      level: { $in: ['subkegiatan', 'sasaran_subkegiatan', 'aktivitas', 'sasaran_aktivitas'] },
      tahun: yearNum
    });
    const cleanedSelectedIndicators = selectableIndicators.map(node => node.id);

    // Clear previous direct selections for this employee for the selected year
    await CascadingAnnual.updateMany(
      { penanggungJawab: employeeId, tahun: yearNum },
      { $set: { penanggungJawab: null } }
    );

    // Apply new direct selections for this employee
    await CascadingAnnual.updateMany(
      { id: { $in: cleanedSelectedIndicators }, tahun: yearNum },
      { $set: { penanggungJawab: employeeId } }
    );

    // Keep legacy Selection collection updated for backward compatibility
    let selection = await Selection.findOne({ employeeId, tahun: yearNum });
    if (selection) {
      selection.selectedIndicators = cleanedSelectedIndicators;
      await selection.save();
    } else {
      selection = new Selection({ employeeId, selectedIndicators: cleanedSelectedIndicators, tahun: yearNum });
      await selection.save();
    }

    const employee = await Employee.findOne({ id: employeeId });
    const isKabid = employee && employee.roles && (employee.roles.includes('kabid') || (employee.roles.includes('pemimpin') && (employee.scopeLeader === 'Bidang' || employee.bidangs.some(b => b.startsWith('Bidang')))));
    let finalSelected = [...cleanedSelectedIndicators];
    if (isKabid) {
      const empBidangs = employee.bidangs || [];
      const programIndicators = await CascadingAnnual.find({ level: 'program', tahun: yearNum });
      const autoProgramIds = programIndicators
        .filter(node => node.bidangPengampu.some(b => empBidangs.includes(b)))
        .map(node => node.id);
      
      finalSelected = [...new Set([...finalSelected, ...autoProgramIds])];
    }

    return NextResponse.json({
      message: 'Indikator berhasil dipilih',
      data: {
        employeeId,
        tahun: yearNum,
        selectedIndicators: finalSelected
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
