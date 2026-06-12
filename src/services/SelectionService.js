import SelectionRepository from '@/repositories/SelectionRepository';
import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import IndicatorAnnualRepository from '@/repositories/IndicatorAnnualRepository';
import Indicator5YearsRepository from '@/repositories/Indicator5YearsRepository';
import Setting from '@/models/Setting';
import Employee from '@/models/Employee';
import Selection from '@/models/Selection';

class SelectionService {
  /**
   * Menyimpan penugasan (assignments) IKU ke pegawai/jabatan (Mode 1: Admin Bidang).
   */
  async saveAssignments(assignments, yearNum, requesterBidang) {
    const lockSetting = await Setting.findOne({ key: 'planning_locked' });
    if (lockSetting && lockSetting.value === true) {
      const err = new Error('Masa penyusunan perencanaan (pemilihan IKU) telah dikunci oleh Administrator.');
      err.status = 403;
      throw err;
    }

    const allEmployees = await Employee.find({ isActive: true });

    // Validation phase
    for (const [idKey, penanggungJawab] of Object.entries(assignments)) {
      if (!penanggungJawab) continue;

      let node = await CascadingAnnualRepository.findOne({ id: idKey, tahun: yearNum });
      let indicatorName = '';
      let level = '';

      if (node) {
        level = node.level;
        indicatorName = node.text;
      } else {
        const ind = await IndicatorAnnualRepository.findOne({ id: idKey, tahun: yearNum });
        if (ind) {
          node = await CascadingAnnualRepository.findOne({ id: ind.nodeId, tahun: yearNum });
          if (node) {
            level = node.level;
            indicatorName = ind.indikator;
          }
        }
      }

      if (!node) continue;

      let isValid = false;
      const targetIsJabatan = penanggungJawab.startsWith('jabatan:');
      const targetValue = penanggungJawab.replace('jabatan:', '');

      if (['subkegiatan', 'sasaran_subkegiatan', 'aktivitas', 'sasaran_aktivitas'].includes(level)) {
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
        isValid = true;
      }

      if (!isValid) {
        const displayLevel = level.replace('sasaran_', '');
        const targetName = targetIsJabatan ? targetValue : (allEmployees.find(e => e.id === penanggungJawab)?.nama || penanggungJawab);
        const err = new Error(`Validasi Gagal: Indikator level '${displayLevel}' (${indicatorName}) tidak dapat didelegasikan ke '${targetName}'.`);
        err.status = 400;
        throw err;
      }
    }

    // Execution phase
    const cleanStr = (s) => (s || '').toLowerCase().replace(/dan/g, '').replace(/&/g, '').replace(/bidang/g, '').replace(/[^a-z]/g, '').trim();
    const matchBidangs = (b1, b2) => cleanStr(b1) === cleanStr(b2);
    const isJabatanInBidang = (jab, bid) => cleanStr(jab).includes(cleanStr(bid));

    for (const [idKey, penanggungJawab] of Object.entries(assignments)) {
      let targetIndicators = [];
      let parentNode = null;

      const singleInd = await IndicatorAnnualRepository.findOne({ id: idKey, tahun: yearNum });
      if (singleInd) {
        targetIndicators = [singleInd];
        parentNode = await CascadingAnnualRepository.findOne({ id: singleInd.nodeId, tahun: yearNum });
      } else {
        const node = await CascadingAnnualRepository.findOne({ id: idKey, tahun: yearNum });
        if (node) {
          parentNode = node;
          targetIndicators = await IndicatorAnnualRepository.find({ nodeId: idKey, tahun: yearNum });
        }
      }

      if (parentNode && ['subkegiatan', 'sasaran_subkegiatan', 'aktivitas', 'sasaran_aktivitas'].includes(parentNode.level)) {
        for (const indicator of targetIndicators) {
          let nextPenanggungJawab = penanggungJawab || null;

          if (parentNode.bidangPengampu && parentNode.bidangPengampu.length > 1 && requesterBidang) {
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

          indicator.penanggungJawab = nextPenanggungJawab;
          await IndicatorAnnualRepository.saveDocument(indicator);
        }
      }
    }

    return true;
  }

  /**
   * Menyimpan pemilihan indikator untuk satu pegawai (Mode 2: Backward compatible).
   */
  async saveEmployeeSelections(employeeId, selectedIndicators, yearNum) {
    if (!employeeId || !Array.isArray(selectedIndicators)) {
      const err = new Error('Format data pemilihan tidak sesuai');
      err.status = 400;
      throw err;
    }

    const lockSetting = await Setting.findOne({ key: 'planning_locked' });
    if (lockSetting && lockSetting.value === true) {
      const err = new Error('Masa penyusunan perencanaan (pemilihan IKU) telah dikunci oleh Administrator.');
      err.status = 403;
      throw err;
    }

    // Filter selection to only allow subkegiatan and aktivitas levels
    const selectableIndicators = await CascadingAnnualRepository.find({
      id: { $in: selectedIndicators },
      level: { $in: ['subkegiatan', 'sasaran_subkegiatan', 'aktivitas', 'sasaran_aktivitas'] },
      tahun: yearNum
    });
    const cleanedSelectedIndicators = selectableIndicators.map(node => node.id);

    // Clear previous direct selections for this employee in the IndicatorAnnual collection for the selected year
    await IndicatorAnnualRepository.updateMany(
      { penanggungJawab: employeeId, tahun: yearNum },
      { $set: { penanggungJawab: null } }
    );

    // Apply new direct selections for this employee on all indicators belonging to the selected nodes
    await IndicatorAnnualRepository.updateMany(
      { nodeId: { $in: cleanedSelectedIndicators }, tahun: yearNum },
      { $set: { penanggungJawab: employeeId } }
    );

    // Keep legacy Selection collection updated for backward compatibility
    let selection = await SelectionRepository.findOne({ employeeId, tahun: yearNum });
    if (selection) {
      selection.selectedIndicators = cleanedSelectedIndicators;
      await SelectionRepository.saveDocument(selection);
    } else {
      selection = new Selection({ employeeId, selectedIndicators: cleanedSelectedIndicators, tahun: yearNum });
      await SelectionRepository.saveDocument(selection);
    }

    const employee = await Employee.findOne({ id: employeeId });
    const isKabid = employee && employee.roles && (employee.roles.includes('kabid') || (employee.roles.includes('pemimpin') && (employee.scopeLeader === 'Bidang' || employee.bidangs.some(b => b.startsWith('Bidang')))));
    let finalSelected = [...cleanedSelectedIndicators];
    
    if (isKabid) {
      const empBidangs = employee.bidangs || [];
      const programIndicators = await CascadingAnnualRepository.find({ level: 'program', tahun: yearNum });
      const autoProgramIds = programIndicators
        .filter(node => node.bidangPengampu.some(b => empBidangs.includes(b)))
        .map(node => node.id);
      
      finalSelected = [...new Set([...finalSelected, ...autoProgramIds])];
    }

    return finalSelected;
  }
}

export default new SelectionService();
