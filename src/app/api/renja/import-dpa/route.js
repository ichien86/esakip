import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import dbConnect from '@/lib/db';
import CascadingAnnual from '@/models/CascadingAnnual';

export async function POST(request) {
  try {
    await dbConnect();

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type harus multipart/form-data.' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const tahun = formData.get('tahun');

    if (!file) {
      return NextResponse.json({ error: 'File Excel tidak ditemukan.' }, { status: 400 });
    }
    if (!tahun) {
      return NextResponse.json({ error: 'Tahun tidak ditentukan.' }, { status: 400 });
    }

    const yearNum = parseInt(tahun);
    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong atau tidak terbaca.' }, { status: 400 });
    }

    // Find keys in the first row
    const firstRow = rows[0];
    let subkegiatanKey = '';
    let anggaranKey = '';

    Object.keys(firstRow).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('subkegiatan') || lowerKey.includes('sub kegiatan') || lowerKey.includes('nomenklatur')) {
        subkegiatanKey = key;
      }
      if (lowerKey.includes('dpa') || lowerKey.includes('anggaran dpa') || (lowerKey.includes('anggaran') && !lowerKey.includes('renja'))) {
        anggaranKey = key;
      }
    });

    if (!subkegiatanKey) {
      // Fallback: look for any column containing 'sub' or first text column
      subkegiatanKey = Object.keys(firstRow).find(key => key.toLowerCase().includes('sub')) || Object.keys(firstRow)[0];
    }
    if (!anggaranKey) {
      // Fallback: look for column containing 'anggaran' or 'nilai' or 'jumlah'
      anggaranKey = Object.keys(firstRow).find(key => key.toLowerCase().includes('anggaran') || key.toLowerCase().includes('dpa') || key.toLowerCase().includes('jumlah')) || Object.keys(firstRow)[1];
    }

    if (!subkegiatanKey || !anggaranKey) {
      return NextResponse.json({ error: 'Kolom Subkegiatan atau Anggaran DPA tidak terdeteksi.' }, { status: 400 });
    }

    let updatedCount = 0;
    const allAnnualSubkegs = await CascadingAnnual.find({ 
      level: { $in: ['sasaran_subkegiatan', 'subkegiatan'] },
      tahun: yearNum 
    });

    for (const row of rows) {
      const subkegName = row[subkegiatanKey] ? String(row[subkegiatanKey]).trim() : '';
      const rawBudget = row[anggaranKey];
      
      // Parse budget value
      let budgetVal = 0;
      if (typeof rawBudget === 'number') {
        budgetVal = rawBudget;
      } else if (typeof rawBudget === 'string') {
        budgetVal = parseFloat(rawBudget.replace(/[^0-9\.-]/g, '')) || 0;
      }

      if (!subkegName || isNaN(budgetVal) || budgetVal <= 0) continue;

      // Clean the search name (remove prefix codes e.g. "1.02.01.2.01.01 ")
      const cleanSearchName = subkegName.replace(/^[\d\.\s]+/, '').toLowerCase();

      for (const node of allAnnualSubkegs) {
        const cleanNodeNomenklatur = (node.nomenklatur || '').replace(/^[\d\.\s]+/, '').toLowerCase();
        const cleanNodeText = (node.text || '').replace(/^[\d\.\s]+/, '').toLowerCase();

        const isMatch = (cleanNodeNomenklatur && (cleanNodeNomenklatur === cleanSearchName || cleanNodeNomenklatur.includes(cleanSearchName) || cleanSearchName.includes(cleanNodeNomenklatur))) ||
                        (cleanNodeText && (cleanNodeText === cleanSearchName || cleanNodeText.includes(cleanSearchName) || cleanSearchName.includes(cleanNodeText)));

        if (isMatch) {
          node.anggaranDpa = budgetVal;
          await node.save();
          updatedCount++;
        }
      }
    }

    return NextResponse.json({ 
      message: 'Impor Anggaran DPA berhasil diaplikasikan', 
      updatedCount 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
