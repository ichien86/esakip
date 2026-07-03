import EmployeeRepository from '@/repositories/EmployeeRepository';
import CascadingAnnualRepository from '@/repositories/CascadingAnnualRepository';
import MasterRepository from '@/repositories/MasterRepository';
import PerjakinDocumentRepository from '@/repositories/PerjakinDocumentRepository';
import crypto from 'crypto';

class PerjakinService {
  async getPerjakinData(employeeId, tahun) {
    if (!employeeId || !tahun) {
      const err = new Error('ID Pegawai dan Tahun wajib diisi');
      err.status = 400;
      throw err;
    }

    // 1. Dapatkan Data Pihak Pertama (Pegawai)
    const pihakPertama = await EmployeeRepository.findOne({ id: employeeId });
    if (!pihakPertama) {
      const err = new Error('Pegawai tidak ditemukan');
      err.status = 404;
      throw err;
    }

    // 2. Dapatkan Data Pihak Kedua (Atasan)
    let pihakKedua = null;

    if (pihakPertama.jenisJabatan === 'Pimpinan Tinggi' || pihakPertama.roles.includes('bupati')) {
      // Atasan Pimpinan Tinggi adalah Bupati
      pihakKedua = await EmployeeRepository.findOne({ roles: 'bupati' });
      if (!pihakKedua) {
        const Setting = (await import('@/models/Setting')).default;
        const bupatiSetting = await Setting.findOne({ key: 'bupati_name' });
        const namaBupati = bupatiSetting ? bupatiSetting.value : 'Agus Irawan';
        
        pihakKedua = {
          nama: namaBupati,
          jabatan: 'Bupati Boyolali',
          nip: '-'
        };
      }
    } else {
      if (pihakPertama.parentId) {
        pihakKedua = await EmployeeRepository.findOne({ id: pihakPertama.parentId });
      } else {
        // Jika tidak ada atasan (meskipun bukan pimpinan tinggi), set fallback
        pihakKedua = {
          nama: 'Belum Ditentukan',
          jabatan: 'Atasan Langsung',
          nip: '-',
          pangkatGolongan: ''
        };
      }
    }

    // 3. Dapatkan Indikator Kinerja yang menjadi tanggung jawab pegawai ini
    // Untuk Pimpinan Tinggi, biasanya IKU Sasaran Badan/Program. 
    // Untuk Kabid/Administrator, IKU Program/Kegiatan.
    // Untuk Pengawas/JFT/JFU, IKU Subkegiatan/Aktivitas.

    const IndicatorAnnual = (await import('@/models/IndicatorAnnual')).default;
    const allAnnualIndicators = await IndicatorAnnual.find({ tahun: Number(tahun) });
    
    const assignedIndicators = allAnnualIndicators.filter(ind => {
      if (!ind.penanggungJawab) return false;
      const pics = ind.penanggungJawab.split(',').map(s => s.trim());
      // Check exact match for employeeId
      if (pics.includes(pihakPertama.id)) return true;
      // Check role based (e.g. jabatan:Kepala Bidang)
      if (pics.includes(`jabatan:${pihakPertama.jabatan}`)) return true;
      return false;
    });

    // Load parent nodes in batch
    const nodeIds = [...new Set(assignedIndicators.map(ind => ind.nodeId))];
    const parentNodes = await CascadingAnnualRepository.find({ id: { $in: nodeIds }, tahun: Number(tahun) });
    const nodesById = {};
    parentNodes.forEach(node => {
      nodesById[node.id] = typeof node.toObject === 'function' ? node.toObject() : node;
    });

    // 4. Dapatkan Status Dokumen Perjakin (Berdasarkan status Renaksi target bulanan)
    const RenaksiRepository = (await import('@/repositories/RenaksiRepository')).default;
    const renaksiRecords = await RenaksiRepository.find({ employeeId, tahun: Number(tahun) });

    // Urutkan dan format data indikator untuk dicetak
    const perjakinItems = assignedIndicators.map(ind => {
      const parentNode = nodesById[ind.nodeId] || {};

      // Hitung target efektif — untuk Split, ambil porsi milik pegawai ini
      let effectiveTarget = ind.target;
      if (ind.crossCuttingType === 'split' && ind.splitTargets) {
        const splitMap = typeof ind.splitTargets.toObject === 'function'
          ? ind.splitTargets.toObject()
          : (ind.splitTargets || {});
        // Cari berdasarkan employee ID dulu
        let portion = parseFloat(splitMap[pihakPertama.id]);
        // Fallback: cari berdasarkan jabatan
        if (isNaN(portion) && pihakPertama.jabatan) {
          portion = parseFloat(splitMap[`jabatan:${pihakPertama.jabatan}`]);
        }
        if (!isNaN(portion)) {
          effectiveTarget = portion.toString();
        }
      }

      // Ambil rencana aksi (target bulanan) dari renaksiRecords
      const aksiBulanan = {};
      for (let i = 1; i <= 12; i++) {
        const rek = renaksiRecords.find(r => r.indicatorId === ind.id && r.bulan === i);
        aksiBulanan[i] = rek && rek.targetBulanan !== null ? rek.targetBulanan : 0;
      }

      return {
        id: ind.id,
        sasaran: parentNode.sasaran || parentNode.text || '-',
        indikator: ind.indikator,
        target: effectiveTarget,
        targetPenuh: ind.target,           // target asli (untuk referensi)
        isSplit: ind.crossCuttingType === 'split',
        satuan: ind.satuan,
        anggaran: parentNode.anggaran || 0,
        rencanaAksi: aksiBulanan
      };
    });

    // 4. Dapatkan Status Dokumen Perjakin
    const PerjakinDocumentRepository = (await import('@/repositories/PerjakinDocumentRepository')).default;
    const existingDoc = await PerjakinDocumentRepository.findOne({ employeeId, tahun: Number(tahun) });
    
    let docStatus = 'Draft';
    let docHistory = [];
    
    if (existingDoc && existingDoc.status) {
      docStatus = existingDoc.status;
      docHistory = existingDoc.history || [];
    } else {
      const RenaksiRepository = (await import('@/repositories/RenaksiRepository')).default;
      const renaksiRecords = await RenaksiRepository.find({ employeeId, tahun: Number(tahun) });

      if (renaksiRecords.length > 0) {
        if (renaksiRecords.some(r => r.status === 'Target_Ditolak')) {
          docStatus = 'Target_Ditolak';
        } else if (renaksiRecords.some(r => ['Target_Diajukan', 'Target_ACC_Admin'].includes(r.status))) {
          docStatus = 'Target_Diajukan'; // Menunggu Verifikasi
        } else if (renaksiRecords.every(r => r.status === 'Target_Disetujui')) {
          docStatus = 'Target_Disetujui';
        }
      }
    }

    return {
      tahun,
      status: docStatus,
      history: docHistory,
      pihakPertama: {
        nama: pihakPertama.nama,
        nip: pihakPertama.nip,
        jabatan: pihakPertama.jabatan,
        jenisJabatan: pihakPertama.jenisJabatan || 'JFU',
        pangkatGolongan: pihakPertama.pangkatGolongan || '',
        roles: pihakPertama.roles
      },
      pihakKedua: {
        id: pihakKedua.id || null,
        nama: pihakKedua.nama,
        nip: pihakKedua.nip,
        jabatan: pihakKedua.jabatan,
        pangkatGolongan: pihakKedua.pangkatGolongan || ''
      },
      items: perjakinItems
    };
  }

  async changeDocumentStatus(employeeId, tahun, newStatus, actorRole, actorName, notes = '') {
    if (!employeeId || !tahun || !newStatus) {
      throw new Error('Data tidak lengkap untuk mengubah status');
    }

    let document = await PerjakinDocumentRepository.findOne({ employeeId, tahun: Number(tahun) });
    
    const historyEntry = {
      status: newStatus,
      actorRole,
      actorName,
      timestamp: new Date(),
      notes
    };

    if (!document) {
      document = await PerjakinDocumentRepository.create({
        id: crypto.randomUUID(),
        employeeId,
        tahun: Number(tahun),
        status: newStatus,
        history: [historyEntry]
      });
    } else {
      document = await PerjakinDocumentRepository.update(
        { employeeId, tahun: Number(tahun) },
        { 
          status: newStatus,
          $push: { history: historyEntry }
        }
      );
    }

    return document;
  }
}

export default new PerjakinService();
