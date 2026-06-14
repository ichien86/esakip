import dbConnect from '@/lib/db';
import Indicator5Years from '@/models/Indicator5Years';

export class Indicator5YearsRepository {
  async findAll() {
    await dbConnect();
    return Indicator5Years.find({}).sort({ order: 1 });
  }

  async find(filter) {
    await dbConnect();
    return Indicator5Years.find(filter).sort({ order: 1 });
  }

  async findOne(filter) {
    await dbConnect();
    return Indicator5Years.findOne(filter);
  }

  async saveDocument(document) {
    return document.save();
  }

  async createOrUpdate(itemData) {
    await dbConnect();
    let item = await Indicator5Years.findOne({ id: itemData.id });
    if (item) {
      Object.assign(item, itemData);
      return item.save();
    } else {
      item = new Indicator5Years(itemData);
      return item.save();
    }
  }

  async deleteMany(filter) {
    await dbConnect();
    return Indicator5Years.deleteMany(filter);
  }

  async deleteOne(filter) {
    await dbConnect();
    return Indicator5Years.deleteOne(filter);
  }

  async bulkWrite(ops) {
    await dbConnect();
    return Indicator5Years.bulkWrite(ops);
  }
}

export default new Indicator5YearsRepository();
