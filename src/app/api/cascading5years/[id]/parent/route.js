import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';
import { checkPlanningLock } from '@/lib/lock-check';
import Cascading5YearsService from '@/services/Cascading5YearsService';

export async function PATCH(request, { params }) {
  try {
    await dbConnect();
    const lockResponse = await checkPlanningLock(request);
    if (lockResponse) return lockResponse;

    const { id } = await params;
    const body = await request.json();
    const { parentId } = body;

    const requesterRole = request.headers.get('x-requester-role') || '';
    const requesterBidang = request.headers.get('x-requester-bidang') || '';

    const node = await Cascading5Years.findOne({ id });
    if (!node) {
      return NextResponse.json({ error: 'Node tidak ditemukan' }, { status: 404 });
    }

    if (requesterRole === 'admin_bidang') {
      if (node.level === 'tujuan') {
        return NextResponse.json({ error: 'Admin Bidang tidak diijinkan mengelola Tujuan Strategis.' }, { status: 403 });
      }
      const hasAccess = node.bidangPengampu.every(b => requesterBidang === b);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Anda tidak diijinkan memindahkan node di luar pengampuan bidang Anda.' }, { status: 403 });
      }
    }

    if (!parentId) {
      return NextResponse.json({ error: 'parentId baru tidak valid' }, { status: 400 });
    }

    const oldParentId = node.parentId;
    if (oldParentId === parentId) {
      return NextResponse.json({ error: 'Node sudah berada di parent tersebut' }, { status: 400 });
    }

    const newParent = await Cascading5Years.findOne({ id: parentId });
    if (!newParent) {
      return NextResponse.json({ error: 'Parent tujuan tidak ditemukan' }, { status: 404 });
    }

    // Assign new parent
    node.parentId = parentId;
    await node.save();

    // Propagate bidirectional changes
    if (oldParentId) {
      await Cascading5YearsService.propagateBidangUpwards(oldParentId);
    }
    await Cascading5YearsService.propagateBidangUpwards(parentId);

    return NextResponse.json({ message: 'Berhasil memindahkan node', data: node });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
