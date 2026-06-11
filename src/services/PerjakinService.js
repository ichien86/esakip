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
        pihakKedua = {
          nama: 'M. Said Hidayat, S.H.',
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
          nip: '-'
        };
      }
    }

    // 3. Dapatkan Indikator Kinerja yang menjadi tanggung jawab pegawai ini
    // Untuk Pimpinan Tinggi, biasanya IKU Sasaran Badan/Program. 
    // Untuk Kabid/Administrator, IKU Program/Kegiatan.
    // Untuk Pengawas/JFT/JFU, IKU Subkegiatan/Aktivitas.

    const allIndicators = await CascadingAnnualRepository.find({ tahun: Number(tahun) });
    
    const assignedIndicators = allIndicators.filter(ind => {
      if (!ind.penanggungJawab) return false;
      const pics = ind.penanggungJawab.split(',').map(s => s.trim());
      // Check exact match for employeeId
      if (pics.includes(pihakPertama.id)) return true;
      // Check role based (e.g. jabatan:Kepala Bidang)
      if (pics.includes(`jabatan:${pihakPertama.jabatan}`)) return true;
      return false;
    });

    // Urutkan dan format data indikator untuk dicetak
    const perjakinItems = assignedIndicators.map(ind => ({
      id: ind.id,
      sasaran: ind.sasaran || ind.text, // Teks sasaran/kegiatan
      indikator: ind.indikator,
      target: ind.target,
      satuan: ind.satuan,
      anggaran: ind.anggaran || 0
    }));

    // 4. Dapatkan Status Dokumen Perjakin
    let document = await PerjakinDocumentRepository.findOne({ employeeId, tahun: Number(tahun) });
    
    // Jika belum ada dokumen, buatkan status virtual Draft
    const docStatus = document ? document.status : 'Draft';
    const docHistory = document ? document.history : [];

    return {
      tahun,
      status: docStatus,
      history: docHistory,
      pihakPertama: {
        nama: pihakPertama.nama,
        nip: pihakPertama.nip,
        jabatan: pihakPertama.jabatan,
        jenisJabatan: pihakPertama.jenisJabatan || 'JFU',
        roles: pihakPertama.roles
      },
      pihakKedua: {
        id: pihakKedua.id || null,
        nama: pihakKedua.nama,
        nip: pihakKedua.nip,
        jabatan: pihakKedua.jabatan
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
