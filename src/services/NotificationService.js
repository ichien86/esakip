import NotificationRepository from '@/repositories/NotificationRepository';

class NotificationService {
  async getNotifications(requesterRole, requesterBidang) {
    let filter = {};
    if (requesterRole === 'admin_bidang' || requesterRole === 'pemimpin') {
      filter = { bidang: requesterBidang, isRead: false };
    } else if (requesterRole === 'admin' || requesterRole === 'perencana') {
      filter = { isRead: false };
    } else {
      const err = new Error('Akses ditolak.');
      err.status = 403;
      throw err;
    }

    const notifications = await NotificationRepository.find(filter);
    return notifications;
  }

  async markAsRead(id) {
    if (!id) {
      const err = new Error('ID notifikasi wajib diisi');
      err.status = 400;
      throw err;
    }

    const notification = await NotificationRepository.findOne({ id });
    if (!notification) {
      const err = new Error('Notifikasi tidak ditemukan');
      err.status = 404;
      throw err;
    }

    notification.isRead = true;
    await NotificationRepository.saveDocument(notification);

    return notification;
  }
}

const notificationService = new NotificationService();
export default notificationService;
