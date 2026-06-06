import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import * as xlsx from 'xlsx';
import dbConnect from '@/lib/db';
import MasterProgram from '@/models/MasterProgram';
import MasterKegiatan from '@/models/MasterKegiatan';
import MasterSubkegiatan from '@/models/MasterSubkegiatan';

export async function POST(request) {
  try {
    await dbConnect();

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body.bulk) {
        const { data = {} } = body;
        const { programs = [], kegiatans = [], subkegiatans = [] } = data;

        const programOps = programs.map(p => ({
          updateOne: {
            filter: { id: p.id },
            update: { $set: { nama: p.nama, urusan: p.urusan || '' } },
            upsert: true
          }
        }));
        const kegiatanOps = kegiatans.map(k => ({
          updateOne: {
            filter: { id: k.id },
            update: { $set: { programId: k.programId, nama: k.nama } },
            upsert: true
          }
        }));
        const subkegiatanOps = subkegiatans.map(s => ({
          updateOne: {
            filter: { id: s.id },
            update: { $set: { kegiatanId: s.kegiatanId, nama: s.nama, indikator: s.indikator, satuan: s.satuan, bidang: s.bidang || '' } },
            upsert: true
          }
        }));

        let pRes = { nModified: 0, nUpserted: 0 };
        let kRes = { nModified: 0, nUpserted: 0 };
        let sRes = { nModified: 0, nUpserted: 0 };

        if (programOps.length > 0) {
          const res = await MasterProgram.bulkWrite(programOps);
          pRes = { nModified: res.modifiedCount, nUpserted: res.upsertedCount };
        }
        if (kegiatanOps.length > 0) {
          const res = await MasterKegiatan.bulkWrite(kegiatanOps);
          kRes = { nModified: res.modifiedCount, nUpserted: res.upsertedCount };
        }
        if (subkegiatanOps.length > 0) {
          const res = await MasterSubkegiatan.bulkWrite(subkegiatanOps);
          sRes = { nModified: res.modifiedCount, nUpserted: res.upsertedCount };
        }

        return NextResponse.json({
          message: 'Impor kamus data berhasil diaplikasikan secara massal',
          results: {
            programs: pRes,
            kegiatans: kRes,
            subkegiatans: sRes
          }
        });
      } else {
        const { type, actionData } = body;
        if (!type || !actionData) {
          return NextResponse.json({ error: 'Data update tidak lengkap.' }, { status: 400 });
        }

        if (type === 'program') {
          const { id, nama, urusan } = actionData;
          await MasterProgram.updateOne({ id }, { $set: { nama, urusan: urusan || '' } }, { upsert: true });
        } else if (type === 'kegiatan') {
          const { id, programId, nama } = actionData;
          await MasterKegiatan.updateOne({ id }, { $set: { programId, nama } }, { upsert: true });
        } else if (type === 'subkegiatan') {
          const { id, kegiatanId, nama, indikator, satuan, bidang } = actionData;
          await MasterSubkegiatan.updateOne({ id }, { $set: { kegiatanId, nama, indikator, satuan, bidang: bidang || '' } }, { upsert: true });
        } else {
          return NextResponse.json({ error: 'Tipe data master tidak valid.' }, { status: 400 });
        }

        return NextResponse.json({ message: `Data master ${type} berhasil dimutakhirkan.` });
      }
    }

    let fileBuffer;
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type harus multipart/form-data.' }, { status: 400 });
    }
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ error: 'File Excel tidak ditemukan di request.' }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    fileBuffer = Buffer.from(bytes);

    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(worksheet);

    const parseField = (str) => {
      if (!str) return null;
      const match = String(str).trim().match(/^([\d\.]+)\s+(.+)$/);
      if (match) {
        return { id: match[1], nama: match[2].trim() };
      }
      return null;
    };

    const programOps = [];
    const kegiatanOps = [];
    const subkegiatanOps = [];

    const processedPrograms = new Set();
    const processedKegiatans = new Set();
    const processedSubkegiatans = new Set();

    for (const row of rows) {
      const progInfo = parseField(row['PROGRAM']);
      const kegInfo = parseField(row['KEGIATAN']);
      const subkegInfo = parseField(row['SUBKEGIATAN']);
      const indikatorVal = row['INDIKATOR'] ? String(row['INDIKATOR']).trim() : '';
      const satuanVal = row['SATUAN'] ? String(row['SATUAN']).trim() : '';
      const urusanVal = row['BIDANG'] ? String(row['BIDANG']).trim() : '';
      const bidangVal = row['PELAKSANA'] ? String(row['PELAKSANA']).trim() : '';

      if (progInfo) {
        const { id, nama } = progInfo;
        if (!processedPrograms.has(id)) {
          processedPrograms.add(id);
          programOps.push({
            updateOne: {
              filter: { id },
              update: { $set: { nama, urusan: urusanVal } },
              upsert: true
            }
          });
        }
      }

      if (kegInfo && progInfo) {
        const { id, nama } = kegInfo;
        if (!processedKegiatans.has(id)) {
          processedKegiatans.add(id);
          kegiatanOps.push({
            updateOne: {
              filter: { id },
              update: { $set: { programId: progInfo.id, nama } },
              upsert: true
            }
          });
        }
      }

      if (subkegInfo && kegInfo) {
        const { id, nama } = subkegInfo;
        if (!processedSubkegiatans.has(id)) {
          processedSubkegiatans.add(id);
          subkegiatanOps.push({
            updateOne: {
              filter: { id },
              update: { $set: { kegiatanId: kegInfo.id, nama, indikator: indikatorVal, satuan: satuanVal, bidang: bidangVal } },
              upsert: true
            }
          });
        }
      }
    }

    let pRes = { nModified: 0, nUpserted: 0 };
    let kRes = { nModified: 0, nUpserted: 0 };
    let sRes = { nModified: 0, nUpserted: 0 };

    if (programOps.length > 0) {
      const res = await MasterProgram.bulkWrite(programOps);
      pRes = { nModified: res.modifiedCount, nUpserted: res.upsertedCount };
    }
    if (kegiatanOps.length > 0) {
      const res = await MasterKegiatan.bulkWrite(kegiatanOps);
      kRes = { nModified: res.modifiedCount, nUpserted: res.upsertedCount };
    }
    if (subkegiatanOps.length > 0) {
      const res = await MasterSubkegiatan.bulkWrite(subkegiatanOps);
      sRes = { nModified: res.modifiedCount, nUpserted: res.upsertedCount };
    }

    return NextResponse.json({
      message: 'Impor kamus data berhasil diaplikasikan',
      results: {
        programs: pRes,
        kegiatans: kRes,
        subkegiatans: sRes
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
