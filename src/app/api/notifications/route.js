import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';

export async function GET(request) {
  try {
    await dbConnect();
    const requesterRole = request.headers.get('x-requester-role') || '';
    const requesterBidang = request.headers.get('x-requester-bidang') || '';

    let filter = {};
    if (requesterRole === 'admin_bidang' || requesterRole === 'pemimpin') {
      filter = { bidang: requesterBidang, isRead: false };
    } else if (requesterRole === 'admin' || requesterRole === 'perencana') {
      filter = { isRead: false };
    } else {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const notifications = await Notification.find(filter).sort({ createdAt: -1 });
    return NextResponse.json(notifications);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await dbConnect();
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID notifikasi wajib diisi' }, { status: 400 });
    }

    const notification = await Notification.findOne({ id });
    if (!notification) {
      return NextResponse.json({ error: 'Notifikasi tidak ditemukan' }, { status: 404 });
    }

    notification.isRead = true;
    await notification.save();

    return NextResponse.json({ message: 'Notifikasi berhasil ditandai sebagai dibaca', data: notification });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
