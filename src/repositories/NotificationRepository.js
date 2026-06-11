import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';

class NotificationRepository {
  async find(filter) {
    await dbConnect();
    return Notification.find(filter).sort({ createdAt: -1 });
  }

  async findOne(filter) {
    await dbConnect();
    return Notification.findOne(filter);
  }

  async saveDocument(document) {
    return document.save();
  }
}

export default new NotificationRepository();
