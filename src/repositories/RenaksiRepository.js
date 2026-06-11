import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';

export class RenaksiRepository {
  /**
   * Mengambil semua data Renaksi dari database.
   * @returns {Promise<Array>} Array of Renaksi objects.
   */
  async findAll() {
    await dbConnect();
    return Renaksi.find({});
  }

  /**
   * Mengambil beberapa data Renaksi berdasarkan filter.
   */
  async find(filter) {
    await dbConnect();
    return Renaksi.find(filter);
  }

  /**
   * Mengambil satu data Renaksi berdasarkan filter.
   */
  async findOne(filter) {
    await dbConnect();
    return Renaksi.findOne(filter);
  }

  /**
   * Menyimpan dokumen Renaksi (instance Mongoose).
   */
  async saveDocument(document) {
    return document.save();
  }

  /**
   * Update banyak dokumen.
   */
  async updateMany(filter, updateData) {
    await dbConnect();
    return Renaksi.updateMany(filter, updateData);
  }
}

export default new RenaksiRepository();
