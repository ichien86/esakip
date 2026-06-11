import dbConnect from '@/lib/db';
import Performance from '@/models/Performance';

class PerformanceRepository {
  async find(filter) {
    await dbConnect();
    return Performance.find(filter);
  }

  async findOne(filter) {
    await dbConnect();
    return Performance.findOne(filter);
  }

  async saveDocument(document) {
    return document.save();
  }
}

export default new PerformanceRepository();
