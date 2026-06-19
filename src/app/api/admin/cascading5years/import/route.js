import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import dbConnect from '@/lib/db';
import Cascading5Years from '@/models/Cascading5Years';
import Indicator5Years from '@/models/Indicator5Years';
import MasterSubkegiatan from '@/models/MasterSubkegiatan';
import { checkPlanningLock } from '@/lib/lock-check';
import Cascading5YearsService from '@/services/Cascading5YearsService';

// Standardized level mapper
const mapLevel = (lvl) => {
  if (!lvl) return '';
  const val = lvl.toLowerCase().trim();
  if (val === 'tujuan') return 'tujuan';
  if (val === 'sasaran') return 'sasaran';
  if (val === 'program' || val === 'sasaran program' || val === 'sasaran_program') return 'sasaran_program';
  if (val === 'kegiatan' || val === 'sasaran kegiatan' || val === 'sasaran_kegiatan') return 'sasaran_kegiatan';
  if (val === 'subkegiatan' || val === 'sasaran subkegiatan' || val === 'sasaran_subkegiatan') return 'sasaran_subkegiatan';
  if (val === 'aktivitas' || val === 'sasaran aktivitas' || val === 'sasaran_aktivitas') return 'sasaran_aktivitas';
  return '';
};

// Bidang Pengampu mapper
const mapBidangs = (bidangStr) => {
  if (!bidangStr) return [];
  return bidangStr.split(',').map(b => {
    const clean = b.trim().toLowerCase();
    if (clean === 'badan') return 'Badan';
    if (clean.includes('sekretariat')) return 'Sekretariat';
    if (clean.includes('tata usaha') || clean === 'tu') return 'Tata Usaha';
    if (clean.includes('pencegahan') || clean.includes('kesiapsiagaan')) return 'Bidang Pencegahan dan Kesiapsiagaan';
    if (clean.includes('kedaruratan') || clean.includes('logistik')) return 'Bidang Kedaruratan dan Logistik';
    if (clean.includes('rehabilitasi') || clean.includes('rekonstruksi')) return 'Bidang Rehabilitasi dan Rekonstruksi';
    return b.trim(); // fallback if non-standard
  }).filter(Boolean);
};

// Safe getter for excel rows
const getRowValue = (row, ...keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return String(row[key]).trim();
    }
  }
  return '';
};

