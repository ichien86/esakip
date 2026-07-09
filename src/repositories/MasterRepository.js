import dbConnect from '@/lib/db';
import MasterProgram from '@/models/MasterProgram';
import MasterKegiatan from '@/models/MasterKegiatan';
import MasterSubkegiatan from '@/models/MasterSubkegiatan';

class MasterRepository {
  async findPrograms() {
    await dbConnect();
    return MasterProgram.find({}).sort({ id: 1 });
  }

  async findProgramById(id) {
    await dbConnect();
    return MasterProgram.findOne({ id });
  }

  async saveProgram(programData) {
    await dbConnect();
    let item = await MasterProgram.findOne({ id: programData.id });
    if (item) {
      Object.assign(item, programData);
      return item.save();
    } else {
      item = new MasterProgram(programData);
      return item.save();
    }
  }

  async findKegiatans() {
    await dbConnect();
    return MasterKegiatan.find({}).sort({ id: 1 });
  }

  async findKegiatanById(id) {
    await dbConnect();
    return MasterKegiatan.findOne({ id });
  }

  async saveKegiatan(kegiatanData) {
    await dbConnect();
    let item = await MasterKegiatan.findOne({ id: kegiatanData.id });
    if (item) {
      Object.assign(item, kegiatanData);
      return item.save();
    } else {
      item = new MasterKegiatan(kegiatanData);
      return item.save();
    }
  }

  async findSubkegiatans() {
    await dbConnect();
    return MasterSubkegiatan.find({}).sort({ id: 1 });
  }

  async findSubkegiatanById(id) {
    await dbConnect();
    return MasterSubkegiatan.findOne({ id });
  }

  async saveSubkegiatan(subkegiatanData) {
    await dbConnect();
    let item = await MasterSubkegiatan.findOne({ id: subkegiatanData.id });
    if (item) {
      Object.assign(item, subkegiatanData);
      return item.save();
    } else {
      item = new MasterSubkegiatan(subkegiatanData);
      return item.save();
    }
  }
}

const masterRepository = new MasterRepository();
export default masterRepository;
