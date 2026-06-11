import PerjakinDocument from '@/models/PerjakinDocument';
import dbConnect from '@/lib/db';

class PerjakinDocumentRepository {
  async findOne(query) {
    await dbConnect();
    const doc = await PerjakinDocument.findOne(query).lean();
    if (doc) {
      doc._id = doc._id.toString();
    }
    return doc;
  }

  async find(query) {
    await dbConnect();
    const docs = await PerjakinDocument.find(query).sort({ updatedAt: -1 }).lean();
    return docs.map(doc => {
      doc._id = doc._id.toString();
      return doc;
    });
  }

  async create(data) {
    await dbConnect();
    const doc = new PerjakinDocument(data);
    await doc.save();
    const saved = doc.toObject();
    saved._id = saved._id.toString();
    return saved;
  }

  async update(query, data) {
    await dbConnect();
    const updated = await PerjakinDocument.findOneAndUpdate(query, data, { new: true }).lean();
    if (updated) {
      updated._id = updated._id.toString();
    }
    return updated;
  }

  async delete(query) {
    await dbConnect();
    return await PerjakinDocument.deleteOne(query);
  }
}

export default new PerjakinDocumentRepository();