export async function POST(request) {
  try {
    await dbConnect();

    // 1. Cek planning lock
    const lockResponse = await checkPlanningLock(request);
    if (lockResponse) return lockResponse;

    // 2. Cek apakah database sudah terisi data cascading
    const count = await Cascading5Years.countDocuments({});
    if (count > 0) {
      return NextResponse.json(
        { error: 'Proses impor ditolak karena sudah ada data cascading di dalam sistem.' },
        { status: 400 }
      );
    }

    // 3. Ambil file dari form data
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ error: 'File Excel wajib diunggah.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Berkas Excel kosong atau tidak dapat dibaca.' }, { status: 400 });
    }

    // Ambil data master subkegiatan untuk validasi
    const masterSubkegiatans = await MasterSubkegiatan.find({});

    const errors = [];
    const validatedRows = [];

    // State travesal untuk validasi pohon
    let currentTujuan = null;
    let currentSasaran = null;
    let currentProgram = null;
    let currentKegiatan = null;
    let currentSubkegiatan = null;
    let lastNodeCreated = null;

    // --- PASS 1: DRY RUN VALIDATION ---
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // header di baris 1

      const levelRaw = getRowValue(row, 'Level');
      const teksRaw = getRowValue(row, 'Teks / Nomenklatur');
      const indikatorRaw = getRowValue(row, 'Indikator Kinerja');
      const satuanRaw = getRowValue(row, 'Satuan');
      const tipeTargetRaw = getRowValue(row, 'Tipe Target') || 'Kondisi Akhir Naik';
      const target2025 = getRowValue(row, 'Target 2025');
      const target2026 = getRowValue(row, 'Target 2026');
      const target2027 = getRowValue(row, 'Target 2027');
      const target2028 = getRowValue(row, 'Target 2028');
      const target2029 = getRowValue(row, 'Target 2029');
      const target2030 = getRowValue(row, 'Target 2030');
      const targetAkhir = getRowValue(row, 'Target Akhir');
      const anggaran2025 = getRowValue(row, 'Anggaran 2025');
      const anggaran2026 = getRowValue(row, 'Anggaran 2026');
      const anggaran2027 = getRowValue(row, 'Anggaran 2027');
      const anggaran2028 = getRowValue(row, 'Anggaran 2028');
      const anggaran2029 = getRowValue(row, 'Anggaran 2029');
      const anggaran2030 = getRowValue(row, 'Anggaran 2030');
      const anggaranAkhir = getRowValue(row, 'Anggaran Akhir');
      const bidangRaw = getRowValue(row, 'Bidang Pengampu');
      const kodeMasterRaw = getRowValue(row, 'Kode Master');

      // Tipe Target validation helper
      const validTipeTarget = ['Kondisi Akhir Naik', 'Kondisi Akhir Menurun', 'Akumulatif'];
      if (tipeTargetRaw && !validTipeTarget.includes(tipeTargetRaw)) {
        errors.push({
          row: rowNum,
          nomenklatur: teksRaw || '-',
          level: levelRaw || '-',
          reason: `Tipe Target "${tipeTargetRaw}" tidak valid. Harus salah satu dari: Kondisi Akhir Naik, Kondisi Akhir Menurun, Akumulatif.`
        });
      }

      if (levelRaw) {
        const lvl = mapLevel(levelRaw);
        if (!lvl) {
          errors.push({
            row: rowNum,
            nomenklatur: teksRaw || '-',
            level: levelRaw,
            reason: `Tingkatan/Level "${levelRaw}" tidak valid. Harus salah satu dari: Tujuan, Sasaran, Program, Kegiatan, Subkegiatan, Aktivitas.`
          });
          continue;
        }

        if (!teksRaw) {
          errors.push({
            row: rowNum,
            nomenklatur: '-',
            level: levelRaw,
            reason: 'Nomenklatur / Teks tidak boleh kosong.'
          });
          continue;
        }

        // Cek hierarki
        if (lvl === 'sasaran' && !currentTujuan) {
          errors.push({
            row: rowNum,
            nomenklatur: teksRaw,
            level: levelRaw,
            reason: 'Sasaran harus berada di bawah baris Tujuan.'
          });
        } else if (lvl === 'sasaran_program' && !currentSasaran) {
          errors.push({
            row: rowNum,
            nomenklatur: teksRaw,
            level: levelRaw,
            reason: 'Program harus berada di bawah baris Sasaran.'
          });
        } else if (lvl === 'sasaran_kegiatan' && !currentProgram) {
          errors.push({
            row: rowNum,
            nomenklatur: teksRaw,
            level: levelRaw,
            reason: 'Kegiatan harus berada di bawah baris Program.'
          });
        } else if (lvl === 'sasaran_subkegiatan' && !currentKegiatan) {
          errors.push({
            row: rowNum,
            nomenklatur: teksRaw,
            level: levelRaw,
            reason: 'Subkegiatan harus berada di bawah baris Kegiatan.'
          });
        } else if (lvl === 'sasaran_aktivitas' && !currentSubkegiatan) {
          errors.push({
            row: rowNum,
            nomenklatur: teksRaw,
            level: levelRaw,
            reason: 'Aktivitas harus berada di bawah baris Subkegiatan.'
          });
        }

        // Validasi Master Subkegiatan
        let subkegData = null;
        if (lvl === 'sasaran_subkegiatan') {
          let matchedMaster = null;
          if (kodeMasterRaw) {
            matchedMaster = masterSubkegiatans.find(m => m.id === kodeMasterRaw);
          } else {
            matchedMaster = masterSubkegiatans.find(m => m.nama.toLowerCase().trim() === teksRaw.toLowerCase().trim());
          }

          if (!matchedMaster) {
            errors.push({
              row: rowNum,
              nomenklatur: teksRaw,
              level: levelRaw,
              reason: `Subkegiatan "${teksRaw}" tidak terdaftar dalam Data Master Kamus Subkegiatan.`
            });
          } else {
            subkegData = {
              masterId: matchedMaster.id,
              nomenklatur: matchedMaster.nama,
              sasaran: matchedMaster.kinerja || matchedMaster.nama,
              indikator: matchedMaster.indikator || '-',
              satuan: matchedMaster.satuan || '-'
            };
          }
        }

        // Mock node untuk validasi baris berikutnya
        const mockNode = {
          id: `mock_${lvl}_${i}`,
          level: lvl,
          text: teksRaw
        };

        if (lvl === 'tujuan') {
          currentTujuan = mockNode;
          currentSasaran = null;
          currentProgram = null;
          currentKegiatan = null;
          currentSubkegiatan = null;
        } else if (lvl === 'sasaran') {
          currentSasaran = mockNode;
          currentProgram = null;
          currentKegiatan = null;
          currentSubkegiatan = null;
        } else if (lvl === 'sasaran_program') {
          currentProgram = mockNode;
          currentKegiatan = null;
          currentSubkegiatan = null;
        } else if (lvl === 'sasaran_kegiatan') {
          currentKegiatan = mockNode;
          currentSubkegiatan = null;
        } else if (lvl === 'sasaran_subkegiatan') {
          currentSubkegiatan = mockNode;
        }
        lastNodeCreated = mockNode;

        validatedRows.push({
          rowNum,
          type: 'node',
          level: lvl,
          text: teksRaw,
          indikator: lvl === 'sasaran_subkegiatan' ? subkegData?.indikator : (indikatorRaw || '-'),
          satuan: lvl === 'sasaran_subkegiatan' ? subkegData?.satuan : (satuanRaw || '-'),
          tipeTarget: tipeTargetRaw,
          target2025, target2026, target2027, target2028, target2029, target2030, targetAkhir,
          anggaran2025, anggaran2026, anggaran2027, anggaran2028, anggaran2029, anggaran2030, anggaranAkhir,
          bidang: fieldsToBidang(lvl, bidangRaw, subkegData),
          masterId: lvl === 'sasaran_subkegiatan' ? subkegData?.masterId : (kodeMasterRaw || null),
          sasaran: lvl === 'sasaran_subkegiatan' ? subkegData?.sasaran : teksRaw
        });
      } else {
        // Baris tanpa level: Indikator tambahan
        if (!lastNodeCreated) {
          errors.push({
            row: rowNum,
            nomenklatur: teksRaw || '-',
            level: 'Indikator Tambahan',
            reason: 'Baris indikator tambahan harus berada di bawah baris suatu Level.'
          });
          continue;
        }

        if (lastNodeCreated.level === 'sasaran_subkegiatan') {
          errors.push({
            row: rowNum,
            nomenklatur: '-',
            level: 'Indikator Tambahan',
            reason: 'Subkegiatan tidak diperbolehkan memiliki indikator tambahan (hanya satu indikator dari data master).'
          });
          continue;
        }

        if (!indikatorRaw) {
          errors.push({
            row: rowNum,
            nomenklatur: '-',
            level: 'Indikator Tambahan',
            reason: 'Kolom Indikator Kinerja wajib diisi jika kolom Level kosong (indikator tambahan).'
          });
          continue;
        }

        validatedRows.push({
          rowNum,
          type: 'indicator',
          parentMockId: lastNodeCreated.id,
          indikator: indikatorRaw,
          satuan: satuanRaw || '-',
          tipeTarget: tipeTargetRaw,
          target2025, target2026, target2027, target2028, target2029, target2030, targetAkhir
        });
      }
    }

    // Helper untuk memetakan bidang pengampu
    function fieldsToBidang(lvl, bidangStr, subkegData) {
      if (lvl === 'sasaran_subkegiatan' && subkegData) {
        // subkegiatan bisa mengambil bidang dari master jika tidak ditulis di excel
        if (bidangStr) return mapBidangs(bidangStr);
        // fallback to master bidang mapping if any
        return [];
      }
      return mapBidangs(bidangStr);
    }

    // Jika ada error pada Pass 1, kembalikan daftar error lengkap
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        successCount: 0,
        failCount: errors.length,
        errors: errors
      });
    }

    // --- PASS 2: DATABASE WRITE ---
    // Simpan data karena seluruh baris valid!
    // Kosongkan collection terlebih dahulu
    await Cascading5Years.deleteMany({});
    await Indicator5Years.deleteMany({});

    // Reset traversal state untuk mapping riil ke DB
    let activeTujuanId = null;
    let activeSasaranId = null;
    let activeProgramId = null;
    let activeKegiatanId = null;
    let activeSubkegiatanId = null;
    let activeNodeId = null;

    // Untuk melacak urutan indikator tambahan
    const indicatorOrderMap = {}; 

    for (const vRow of validatedRows) {
      if (vRow.type === 'node') {
        const uniqueId = `5y_${vRow.level.substring(0, 3)}_${Date.now()}_${vRow.rowNum}`;
        let parentId = null;

        if (vRow.level === 'tujuan') {
          activeTujuanId = uniqueId;
          activeSasaranId = null;
          activeProgramId = null;
          activeKegiatanId = null;
          activeSubkegiatanId = null;
        } else if (vRow.level === 'sasaran') {
          parentId = activeTujuanId;
          activeSasaranId = uniqueId;
          activeProgramId = null;
          activeKegiatanId = null;
          activeSubkegiatanId = null;
        } else if (vRow.level === 'sasaran_program') {
          parentId = activeSasaranId;
          activeProgramId = uniqueId;
          activeKegiatanId = null;
          activeSubkegiatanId = null;
        } else if (vRow.level === 'sasaran_kegiatan') {
          parentId = activeProgramId;
          activeKegiatanId = uniqueId;
          activeSubkegiatanId = null;
        } else if (vRow.level === 'sasaran_subkegiatan') {
          parentId = activeKegiatanId;
          activeSubkegiatanId = uniqueId;
        } else if (vRow.level === 'sasaran_aktivitas') {
          parentId = activeSubkegiatanId;
        }

        activeNodeId = uniqueId;

        // Simpan Cascading Node
        const newNode = new Cascading5Years({
          id: uniqueId,
          level: vRow.level,
          text: vRow.text,
          indikator: 'Indikator Terpisah',
          satuan: '-',
          tipeTarget: vRow.tipeTarget || 'Kondisi Akhir Naik',
          parentId: parentId,
          bidangPengampu: vRow.bidang,
          crossCuttingType: 'bersama',
          selectedBidang: null,
          splitTargets: {},
          masterId: vRow.masterId,
          sasaran: vRow.sasaran,
          nomenklatur: vRow.text,
          target2025: vRow.level === 'sasaran_subkegiatan' ? (vRow.target2025 || '0') : '0',
          target2026: vRow.level === 'sasaran_subkegiatan' ? (vRow.target2026 || '0') : '0',
          target2027: vRow.level === 'sasaran_subkegiatan' ? (vRow.target2027 || '0') : '0',
          target2028: vRow.level === 'sasaran_subkegiatan' ? (vRow.target2028 || '0') : '0',
          target2029: vRow.level === 'sasaran_subkegiatan' ? (vRow.target2029 || '0') : '0',
          target2030: vRow.level === 'sasaran_subkegiatan' ? (vRow.target2030 || '0') : '0',
          targetAkhir: vRow.level === 'sasaran_subkegiatan' ? (vRow.targetAkhir || '0') : '0',
          anggaran2025: vRow.anggaran2025 || '0',
          anggaran2026: vRow.anggaran2026 || '0',
          anggaran2027: vRow.anggaran2027 || '0',
          anggaran2028: vRow.anggaran2028 || '0',
          anggaran2029: vRow.anggaran2029 || '0',
          anggaran2030: vRow.anggaran2030 || '0',
          anggaranAkhir: vRow.anggaranAkhir || '0',
          indicators: []
        });

        await newNode.save();

        // Buat Indikator Utama bawaan node
        const primaryIndId = `ind_5y_${uniqueId}_main`;
        const newIndicator = new Indicator5Years({
          id: primaryIndId,
          nodeId: uniqueId,
          indikator: vRow.indikator,
          satuan: vRow.satuan,
          tipeTarget: vRow.tipeTarget || 'Kondisi Akhir Naik',
          target2025: vRow.target2025 || '0',
          target2026: vRow.target2026 || '0',
          target2027: vRow.target2027 || '0',
          target2028: vRow.target2028 || '0',
          target2029: vRow.target2029 || '0',
          target2030: vRow.target2030 || '0',
          targetAkhir: vRow.targetAkhir || '0',
          order: 0
        });

        await newIndicator.save();
        indicatorOrderMap[uniqueId] = 1;
      } else if (vRow.type === 'indicator') {
        // Indikator tambahan untuk activeNodeId yang sedang aktif
        const orderIndex = indicatorOrderMap[activeNodeId] || 0;
        const additionalIndId = `ind_5y_${activeNodeId}_add_${orderIndex}`;

        const newIndicator = new Indicator5Years({
          id: additionalIndId,
          nodeId: activeNodeId,
          indikator: vRow.indikator,
          satuan: vRow.satuan,
          tipeTarget: vRow.tipeTarget || 'Kondisi Akhir Naik',
          target2025: vRow.target2025 || '0',
          target2026: vRow.target2026 || '0',
          target2027: vRow.target2027 || '0',
          target2028: vRow.target2028 || '0',
          target2029: vRow.target2029 || '0',
          target2030: vRow.target2030 || '0',
          targetAkhir: vRow.targetAkhir || '0',
          order: orderIndex
        });

        await newIndicator.save();
        indicatorOrderMap[activeNodeId] = orderIndex + 1;
      }
    }

    // Jalankan bottom-up propagation untuk Bidang Pengampu agar data teragregasi
    // Kita lakukan secara bertahap dari level bawah ke atas
    const allDbNodes = await Cascading5Years.find({});
    
    // Group parentIds bottom-up: subkegiatan parentIds -> kegiatan parentIds -> program parentIds -> sasaran parentIds
    const subkegParentIds = [...new Set(allDbNodes.filter(n => n.level === 'sasaran_subkegiatan').map(n => n.parentId))].filter(Boolean);
    for (const parentId of subkegParentIds) {
      await Cascading5YearsService.propagateBidangUpwards(parentId);
    }

    const kegParentIds = [...new Set(allDbNodes.filter(n => n.level === 'sasaran_kegiatan').map(n => n.parentId))].filter(Boolean);
    for (const parentId of kegParentIds) {
      await Cascading5YearsService.propagateBidangUpwards(parentId);
    }

    const progParentIds = [...new Set(allDbNodes.filter(n => n.level === 'sasaran_program').map(n => n.parentId))].filter(Boolean);
    for (const parentId of progParentIds) {
      await Cascading5YearsService.propagateBidangUpwards(parentId);
    }

    const sasaranParentIds = [...new Set(allDbNodes.filter(n => n.level === 'sasaran').map(n => n.parentId))].filter(Boolean);
    for (const parentId of sasaranParentIds) {
      await Cascading5YearsService.propagateBidangUpwards(parentId);
    }

    return NextResponse.json({
      success: true,
      successCount: validatedRows.filter(r => r.type === 'node').length,
      failCount: 0,
      errors: []
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
