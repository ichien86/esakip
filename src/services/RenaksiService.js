import RenaksiRepository from '@/repositories/RenaksiRepository';
import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import IndicatorAnnualRepository from '@/repositories/IndicatorAnnualRepository';
import Employee from '@/models/Employee';
import Setting from '@/models/Setting';
import RealisasiSchedule from '@/models/RealisasiSchedule';
import Renaksi from '@/models/Renaksi';
import LinkVerificationService from './LinkVerificationService';

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
      // Ambil dari IndicatorAnnual karena crossCuttingType & splitTargets disimpan di sana
      const indAnnual = await IndicatorAnnualRepository.findOne({ id: indicatorId, tahun: yearNum });
      const node = indAnnual || await CascadingAnnualRepository.findOne({ id: indicatorId, tahun: yearNum });
      if (node?.tipeTarget === 'Akumulatif') {
        // Validation moved to submitTargets to allow saving partial drafts
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
          const err = new Error(`Validasi Gagal: Indikator "${node.indikator || node.text}" bertipe non-akumulatif (${node.tipeTarget}). Setiap bulan wajib diisi sebagai proses target, tidak boleh ada bulan yang kosong.`);
          err.status = 400;
          throw err;
        }
      } else {
        const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
        const emp = await EmployeeRepository.findOne({ id: employeeId });
        let annualTarget = parseFloat(node.target) || 0;

        if (node.crossCuttingType === 'split' && node.splitTargets) {
          const splitTargets = typeof node.splitTargets.toObject === 'function' ? node.splitTargets.toObject() : node.splitTargets;
          let portion = parseFloat(splitTargets[employeeId]);
          if (isNaN(portion) && emp?.jabatan) {
            portion = parseFloat(splitTargets[`jabatan:${emp.jabatan}`]);
          }
          if (!isNaN(portion)) {
            annualTarget = portion;
          }
        }

        const monthlySum = nodeDrafts.reduce((sum, item) => sum + (parseFloat(item.targetBulanan) || 0), 0);
        if (Math.abs(monthlySum - annualTarget) > 0.05) {
          const err = new Error(`Validasi Gagal: Indikator "${node.indikator || node.text}" bertipe Akumulatif. Jumlah target bulanan harus persis ${annualTarget} ${node.satuan || ''} (Input saat ini: ${monthlySum}).`);
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

  async revisiTargets(employeeId, requestYear) {
    if (!employeeId) {
      const err = new Error('employeeId wajib diisi');
      err.status = 400;
      throw err;
    }
    const yearNum = parseInt(requestYear || '2026');

    // Pastikan tidak dikunci admin
    const lockSetting = await Setting.findOne({ key: 'renja_locked' });
    if (lockSetting && lockSetting.value === true) {
      const err = new Error('Revisi ditolak karena sistem telah dikunci oleh Administrator.');
      err.status = 403;
      throw err;
    }

    // Set semua yang Target_Disetujui menjadi Draft
    const RenaksiRepository = (await import('@/repositories/RenaksiRepository')).default;
    const result = await RenaksiRepository.updateMany(
      { employeeId, tahun: yearNum, status: { $in: ['Target_Disetujui', 'Target_Diajukan', 'Target_ACC_Admin', 'Target_Ditolak'] } },
      { $set: { status: 'Draft' } }
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

    // Cek tindak lanjut rekomendasi bulan lalu
    let prevMonth = bulan - 1;
    let prevYear = record.tahun;
    
    if (bulan === 1) {
      prevMonth = 12;
      prevYear = record.tahun - 1;
    }

    if (bulan > 1 || prevYear > 0) {
      const uncompletedRecs = await RenaksiRepository.find({
        employeeId: employeeId,
        tahun: prevYear,
        bulan: prevMonth,
        statusRekomendasi: 'Menunggu Tindak Lanjut'
      });

      if (uncompletedRecs && uncompletedRecs.length > 0) {
        const err = new Error(`Anda memiliki rekomendasi kinerja pada Bulan ${prevMonth} Tahun ${prevYear} yang belum ditindaklanjuti. Harap selesaikan terlebih dahulu sebelum mengisi realisasi.`);
        err.status = 403;
        throw err;
      }
    }

    // Check if realization has already been approved / verified
    if (record.status === 'ACC_Admin' || record.status === 'Disetujui') {
      const err = new Error(`Pengisian realisasi untuk Bulan ${bulan} tahun ${record.tahun || 2026} tidak dapat diubah karena telah di-ACC/Disetujui oleh atasan.`);
      err.status = 403;
      throw err;
    }

    // If pegawai is re-submitting after rejection, clear the admin rejection note
    if (record.status === 'Ditolak Admin') {
      record.catatanAdmin = '';
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

    // Hitung persentase capaian bulanan (tanpa batas atas, sesuai kebijakan)
    let capaianBulanan = null;
    const isDecreasingTarget = node && node.tipeTarget === 'Kondisi Akhir Menurun';
    if (target === 0) {
      if (isDecreasingTarget) {
        // Target menurun: sempurna jika realisasi juga 0, sebaliknya 0%
        capaianBulanan = realisasi === 0 ? 100 : 0;
      } else {
        // Target normal/akumulatif: realisasi >= 0 adalah percepatan/keberhasilan
        capaianBulanan = realisasi >= 0 ? 100 : 0;
      }
    } else if (isDecreasingTarget) {
      // Target menurun: makin kecil makin baik — rumus dibalik
      capaianBulanan = realisasi === 0 ? 100 : parseFloat(((target / realisasi) * 100).toFixed(2));
    } else {
      capaianBulanan = parseFloat(((realisasi / target) * 100).toFixed(2));
    }

    const isDecreasing = isDecreasingTarget;
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
    record.capaianBulanan = capaianBulanan;

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

  async approveRealisasi(id, requesterRole, rekomendasiAtasan = '') {
    const record = await RenaksiRepository.findOne({ id });
    if (!record) throw Object.assign(new Error('Data renaksi tidak ditemukan'), { status: 404 });

    const EmployeeRepository = (await import('@/repositories/EmployeeRepository')).default;
    const emp = await EmployeeRepository.findOne({ id: record.employeeId });
    if (!emp) throw Object.assign(new Error('Employee not found'), { status: 404 });

    if (record.status !== 'Diajukan' && record.status !== 'Ditolak Admin' && record.status !== 'ACC_Admin') {
      throw Object.assign(new Error(`Realisasi dengan status ${record.status} tidak dapat diproses.`), { status: 400 });
    }

    let nextStatus = 'Disetujui';

    if (emp.jenisJabatan === 'Pimpinan Tinggi') {
      if (requesterRole === 'perencana') {
        if (record.status !== 'Diajukan' && record.status !== 'Ditolak Admin') throw Object.assign(new Error('Realisasi belum diajukan.'), { status: 400 });
        nextStatus = 'Disetujui';
      } else {
        throw Object.assign(new Error('Realisasi Pimpinan Tinggi hanya dapat disetujui oleh Admin Perencana.'), { status: 403 });
      }
    } else if (emp.jenisJabatan === 'Administrator') {
      if (requesterRole === 'perencana') {
        if (record.status !== 'Diajukan' && record.status !== 'Ditolak Admin') throw Object.assign(new Error('Realisasi belum diajukan.'), { status: 400 });
        nextStatus = 'ACC_Admin';
      } else if (requesterRole === 'pemimpin') {
        if (record.status !== 'ACC_Admin') throw Object.assign(new Error('Realisasi harus di-ACC Admin Perencana sebelum divalidasi Pimpinan Tinggi.'), { status: 400 });
        nextStatus = 'Disetujui';
      } else {
        throw Object.assign(new Error('Realisasi Administrator diverifikasi oleh Admin Perencana dan disetujui Pimpinan Tinggi.'), { status: 403 });
      }
    } else { // Pengawas & Fungsional
      if (requesterRole === 'admin_bidang') {
        if (record.status !== 'Diajukan' && record.status !== 'Ditolak Admin') throw Object.assign(new Error('Realisasi belum diajukan.'), { status: 400 });
        nextStatus = 'ACC_Admin';
      } else if (requesterRole === 'pemimpin') {
        if (record.status !== 'ACC_Admin') throw Object.assign(new Error('Realisasi harus di-ACC Admin Unit sebelum divalidasi Administrator.'), { status: 400 });
        nextStatus = 'Disetujui';
      } else {
        throw Object.assign(new Error('Realisasi Pengawas/Fungsional diverifikasi oleh Admin Unit dan disetujui Administrator.'), { status: 403 });
      }
    }

    // Logic Rekomendasi Atasan (Hanya dieksekusi saat status FINAL = Disetujui)
    if (nextStatus === 'Disetujui') {
      if (record.capaianBulanan < 100) { // Underperforming
        if (!rekomendasiAtasan || rekomendasiAtasan.trim() === '') {
          throw Object.assign(new Error('Capaian di bawah target. Rekomendasi dari atasan wajib diisi.'), { status: 400 });
        }
        record.rekomendasiAtasan = rekomendasiAtasan;
        record.statusRekomendasi = 'Menunggu Tindak Lanjut';
      } else { // Sesuai/Melebihi target
        if (rekomendasiAtasan && rekomendasiAtasan.trim() !== '') {
          record.rekomendasiAtasan = rekomendasiAtasan;
          record.statusRekomendasi = 'Selesai';
        }
      }
    }

    record.status = nextStatus;
    record.catatanAdmin = ''; 
    record.isCrossCuttingSelected = true;
    await RenaksiRepository.saveDocument(record);

    if (requesterRole === 'admin_bidang' || requesterRole === 'perencana') {
       let query = {
          id: { $ne: record.id },
          indicatorId: record.indicatorId,
          tahun: record.tahun,
          bulan: record.bulan
       };
       if (requesterRole === 'admin_bidang') query.bidang = record.bidang;
       await RenaksiRepository.updateMany(query, { $set: { isCrossCuttingSelected: false } });
    }

    return record;
  }

  async saveTindakLanjutRekomendasi(id, tindakLanjut, buktiDukung) {
    if (!tindakLanjut || tindakLanjut.trim() === '') {
      throw Object.assign(new Error('Tindak lanjut rekomendasi wajib diisi.'), { status: 400 });
    }
    if (!buktiDukung || buktiDukung.trim() === '') {
      throw Object.assign(new Error('Bukti dukung tindak lanjut wajib dilampirkan.'), { status: 400 });
    }
    
    // Validate Link
    const isValid = await LinkVerificationService.verifyLink(buktiDukung);
    if (!isValid) {
      throw Object.assign(new Error('Tautan bukti dukung tidak valid atau tidak dapat diakses.'), { status: 400 });
    }

    const record = await RenaksiRepository.findOne({ id });
    if (!record) {
      throw Object.assign(new Error('Data renaksi tidak ditemukan.'), { status: 404 });
    }
    
    if (record.statusRekomendasi !== 'Menunggu Tindak Lanjut') {
      throw Object.assign(new Error('Rekomendasi ini tidak sedang menunggu tindak lanjut.'), { status: 400 });
    }

    record.tindakLanjutRekomendasi = tindakLanjut;
    record.buktiDukungTindakLanjut = buktiDukung;
    record.statusRekomendasi = 'Selesai';

    await RenaksiRepository.saveDocument(record);
    return record;
  }
}

export default new RenaksiService();
