import dbConnect from '@/lib/db';
import IndicatorAnnual from '@/models/IndicatorAnnual';

export class IndicatorAnnualRepository {
  async findAll() {
    await dbConnect();
    return IndicatorAnnual.find({});
  }

  async find(filter) {
    await dbConnect();
    return IndicatorAnnual.find(filter);
  }

  async findOne(filter) {
    await dbConnect();
    return IndicatorAnnual.findOne(filter);
  }

  async saveDocument(document) {
    return document.save();
  }

  async createOrUpdate(itemData) {
    await dbConnect();
    let item = await IndicatorAnnual.findOne({ id: itemData.id });
    if (item) {
      Object.assign(item, itemData);
      return item.save();
    } else {
      item = new IndicatorAnnual(itemData);
      return item.save();
    }
  }

  async updateOne(filter, updateData) {
    await dbConnect();
    return IndicatorAnnual.updateOne(filter, updateData);
  }

  async updateMany(filter, updateData) {
    await dbConnect();
    return IndicatorAnnual.updateMany(filter, updateData);
  }

  async deleteMany(filter) {
    await dbConnect();
    return IndicatorAnnual.deleteMany(filter);
  }

  async deleteOne(filter) {
    await dbConnect();
    return IndicatorAnnual.deleteOne(filter);
  }

  async bulkWrite(ops) {
    await dbConnect();
    return IndicatorAnnual.bulkWrite(ops);
  }
}

export default new IndicatorAnnualRepository();
