import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CascadingAnnual from '@/models/CascadingAnnual';
import { checkPlanningLock } from '@/lib/lock-check';

export async function DELETE(request, { params }) {
  try {
    await dbConnect();
    const lockResponse = await checkPlanningLock(request, 'renja');
    if (lockResponse) return lockResponse;

    const { id } = await params;
    
    const requesterRole = request.headers.get('x-requester-role') || '';
    const requesterBidang = request.headers.get('x-requester-bidang') || '';

    const node = await CascadingAnnual.findOne({ id });
    if (!node) {
      return NextResponse.json({ error: 'Node tidak ditemukan' }, { status: 404 });
    }

    if (requesterRole === 'admin_bidang') {
      if (node.level === 'tujuan' || node.level === 'sasaran') {
        return NextResponse.json({ error: 'Admin Bidang tidak diijinkan menghapus Tujuan / Sasaran Makro.' }, { status: 403 });
      }
      const hasAccess = node.bidangPengampu.every(b => requesterBidang === b);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Anda tidak diijinkan menghapus node di luar pengampuan bidang Anda.' }, { status: 403 });
      }
    }

    const allItems = await CascadingAnnual.find({});
    
    let idsToDelete = [id];
    let checkList = [id];

    while (checkList.length > 0) {
      const parent = checkList.pop();
      const children = allItems.filter(c => c.parentId === parent);
      children.forEach(child => {
        idsToDelete.push(child.id);
        checkList.push(child.id);
      });
    }

    await CascadingAnnual.deleteMany({ id: { $in: idsToDelete } });
    return NextResponse.json({ message: 'Berhasil menghapus item cascading beserta turunannya' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
