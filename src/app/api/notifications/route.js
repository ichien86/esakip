import { NextResponse } from 'next/server';
import NotificationService from '@/services/NotificationService';
import { getValidatedUser } from '@/lib/api-auth';

export async function GET(request) {
  try {
    const { role: requesterRole } = getValidatedUser(request, request.headers.get('x-requester-role'));
    const requesterBidang = request.headers.get('x-requester-bidang') || '';

    const notifications = await NotificationService.getNotifications(requesterRole, requesterBidang);
    return NextResponse.json(notifications);
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function PUT(request) {
  try {
    const { id } = await request.json();
    const notification = await NotificationService.markAsRead(id);

    return NextResponse.json({ message: 'Notifikasi berhasil ditandai sebagai dibaca', data: notification });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
