import RenaksiRepository from '@/repositories/RenaksiRepository';
import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import Employee from '@/models/Employee';
import Setting from '@/models/Setting';
import RealisasiSchedule from '@/models/RealisasiSchedule';
import Renaksi from '@/models/Renaksi';

class RenaksiService {
  /**
   * Mendapatkan daftar Renaksi berdasarkan employeeId dan tahun.
   */
  async getRenaksiByEmployeeAndYear(employeeId, yearNum) {
    return RenaksiRepository.find({ employeeId, tahun: yearNum });
  }

  /**
   * Menyimpan batch target renaksi.
   */
  async saveBatchTargets(employeeId, targets, requestYear) {
    if (!employeeId || !Array.isArray(targets)) {
      const err = new Error('Data target wajib dikirim');
      err.status = 400;
      throw err;
    }

    const lockSetting = await Setting.findOne({ key: 'planning_locked' });
    if (lockSetting && lockSetting.value === true) {
      const err = new Error('Masa penyusunan target renaksi (matriks bulanan) telah dikunci oleh Administrator.');
      err.status = 403;
      throw err;
    }

    const yearNum = parseInt(requestYear || '2026');
    const emp = await Employee.findOne({ id: employeeId });
    const userBidang = emp ? (emp.bidangs[0] || '') : '';

    const indicatorsToVerify = [...new Set(targets.map(t => t.indicatorId))];

    for (let indicatorId of indicatorsToVerify) {
      const node = await CascadingAnnualRepository.findOne({ id: indicatorId, tahun: yearNum });
      if (node && node.tipeTarget === 'Akumulatif') {
        let annualTarget = parseFloat(node.target);
        if (node.crossCuttingType === 'split' && node.splitTargets && userBidang) {
          const portion = parseFloat(node.splitTargets[userBidang]);
          if (!isNaN(portion)) {
            annualTarget = portion;
          }
        }

        const indicatorTargets = targets.filter(t => t.indicatorId === indicatorId);
        const monthlySum = indicatorTargets.reduce((sum, item) => sum + (parseFloat(item.targetBulanan) || 0), 0);

        if (Math.abs(monthlySum - annualTarget) > 0.05) {
          const err = new Error(`Validasi gagal untuk indikator "${node.indikator}". Tipe target adalah Akumulatif, sehingga jumlah target bulanan (Jan-Des) harus berjumlah persis ${annualTarget} ${node.satuan} (Input saat ini: ${monthlySum}).`);
          err.status = 400;
          throw err;
        }
      }
    }

    for (let item of targets) {
      const recordId = `rx_${employeeId}_${item.indicatorId}_${item.bulan}`;
      const targetVal = parseFloat(item.targetBulanan) || 0;

      let record = await RenaksiRepository.findOne({ id: recordId });
      if (record) {
        record.targetBulanan = targetVal;
        record.status = 'Draft'; // Reset to Draft when modified
        await RenaksiRepository.saveDocument(record);
      } else {
        record = new Renaksi({
          id: recordId,
          employeeId,
          bidang: userBidang,
          tahun: yearNum,
          indicatorId: item.indicatorId,
          bulan: parseInt(item.bulan),
          targetBulanan: targetVal,
          status: 'Draft'
        });
        await RenaksiRepository.saveDocument(record);
      }
    }

    return true;
  }

  /**
   * Mengajukan target renaksi (submit).
   */
  async submitTargets(employeeId, requestYear) {
    if (!employeeId) {
      const err = new Error('employeeId wajib diisi');
      err.status = 400;
      throw err;
    }

    const yearNum = parseInt(requestYear || '2026');

    // Update all Draft records for employee in the selected year to Target_Diajukan
    const result = await RenaksiRepository.updateMany(
      { employeeId, tahun: yearNum, status: 'Draft' },
      { $set: { status: 'Target_Diajukan' } }
    );

    return result.modifiedCount;
  }

