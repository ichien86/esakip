import SettingRepository from '@/repositories/SettingRepository';

class SettingService {
  async getAllSettings() {
    const settings = await SettingRepository.findAll();
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    if (settingsObj.renstra_locked === undefined) {
      settingsObj.renstra_locked = false;
    }
    if (settingsObj.renja_locked === undefined) {
      settingsObj.renja_locked = false;
    }
    return settingsObj;
  }

  async updateSetting({ key, value, requesterRole }) {
    if (requesterRole !== 'admin') {
      const err = new Error('Akses ditolak. Hanya Administrator Sistem yang dapat mengubah pengaturan sistem.');
      err.status = 403;
      throw err;
    }

    if (!key || value === undefined) {
      const err = new Error('Key dan Value wajib diisi');
      err.status = 400;
      throw err;
    }

    if (key === 'renja_locked' && value === true) {
      const RenaksiRepository = (await import('@/repositories/RenaksiRepository')).default;
      const unapprovedTargets = await RenaksiRepository.find({
        status: { $ne: 'Target_Disetujui' }
      });

      if (unapprovedTargets.length > 0) {
        const err = new Error(`Sistem ditolak untuk dikunci! Terdapat ${unapprovedTargets.length} target Renaksi yang belum mencapai status "Target Disetujui" (masih Draft, Diajukan, ACC Admin, atau Ditolak). Harap pastikan seluruh target pegawai telah disetujui oleh pimpinannya.`);
        err.status = 400;
        throw err;
      }
    }

    if (key === 'renstra_locked' && value === true) {
      const Cascading5Years = (await import('@/models/Cascading5Years')).default;
      const Indicator5Years = (await import('@/models/Indicator5Years')).default;

      const allNodes = await Cascading5Years.find({});
      
      // 1. Validasi Cascading harus sampai Subkegiatan
      // Cari leaf nodes (node yang tidak menjadi parent bagi node manapun)
      const parentIds = new Set(allNodes.map(n => n.parentId).filter(Boolean));
      const leafNodes = allNodes.filter(n => !parentIds.has(n.id));
      
      const incompleteBranch = leafNodes.find(n => {
        const lvl = (n.level || '').toLowerCase();
        return !['subkegiatan', 'aktivitas'].includes(lvl);
      });
      
      if (incompleteBranch) {
        const err = new Error(`Renstra ditolak untuk dikunci! Cascading terputus pada node "${incompleteBranch.text}" (Level: ${incompleteBranch.level}). Anda wajib menurunkan/memecah target tersebut minimal hingga level Subkegiatan.`);
        err.status = 400;
        throw err;
      }

      // 2. Validasi Definisi Operasional (Node Utama)
      const missingNodeDef = allNodes.find(n => !n.definisiOperasional || n.definisiOperasional.trim() === '');
      if (missingNodeDef) {
        const err = new Error(`Renstra ditolak untuk dikunci! Indikator utama pada node "${missingNodeDef.text}" (Level: ${missingNodeDef.level}) belum memiliki Definisi Operasional. Harap lengkapi terlebih dahulu.`);
        err.status = 400;
        throw err;
      }

      // 3. Validasi Definisi Operasional (Indikator Tambahan)
      const allIndicators = await Indicator5Years.find({});
      const missingIndDef = allIndicators.find(ind => !ind.definisiOperasional || ind.definisiOperasional.trim() === '');
      if (missingIndDef) {
        const parentNode = allNodes.find(n => n.id === missingIndDef.nodeId);
        const err = new Error(`Renstra ditolak untuk dikunci! Indikator tambahan "${missingIndDef.indikator}" pada node "${parentNode ? parentNode.text : 'Unknown'}" belum memiliki Definisi Operasional. Harap lengkapi terlebih dahulu.`);
        err.status = 400;
        throw err;
      }
    }

    let setting = await SettingRepository.findOne({ key });
    if (setting) {
      setting.value = value;
      await SettingRepository.saveDocument(setting);
    } else {
      setting = await SettingRepository.create({ key, value });
    }

    return setting;
  }
}

export default new SettingService();
