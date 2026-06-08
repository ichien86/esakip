import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';
import { checkPlanningLock } from '@/lib/lock-check';

export async function DELETE(request, { params }) {
  try {
    await dbConnect();
    const lockResponse = await checkPlanningLock(request);
    if (lockResponse) return lockResponse;

    const { id } = await params;
    
    const requesterRole = request.headers.get('x-requester-role') || '';
    const requesterBidang = request.headers.get('x-requester-bidang') || '';

    const node = await Cascading5Years.findOne({ id });
    if (!node) {
      return NextResponse.json({ error: 'Node tidak ditemukan' }, { status: 404 });
    }

    if (requesterRole === 'admin_bidang') {
      if (node.level === 'tujuan') {
        return NextResponse.json({ error: 'Admin Bidang tidak diijinkan menghapus Tujuan Strategis.' }, { status: 403 });
      }
      const hasAccess = node.bidangPengampu.every(b => requesterBidang === b);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Anda tidak diijinkan menghapus node di luar pengampuan bidang Anda.' }, { status: 403 });
      }
    }

    const allItems = await Cascading5Years.find({});
    
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

    await Cascading5Years.deleteMany({ id: { $in: idsToDelete } });
    return NextResponse.json({ message: 'Berhasil menghapus item cascading 5 tahunan beserta turunannya' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    await dbConnect();
    const lockResponse = await checkPlanningLock(request);
    if (lockResponse) return lockResponse;

    const { id } = await params;
    const body = await request.json();
    const {
      definisiOperasional,
      metodePenghitungan,
      variabelJumlah,
      variabelPembilang,
      variabelPenyebut
    } = body;

    const node = await Cascading5Years.findOne({ id });
    if (!node) {
      return NextResponse.json({ error: 'Node tidak ditemukan' }, { status: 404 });
    }

    node.definisiOperasional = definisiOperasional !== undefined ? definisiOperasional : node.definisiOperasional;
    node.metodePenghitungan = metodePenghitungan !== undefined ? metodePenghitungan : node.metodePenghitungan;
    node.variabelJumlah = variabelJumlah !== undefined ? variabelJumlah : node.variabelJumlah;
    node.variabelPembilang = variabelPembilang !== undefined ? variabelPembilang : node.variabelPembilang;
    node.variabelPenyebut = variabelPenyebut !== undefined ? variabelPenyebut : node.variabelPenyebut;

    await node.save();
    return NextResponse.json({ message: 'Definisi operasional berhasil diperbarui', data: node });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