  /**
   * Menyimpan realisasi bulanan.
   */
  async saveRealisasi(body) {
    const {
      employeeId, indicatorId, bulan, realisasiBulanan, buktiDukung,
      kendala, solusi, faktorPendorong, inovasi, status,
      variabelJumlahVal, variabelPembilangVal, variabelPenyebutVal
    } = body;

    if (!employeeId || !indicatorId || !bulan) {
      const err = new Error('Data realisasi tidak lengkap');
      err.status = 400;
      throw err;
    }

    const recordId = `rx_${employeeId}_${indicatorId}_${bulan}`;
    const record = await RenaksiRepository.findOne({ id: recordId });

    if (!record) {
      const err = new Error('Target bulanan belum diset');
      err.status = 404;
      throw err;
    }

    // Check if realization has already been approved / verified
    if (record.status === 'ACC_Admin' || record.status === 'Disetujui') {
      const err = new Error(`Pengisian realisasi untuk Bulan ${bulan} tahun ${record.tahun || 2026} tidak dapat diubah karena telah di-ACC/Disetujui oleh atasan.`);
      err.status = 403;
      throw err;
    }

    // Check realization schedule lock status and deadline
    const schedule = await RealisasiSchedule.findOne({ tahun: record.tahun || 2026, bulan: parseInt(bulan) });
    if (schedule) {
      if (schedule.isLocked) {
        const err = new Error(`Pengisian realisasi untuk Bulan ${bulan} tahun ${record.tahun || 2026} telah dikunci oleh Administrator.`);
        err.status = 403;
        throw err;
      }
      if (schedule.deadline) {
        const now = new Date();
        const deadlineDate = new Date(schedule.deadline);
        deadlineDate.setHours(23, 59, 59, 999);
        if (now > deadlineDate) {
          const err = new Error(`Pengisian realisasi untuk Bulan ${bulan} tahun ${record.tahun || 2026} telah ditutup karena melewati batas tanggal pengisian (${schedule.deadline}).`);
          err.status = 403;
          throw err;
        }
      }
    }

    const target = record.targetBulanan;
    const node = await CascadingAnnualRepository.findOne({ id: indicatorId });
    
    let realisasi = 0;
    if (node && node.metodePenghitungan === 'Persentase') {
      const pembilang = parseFloat(variabelPembilangVal);
      const penyebut = parseFloat(variabelPenyebutVal);
      if (isNaN(pembilang) || isNaN(penyebut)) {
        const err = new Error('Nilai pembilang dan penyebut wajib diisi angka valid.');
        err.status = 400;
        throw err;
      }
      if (penyebut === 0) {
        const err = new Error('Nilai penyebut tidak boleh nol.');
        err.status = 400;
        throw err;
      }
      // Round to 2 decimal places
      realisasi = parseFloat(((pembilang / penyebut) * 100).toFixed(2));
    } else if (node && node.metodePenghitungan === 'Jumlah') {
      const val = parseFloat(variabelJumlahVal);
      if (isNaN(val)) {
        const err = new Error('Nilai variabel jumlah wajib diisi angka valid.');
        err.status = 400;
        throw err;
      }
      realisasi = val;
    } else {
      realisasi = parseFloat(realisasiBulanan || 0);
    }

    const isDecreasing = node && node.tipeTarget === 'Kondisi Akhir Menurun';

    let isUnderperforming = false;
    if (isDecreasing) {
      isUnderperforming = realisasi > target;
    } else {
      isUnderperforming = realisasi < target;
    }

    if (isUnderperforming) {
      if (!kendala || !solusi) {
        const err = new Error('Realisasi di bawah target (atau melebihi batas untuk target menurun) wajib mengisi Kendala dan Solusi.');
        err.status = 400;
        throw err;
      }
    } else {
      if (!faktorPendorong || !inovasi) {
        const err = new Error('Realisasi memenuhi/melebihi target (atau di bawah batas untuk target menurun) wajib mengisi Faktor Pendorong dan Inovasi.');
        err.status = 400;
        throw err;
      }
    }

    record.realisasiBulanan = realisasi;
    record.variabelJumlahVal = variabelJumlahVal !== undefined && variabelJumlahVal !== '' ? parseFloat(variabelJumlahVal) : null;
    record.variabelPembilangVal = variabelPembilangVal !== undefined && variabelPembilangVal !== '' ? parseFloat(variabelPembilangVal) : null;
    record.variabelPenyebutVal = variabelPenyebutVal !== undefined && variabelPenyebutVal !== '' ? parseFloat(variabelPenyebutVal) : null;
    record.buktiDukung = buktiDukung || '';
    record.status = status || 'Diajukan';

    if (isUnderperforming) {
      record.kendala = kendala;
      record.solusi = solusi;
      record.faktorPendorong = '';
      record.inovasi = '';
    } else {
      record.kendala = '';
      record.solusi = '';
      record.faktorPendorong = faktorPendorong;
      record.inovasi = inovasi;
    }

    if (status === 'Diajukan' || status === 'Disetujui') {
      record.tanggalRealisasi = new Date().toISOString();
    }

    await RenaksiRepository.saveDocument(record);
    return record;
  }
}

export default new RenaksiService();
