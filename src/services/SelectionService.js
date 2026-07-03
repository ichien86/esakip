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
    const lockSetting = await Setting.findOne({ key: 'renja_locked' });
    if (lockSetting && lockSetting.value === true) {
      const err = new Error('Masa penyusunan perencanaan (pemilihan IKU) telah dikunci oleh Administrator.');
      err.status = 403;
      throw err;
    }

    const allEmployees = await Employee.find({ isActive: true });

    // Validation phase
    for (const [idKey, assignData] of Object.entries(assignments)) {
      // Compatibility with old string format vs new object format
      const isObject = typeof assignData === 'object' && assignData !== null;
      const penanggungJawabStr = isObject ? (assignData.penanggungJawab || []).join(',') : (assignData || '');
      
      if (!penanggungJawabStr) continue;

      let node = null;
      let indicatorName = '';
      let level = '';

      const ind = await IndicatorAnnualRepository.findOne({ id: idKey, tahun: yearNum });
      if (ind) {
        node = await CascadingAnnualRepository.findOne({ id: ind.nodeId, tahun: yearNum });
        if (node) {
          level = node.level;
          indicatorName = ind.indikator;
        }
      } else {
        // If not found in indicators, it's likely a node. We skip processing nodes directly.
        continue;
      }

      if (!node) continue;

      // Crosscutting ownership validation
      if (node.crossCuttingType === 'bersama' && node.selectedBidang && requesterBidang && requesterBidang !== 'Pimpinan') {
        if (node.selectedBidang !== requesterBidang) {
          const err = new Error(`Validasi Gagal: Hanya Bidang Penanggung Jawab Utama (${node.selectedBidang}) yang dapat mengelola penanggung jawab untuk indikator "${indicatorName}".`);
          err.status = 400;
          throw err;
        }
      }
      
      // We removed the strict 'leader vs staff' role validation here because the UI now dynamically determines 
      // the appropriate assignees based on the indicator's context. Legacy assignments also caused false positives.
    }

    // Execution phase
    const cleanStr = (s) => (s || '').toLowerCase().replace(/dan/g, '').replace(/&/g, '').replace(/bidang/g, '').replace(/[^a-z]/g, '').trim();
    const matchBidangs = (b1, b2) => cleanStr(b1) === cleanStr(b2);
    const isJabatanInBidang = (jab, bid) => cleanStr(jab).includes(cleanStr(bid));

    for (const [idKey, assignData] of Object.entries(assignments)) {
      const isObject = typeof assignData === 'object' && assignData !== null;
      const penanggungJawabStr = isObject ? (assignData.penanggungJawab || []).join(',') : (assignData || '');
      const crossCuttingType = isObject ? (assignData.crossCuttingType || 'shared') : 'shared';
      const splitTargets = isObject ? (assignData.splitTargets || {}) : {};

      let targetIndicators = [];
      let parentNode = null;

      const singleInd = await IndicatorAnnualRepository.findOne({ id: idKey, tahun: yearNum });
      if (singleInd) {
        targetIndicators = [singleInd];
        parentNode = await CascadingAnnualRepository.findOne({ id: singleInd.nodeId, tahun: yearNum });
      } else {
        // We no longer overwrite indicator PICs using the node-level PIC payload.
        // Node-level PICs will be auto-derived by pic-resolver.js
        continue;
      }

      if (parentNode) {
        for (const indicator of targetIndicators) {
          let nextPenanggungJawab = penanggungJawabStr || null;

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

            if (penanggungJawabStr) {
              // Add the newly assigned PICs
              const newPics = penanggungJawabStr.split(',').map(s => s.trim()).filter(Boolean);
              otherBidangsCaretakers.push(...newPics);
            }

            nextPenanggungJawab = [...new Set(otherBidangsCaretakers)].filter(Boolean).join(',') || null;
          }

          indicator.penanggungJawab = nextPenanggungJawab;
          
          // Save Cross-cutting Type and Split Targets at the indicator level
          indicator.crossCuttingType = crossCuttingType;
          indicator.splitTargets = splitTargets;
          indicator.markModified('splitTargets');

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

    const lockSetting = await Setting.findOne({ key: 'renja_locked' });
    if (lockSetting && lockSetting.value === true) {
      const err = new Error('Masa penyusunan perencanaan (pemilihan IKU) telah dikunci oleh Administrator.');
      err.status = 403;
      throw err;
    }

    // Filter selection to only allow kegiatan, subkegiatan, and aktivitas levels
    const allSelectable = await CascadingAnnualRepository.find({
      id: { $in: selectedIndicators },
      level: { $in: ['kegiatan', 'sasaran_kegiatan', 'subkegiatan', 'sasaran_subkegiatan', 'aktivitas', 'sasaran_aktivitas'] },
      tahun: yearNum
    });

    const employee = await Employee.findOne({ id: employeeId });
    const empBidangs = employee ? (employee.bidangs || []) : [];

    const selectableIndicators = allSelectable.filter(node => {
      if (node.crossCuttingType === 'bersama' && node.selectedBidang) {
        return empBidangs.includes(node.selectedBidang);
      }
      return true;
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
