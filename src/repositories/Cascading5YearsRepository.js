import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';

export class Cascading5YearsRepository {
  /**
   * Mengambil semua data Cascading5Years dari database.
   * @returns {Promise<Array>} Array of Cascading5Years objects.
   */
  async findAll() {
    await dbConnect();
    return Cascading5Years.find({});
  }

  /**
   * Mencari satu Cascading5Years berdasarkan filter.
   */
  async findOne(filter) {
    await dbConnect();
    return Cascading5Years.findOne(filter);
  }

  /**
   * Menyimpan dokumen Cascading5Years (untuk proses sync target dan anggaran).
   * Menerima instance Mongoose dan memanggil save().
   */
  async saveDocument(document) {
    return document.save();
  }

  /**
   * Mengambil beberapa Cascading5Years berdasarkan filter.
   */
  async find(filter) {
    await dbConnect();
    return Cascading5Years.find(filter);
  }

  /**
   * Menyimpan Cascading5Years baru atau yang sudah ada (menggunakan Mongoose save).
   */
  async createOrUpdate(itemData) {
    await dbConnect();
    let item = await Cascading5Years.findOne({ id: itemData.id });
    if (item) {
      Object.assign(item, itemData);
      return item.save();
    } else {
      item = new Cascading5Years(itemData);
      return item.save();
    }
  }
}

const cascading5YearsRepository = new Cascading5YearsRepository();
export default cascading5YearsRepository;
