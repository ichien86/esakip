import dbConnect from '@/lib/db';
import CascadingAnnual from '@/models/CascadingAnnual';

export class CascadingAnnualRepository {
  /**
   * Mengambil semua data CascadingAnnual dari database.
   * @returns {Promise<Array>} Array of CascadingAnnual objects.
   */
  async findAll() {
    await dbConnect();
    return CascadingAnnual.find({});
  }

  /**
   * Mencari satu CascadingAnnual berdasarkan filter.
   */
  async findOne(filter) {
    await dbConnect();
    return CascadingAnnual.findOne(filter);
  }

  /**
   * Menyimpan CascadingAnnual baru atau yang sudah ada (menggunakan Mongoose save).
   * Dalam arsitektur clean ideal, ini harus memisahkan create dan update murni.
   */
  async createOrUpdate(itemData) {
    await dbConnect();
    let item = await CascadingAnnual.findOne({ id: itemData.id });
    if (item) {
      Object.assign(item, itemData);
      return item.save();
    } else {
      item = new CascadingAnnual(itemData);
      return item.save();
    }
  }

  /**
   * Mengambil beberapa data CascadingAnnual berdasarkan filter.
   */
  async find(filter) {
    await dbConnect();
    return CascadingAnnual.find(filter);
  }

  /**
   * Memperbarui satu data CascadingAnnual.
   */
  async updateOne(filter, updateData) {
    await dbConnect();
    return CascadingAnnual.updateOne(filter, updateData);
  }

  /**
   * Memperbarui banyak data CascadingAnnual.
   */
  async updateMany(filter, updateData) {
    await dbConnect();
    return CascadingAnnual.updateMany(filter, updateData);
  }
}

export default new CascadingAnnualRepository();
