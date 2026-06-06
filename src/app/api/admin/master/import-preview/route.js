import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import * as xlsx from 'xlsx';
import dbConnect from '@/lib/db';
import MasterProgram from '@/models/MasterProgram';
import MasterKegiatan from '@/models/MasterKegiatan';
import MasterSubkegiatan from '@/models/MasterSubkegiatan';

function parseField(str) {
  if (!str) return null;
  const match = String(str).trim().match(/^([\d\.]+)\s+(.+)$/);
  if (match) {
    return { id: match[1], nama: match[2].trim() };
  }
  return null;
}

async function getDiff(rows) {
  const currentPrograms = await MasterProgram.find({});
  const currentKegiatans = await MasterKegiatan.find({});
  const currentSubkegiatans = await MasterSubkegiatan.find({});

  const programMap = new Map(currentPrograms.map(p => [p.id, p]));
  const kegiatanMap = new Map(currentKegiatans.map(k => [k.id, k]));
  const subkegiatanMap = new Map(currentSubkegiatans.map(s => [s.id, s]));

  const newPrograms = [];
  const updatedPrograms = [];
  const newKegiatans = [];
  const updatedKegiatans = [];
  const newSubkegiatans = [];
  const updatedSubkegiatans = [];

  const processedPrograms = new Set();
  const processedKegiatans = new Set();
  const processedSubkegiatans = new Set();

  for (const row of rows) {
    const progInfo = parseField(row['PROGRAM']);
    const kegInfo = parseField(row['KEGIATAN']);
    const subkegInfo = parseField(row['SUBKEGIATAN']);
    const indikatorVal = row['INDIKATOR'] ? String(row['INDIKATOR']).trim() : '';
    const satuanVal = row['SATUAN'] ? String(row['SATUAN']).trim() : '';

    if (progInfo) {
      const { id, nama } = progInfo;
      if (!processedPrograms.has(id)) {
        processedPrograms.add(id);
        const existing = programMap.get(id);
        if (!existing) {
          newPrograms.push({
            id,
            nama,
            actionData: { id, nama }
          });
        } else if (existing.nama !== nama) {
          updatedPrograms.push({
            id,
            oldNama: existing.nama,
            newNama: nama,
            actionData: { id, nama }
          });
        }
      }
    }

    if (kegInfo && progInfo) {
      const { id, nama } = kegInfo;
      if (!processedKegiatans.has(id)) {
        processedKegiatans.add(id);
        const existing = kegiatanMap.get(id);
        if (!existing) {
          newKegiatans.push({
            id,
            programId: progInfo.id,
            nama,
            actionData: { id, programId: progInfo.id, nama }
          });
        } else if (existing.nama !== nama || existing.programId !== progInfo.id) {
          updatedKegiatans.push({
            id,
            oldNama: existing.nama,
            newNama: nama,
            oldProgramId: existing.programId,
            newProgramId: progInfo.id,
            actionData: { id, programId: progInfo.id, nama }
          });
        }
      }
    }

    if (subkegInfo && kegInfo) {
      const { id, nama } = subkegInfo;
      if (!processedSubkegiatans.has(id)) {
        processedSubkegiatans.add(id);
        const existing = subkegiatanMap.get(id);
        if (!existing) {
          newSubkegiatans.push({
            id,
            kegiatanId: kegInfo.id,
            nama,
            indikator: indikatorVal,
            satuan: satuanVal,
            actionData: { id, kegiatanId: kegInfo.id, nama, indikator: indikatorVal, satuan: satuanVal }
          });
        } else if (
          existing.nama !== nama ||
          existing.kegiatanId !== kegInfo.id ||
          existing.indikator !== indikatorVal ||
          existing.satuan !== satuanVal
        ) {
          updatedSubkegiatans.push({
            id,
            oldNama: existing.nama,
            newNama: nama,
            oldIndikator: existing.indikator,
            newIndikator: indikatorVal,
            oldSatuan: existing.satuan,
            newSatuan: satuanVal,
            actionData: { id, kegiatanId: kegInfo.id, nama, indikator: indikatorVal, satuan: satuanVal }
          });
        }
      }
    }
  }

  return {
    summary: {
      newProgramsCount: newPrograms.length,
      updatedProgramsCount: updatedPrograms.length,
      newKegiatansCount: newKegiatans.length,
      updatedKegiatansCount: updatedKegiatans.length,
      newSubkegiatansCount: newSubkegiatans.length,
      updatedSubkegiatansCount: updatedSubkegiatans.length
    },
    details: {
      newPrograms,
      updatedPrograms,
      newKegiatans,
      updatedKegiatans,
      newSubkegiatans,
      updatedSubkegiatans
    }
  };
}



export async function POST(request) {
  try {
    await dbConnect();
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

    const diff = await getDiff(rows);
    return NextResponse.json(diff);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
