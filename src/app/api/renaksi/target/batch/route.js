import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Renaksi from '@/models/Renaksi';
import CascadingAnnual from '@/models/CascadingAnnual';
import Employee from '@/models/Employee';
import Setting from '@/models/Setting';

export async function POST(request) {
  try {
    await dbConnect();
    const { employeeId, targets } = await request.json();

    if (!employeeId || !Array.isArray(targets)) {
      return NextResponse.json({ error: 'Data target wajib dikirim' }, { status: 400 });
    }

    const lockSetting = await Setting.findOne({ key: 'planning_locked' });
    if (lockSetting && lockSetting.value === true) {
      return NextResponse.json({ error: 'Masa penyusunan target renaksi (matriks bulanan) telah dikunci oleh Administrator.' }, { status: 403 });
    }

    const emp = await Employee.findOne({ id: employeeId });
    const userBidang = emp ? (emp.bidangs[0] || '') : '';

    const indicatorsToVerify = [...new Set(targets.map(t => t.indicatorId))];

    for (let indicatorId of indicatorsToVerify) {
      const node = await CascadingAnnual.findOne({ id: indicatorId });
      if (node && node.tipeTarget === 'Akumulatif') {
        let annualTarget = parseFloat(node.target);
        if (node.crossCuttingType === 'split' && node.splitTargets && userBidang) {
          const portion = parseFloat(node.splitTargets[userBidang]);
          if (!isNaN(portion)) {
            annualTarget = portion;
          }
        }

        const indicatorTargets = targets.filter(t => t.indicatorId === indicatorId);
        const monthlySum = indicatorTargets.reduce((sum, item) => sum + (parseFloat(item.targetBulanan) || 0), 0);

        if (Math.abs(monthlySum - annualTarget) > 0.05) {
          return NextResponse.json({
            error: `Validasi gagal untuk indikator "${node.indikator}". Tipe target adalah Akumulatif, sehingga jumlah target bulanan (Jan-Des) harus berjumlah persis ${annualTarget} ${node.satuan} (Input saat ini: ${monthlySum}).`
          }, { status: 400 });
        }
      }
    }

    for (let item of targets) {
      const recordId = `rx_${employeeId}_${item.indicatorId}_${item.bulan}`;
      const targetVal = parseFloat(item.targetBulanan) || 0;

      let record = await Renaksi.findOne({ id: recordId });
      if (record) {
        record.targetBulanan = targetVal;
        record.status = 'Draft'; // Reset to Draft when modified
        await record.save();
      } else {
        record = new Renaksi({
          id: recordId,
          employeeId,
          bidang: userBidang,
          tahun: 2026,
          indicatorId: item.indicatorId,
          bulan: parseInt(item.bulan),
          targetBulanan: targetVal,
          status: 'Draft'
        });
        await record.save();
      }
    }

    return NextResponse.json({ message: 'Target bulanan spreadsheet berhasil disimpan' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
