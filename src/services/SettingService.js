import SettingRepository from '@/repositories/SettingRepository';

class SettingService {
  async getAllSettings() {
    const settings = await SettingRepository.findAll();
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    if (settingsObj.planning_locked === undefined) {
      settingsObj.planning_locked = false;
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
