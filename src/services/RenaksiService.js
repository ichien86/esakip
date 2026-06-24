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

    const lockSetting = await Setting.findOne({ key: 'renja_locked' });
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
        if (node.crossCuttingType === 'split' && node.splitTargets && employeeId) {
          const portion = parseFloat(node.splitTargets[employeeId]);
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

    // 1. Get Employee's selected indicators
    const SelectionRepository = (await import('@/repositories/SelectionRepository')).default;
    const selection = await SelectionRepository.findOne({ employeeId, tahun: yearNum });
    const assignedIds = selection ? selection.selectedIndicators : [];

    if (!assignedIds || assignedIds.length === 0) {
      const err = new Error('Anda belum memilih/ditugaskan pada indikator kinerja apapun untuk tahun ini.');
      err.status = 400;
      throw err;
    }

    // 2. Fetch Indicator/Node details
    const CascadingAnnualRepository = (await import('@/repositories/CascadingAnnualRepository')).default;
    const IndicatorAnnualRepository = (await import('@/repositories/IndicatorAnnualRepository')).default;
    
    let nodes = await CascadingAnnualRepository.find({ id: { $in: assignedIds }, tahun: yearNum });
    const indNodes = await IndicatorAnnualRepository.find({ id: { $in: assignedIds }, tahun: yearNum });
    nodes = [...nodes, ...indNodes];

    // 3. Fetch all draft targets for this employee
    const draftRecords = await RenaksiRepository.find({ employeeId, tahun: yearNum, status: 'Draft' });

    // 4. Validate Completeness
    for (const node of nodes) {
      const nodeDrafts = draftRecords.filter(r => r.indicatorId === node.id);

      if (nodeDrafts.length === 0) {
        const err = new Error(`Validasi Gagal: Anda belum mengisi target sama sekali untuk indikator "${node.indikator}".`);
        err.status = 400;
        throw err;
      }

      if (node.tipeTarget !== 'Akumulatif') {
        if (nodeDrafts.length < 12) {
          const err = new Error(`Validasi Gagal: Indikator "${node.indikator}" bertipe non-akumulatif (${node.tipeTarget}). Setiap bulan wajib diisi sebagai proses target, tidak boleh ada bulan yang kosong.`);
          err.status = 400;
          throw err;
        }
      }
    }

    // 5. Update status
    const result = await RenaksiRepository.updateMany(
      { employeeId, tahun: yearNum, status: 'Draft' },
      { $set: { status: 'Target_Diajukan' } }
    );

    return result.modifiedCount;
  }

  /**
   * Menghitung nilai realisasi berdasarkan metode dan input variabel.
   * Fungsi helper ini digunakan oleh saveRealisasi.
   */
  computeRealisasi(metode, variablesRealization, snapshotVariables) {
    // Normalisasi metode lama 'Jumlah' -> 'Tunggal'
    const normalizedMetode = (metode === 'Jumlah') ? 'Tunggal' : metode;

    if (!variablesRealization || variablesRealization.length === 0) {
      throw Object.assign(new Error(`Variabel untuk metode ${normalizedMetode} wajib diisi.`), { status: 400 });
    }

    if (normalizedMetode === 'Tunggal') {
      const val = parseFloat(variablesRealization[0].value);
      if (isNaN(val)) throw Object.assign(new Error('Nilai variabel tunggal wajib diisi angka valid.'), { status: 400 });
      return val;

    } else if (normalizedMetode === 'Persentase') {
      if (variablesRealization.length < 2) throw Object.assign(new Error('Variabel Pembilang dan Penyebut wajib diisi.'), { status: 400 });
      const pembilang = parseFloat(variablesRealization[0].value);
      const penyebut = parseFloat(variablesRealization[1].value);
      if (isNaN(pembilang) || isNaN(penyebut)) throw Object.assign(new Error('Nilai pembilang dan penyebut wajib diisi angka valid.'), { status: 400 });
      if (penyebut === 0) throw Object.assign(new Error('Nilai penyebut tidak boleh nol.'), { status: 400 });
      return parseFloat(((pembilang / penyebut) * 100).toFixed(2));

    } else if (normalizedMetode === 'Rata-rata') {
      const values = variablesRealization.map(v => parseFloat(v.value));
      if (values.some(v => isNaN(v))) throw Object.assign(new Error('Semua nilai variabel Rata-rata wajib diisi angka valid.'), { status: 400 });
      const sum = values.reduce((acc, v) => acc + v, 0);
      return parseFloat((sum / values.length).toFixed(4));

    } else if (normalizedMetode === 'Penjumlahan') {
      const values = variablesRealization.map(v => parseFloat(v.value));
      if (values.some(v => isNaN(v))) throw Object.assign(new Error('Semua nilai variabel Penjumlahan wajib diisi angka valid.'), { status: 400 });
      return parseFloat(values.reduce((acc, v) => acc + v, 0).toFixed(4));

    } else if (normalizedMetode === 'Pembobotan') {
      if (!snapshotVariables || snapshotVariables.length === 0) throw Object.assign(new Error('Konfigurasi bobot variabel tidak ditemukan di snapshot.'), { status: 500 });
      let weightedSum = 0;
      for (const vr of variablesRealization) {
        const val = parseFloat(vr.value);
        if (isNaN(val)) throw Object.assign(new Error(`Nilai variabel "${vr.name}" wajib diisi angka valid.`), { status: 400 });
        const snapVar = snapshotVariables.find(sv => sv.name === vr.name);
        const weight = snapVar ? (parseFloat(snapVar.weight) || 0) : 0;
        weightedSum += val * weight;
      }
      return parseFloat((weightedSum / 100).toFixed(4));

    } else {
      // Fallback: ambil dari realisasiBulanan langsung
      return null;
    }
  }

  /**
   * Menyimpan realisasi bulanan dengan pola snapshot.
   */
  async saveRealisasi(body) {
    const {
      employeeId, indicatorId, bulan, realisasiBulanan, buktiDukung,
      kendala, solusi, faktorPendorong, inovasi, status,
      // Baru: input nilai variabel dinamis dari pegawai
      variablesRealization
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

    // ===== POLA SNAPSHOT =====
    // Jika snapshot belum ada (pengisian pertama kali), salin konfigurasi dari indikator
    let activeMetode = record.snapshotMetode;
    let activeVariables = (record.snapshotVariables && record.snapshotVariables.length > 0)
      ? record.snapshotVariables
      : null;

    if (!activeMetode) {
      // Ambil metode dari indikator (template utama)
      const rawMetode = node ? (node.metodePenghitungan || 'Tunggal') : 'Tunggal';
      activeMetode = (rawMetode === 'Jumlah') ? 'Tunggal' : rawMetode;
      record.snapshotMetode = activeMetode;

      // Salin konfigurasi variabel ke snapshot
      if (node && Array.isArray(node.variables) && node.variables.length > 0) {
        record.snapshotVariables = node.variables.map(v => ({ name: v.name, weight: v.weight }));
        activeVariables = record.snapshotVariables;
      } else {
        record.snapshotVariables = [];
        activeVariables = [];
      }
    }
    // ===== AKHIR POLA SNAPSHOT =====

    // Hitung realisasi menggunakan snapshot metode yang sudah terkunci
    let realisasi;
    try {
      realisasi = this.computeRealisasi(activeMetode, variablesRealization, activeVariables);
    } catch (calcErr) {
      throw calcErr;
    }

    // Jika metode tidak dikenal / fallback, gunakan nilai manual
    if (realisasi === null) {
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

    // Simpan variabel dinamis
    if (Array.isArray(variablesRealization) && variablesRealization.length > 0) {
      record.variablesRealization = variablesRealization.map(v => ({
        name: v.name,
        value: v.value !== undefined && v.value !== '' ? parseFloat(v.value) : null,
        isConstant: v.isConstant === true || v.isConstant === 'true',
        buktiDukung: v.buktiDukung || ''
      }));
    }

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
