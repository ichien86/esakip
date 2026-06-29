import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PaketPekerjaan from '@/models/PaketPekerjaan';
import CascadingAnnual from '@/models/CascadingAnnual';
import * as XLSX from 'xlsx';

const BULAN_KEY = ['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];

// GET: Download template Excel
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'master'; // master | realisasi
    const tahun = searchParams.get('tahun') || '2026';

    const wb = XLSX.utils.book_new();

    if (type === 'master') {
      // Template master paket pekerjaan (awal tahun)
      const headers = [
        'Kode Subkegiatan / ID Subkegiatan',
        'Nama Subkegiatan',
        'Nama Paket Pekerjaan',
        'Pagu Anggaran (Rp)',
      ];
      const example = [
        'ID_SUBKEGIATAN_DISINI',
        'Contoh: Pengelolaan Logistik Bencana',
        'Pengadaan Gudang Logistik',
        '150000000',
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, example]);
      ws['!cols'] = [{ wch: 35 }, { wch: 40 }, { wch: 40 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Master Paket Pekerjaan');
    } else {
      // Template realisasi anggaran bulanan
      const headers = [
        'ID Paket Pekerjaan',
        'Nama Paket Pekerjaan',
        'Nama Subkegiatan',
        'Realisasi Anggaran (Rp)',
      ];
      const example = [
        'UUID_PAKET_DISINI',
        'Pengadaan Gudang Logistik',
        'Pengelolaan Logistik Bencana',
        '75000000',
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, example]);
      ws['!cols'] = [{ wch: 35 }, { wch: 40 }, { wch: 40 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, `Realisasi Anggaran ${tahun}`);
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = type === 'master'
      ? `template_master_paket_pekerjaan_${tahun}.xlsx`
      : `template_realisasi_anggaran_${tahun}.xlsx`;

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Smart Preview lalu Commit import data
export async function POST(request) {
  try {
    await dbConnect();
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type') || 'master'; // master | realisasi
    const tahun = parseInt(formData.get('tahun') || '2026');
    const bulan = parseInt(formData.get('bulan') || '1'); // only used for realisasi
    const action = formData.get('action') || 'preview'; // preview | commit

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Skip header row
    const dataRows = rows.slice(1).filter(row => row.some(cell => cell !== ''));

    if (type === 'master') {
      // Parse: [ID Subkegiatan, Nama Subkegiatan, Nama Paket, Pagu]
      const items = dataRows.map(row => ({
        subkegiatanId: String(row[0] || '').trim(),
        namaSubkegiatan: String(row[1] || '').trim(),
        namaPaket: String(row[2] || '').trim(),
        paguAnggaran: parseFloat(String(row[3] || '0').replace(/[^0-9.]/g, '')) || 0,
      })).filter(r => r.subkegiatanId && r.namaPaket);

      const totalPagu = items.reduce((s, r) => s + r.paguAnggaran, 0);
      const preview = { totalData: items.length, totalPagu, items: items.slice(0, 5) };

      if (action === 'preview') {
        return NextResponse.json({ preview });
      }

      // Commit: upsert paket pekerjaan
      for (const item of items) {
        // Check existing by subkegiatanId + namaPaket + tahun
        const existing = await PaketPekerjaan.findOne({
          tahun,
          subkegiatanId: item.subkegiatanId,
          namaPaket: item.namaPaket,
        });

        if (existing) {
          await PaketPekerjaan.updateOne(
            { id: existing.id },
            { $set: { namaSubkegiatan: item.namaSubkegiatan, paguAnggaran: item.paguAnggaran } }
          );
        } else {
          await PaketPekerjaan.create({ id: crypto.randomUUID(), tahun, ...item });
        }
      }

      // After upsert, recalculate anggaranDpa per subkegiatan by summing
      // all paguAnggaran of paket pekerjaan under that subkegiatan.
      // This replaces the separate "Impor Excel DPA" feature.
      const subkegiatanIds = [...new Set(items.map(i => i.subkegiatanId))];
      for (const subkegId of subkegiatanIds) {
        const allPaketsForSubkeg = await PaketPekerjaan.find({ subkegiatanId: subkegId, tahun });
        const totalDpa = allPaketsForSubkeg.reduce((sum, p) => sum + (p.paguAnggaran || 0), 0);
        await CascadingAnnual.updateOne(
          { id: subkegId, tahun },
          { $set: { anggaranDpa: totalDpa } }
        );
      }

      return NextResponse.json({ message: `${items.length} paket pekerjaan berhasil disimpan dan anggaranDpa diperbarui` });

    } else {
      // Realisasi anggaran: [ID Paket, Nama Paket, Nama Subkegiatan, Realisasi]
      const bulanKey = BULAN_KEY[bulan - 1];
      const items = dataRows.map(row => ({
        id: String(row[0] || '').trim(),
        namaPaket: String(row[1] || '').trim(),
        namaSubkegiatan: String(row[2] || '').trim(),
        realisasi: parseFloat(String(row[3] || '0').replace(/[^0-9.]/g, '')) || 0,
      })).filter(r => r.id || r.namaPaket);

      const totalRealisasi = items.reduce((s, r) => s + r.realisasi, 0);
      const preview = { totalData: items.length, totalRealisasi, bulan, items: items.slice(0, 5) };

      if (action === 'preview') {
        return NextResponse.json({ preview });
      }

      // Commit: update realisasi anggaran bulanan
      for (const item of items) {
        const setData = {};
        setData[`realisasiAnggaran.${bulanKey}`] = item.realisasi;

        // Lookup by id or by namaPaket + tahun
        const filter = item.id
          ? { id: item.id, tahun }
          : { namaPaket: item.namaPaket, tahun };

        await PaketPekerjaan.updateOne(filter, { $set: setData });
      }

      return NextResponse.json({ message: `Realisasi anggaran bulan ${bulan} untuk ${items.length} paket berhasil disimpan` });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
