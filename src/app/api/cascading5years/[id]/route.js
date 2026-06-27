import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';
import { checkPlanningLock } from '@/lib/lock-check';
import Cascading5YearsService from '@/services/Cascading5YearsService';
import { getValidatedUser } from '@/lib/api-auth';

export async function DELETE(request, { params }) {
  try {
    await dbConnect();
    const lockResponse = await checkPlanningLock(request);
    if (lockResponse) return lockResponse;

    const { id } = await params;
    
    const { role: requesterRole } = getValidatedUser(request, request.headers.get('x-requester-role'));
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

    const parentId = node.parentId;
    await Cascading5Years.deleteMany({ id: { $in: idsToDelete } });

    if (parentId) {
      await Cascading5YearsService.propagateBidangUpwards(parentId);
    }

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

    const Indicator5Years = (await import('@/models/Indicator5Years')).default;
    let indicator = await Indicator5Years.findOne({ nodeId: id });
    if (!indicator) {
      indicator = new Indicator5Years({
        id: `ind_5y_${id}_${Math.random().toString(36).substring(2, 7)}`,
        nodeId: id,
        indikator: node.indikator || '-',
        satuan: node.satuan || '-',
        tipeTarget: node.tipeTarget || 'Kondisi Akhir Naik'
      });
    }

    indicator.definisiOperasional = definisiOperasional !== undefined ? definisiOperasional : indicator.definisiOperasional;
    indicator.metodePenghitungan = metodePenghitungan !== undefined ? metodePenghitungan : indicator.metodePenghitungan;
    indicator.variabelJumlah = variabelJumlah !== undefined ? variabelJumlah : indicator.variabelJumlah;
    indicator.variabelPembilang = variabelPembilang !== undefined ? variabelPembilang : indicator.variabelPembilang;
    indicator.variabelPenyebut = variabelPenyebut !== undefined ? variabelPenyebut : indicator.variabelPenyebut;

    await indicator.save();

    // Clean node root fields
    node.definisiOperasional = '';
    node.metodePenghitungan = 'Jumlah';
    node.variabelJumlah = '';
    node.variabelPembilang = '';
    node.variabelPenyebut = '';
    await node.save();

    return NextResponse.json({ message: 'Definisi operasional berhasil diperbarui', data: indicator });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
