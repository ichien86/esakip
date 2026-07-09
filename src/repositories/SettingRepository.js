import dbConnect from '@/lib/db';
import Setting from '@/models/Setting';

class SettingRepository {
  async findAll() {
    await dbConnect();
    return Setting.find({});
  }

  async findOne(filter) {
    await dbConnect();
    return Setting.findOne(filter);
  }

  async saveDocument(document) {
    return document.save();
  }

  async create(data) {
    await dbConnect();
    const doc = new Setting(data);
    return doc.save();
  }
}

const settingRepository = new SettingRepository();
export default settingRepository;
