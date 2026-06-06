import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CascadingAnnual from '@/models/CascadingAnnual';
import Cascading5Years from '@/models/Cascading5Years';
import MasterProgram from '@/models/MasterProgram';
import MasterKegiatan from '@/models/MasterKegiatan';
import MasterSubkegiatan from '@/models/MasterSubkegiatan';

export async function GET(request) {
  try {
    await dbConnect();

    const requesterRole = request.headers.get('x-requester-role') || '';
    const requesterBidang = request.headers.get('x-requester-bidang') || '';

    if (!['admin', 'admin_bidang', 'perencana'].includes(requesterRole)) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const annualNodes = await CascadingAnnual.find({ masterId: { $ne: null } });
    const fiveYearNodes = await Cascading5Years.find({ masterId: { $ne: null } });

    const masterPrograms = await MasterProgram.find({});
    const masterKegiatans = await MasterKegiatan.find({});
    const masterSubkegiatans = await MasterSubkegiatan.find({});

    const programMap = new Map(masterPrograms.map(p => [p.id, p]));
    const kegiatanMap = new Map(masterKegiatans.map(k => [k.id, k]));
    const subkegiatanMap = new Map(masterSubkegiatans.map(s => [s.id, s]));

    const warnings = [];

    const checkNode = (node, type) => {
      if (requesterRole === 'admin_bidang') {
        const belongsToBidang = node.bidangPengampu && node.bidangPengampu.includes(requesterBidang);
        if (!belongsToBidang) return;
      }

      const masterId = node.masterId;
      let isMismatch = false;
      let masterNama = '';
      let masterIndikator = '';
      let masterSatuan = '';

      if (node.level === 'program' || node.level === 'sasaran_program') {
        const master = programMap.get(masterId);
        if (master) {
          masterNama = master.nama;
          isMismatch = node.text !== master.nama;
        }
      } else if (node.level === 'kegiatan' || node.level === 'sasaran_kegiatan') {
        const master = kegiatanMap.get(masterId);
        if (master) {
          masterNama = master.nama;
          isMismatch = node.text !== master.nama;
        }
      } else if (node.level === 'subkegiatan' || node.level === 'sasaran_subkegiatan') {
        const master = subkegiatanMap.get(masterId);
        if (master) {
          masterNama = master.nama;
          masterIndikator = master.indikator;
          masterSatuan = master.satuan;
          isMismatch = node.text !== master.nama || node.indikator !== master.indikator || node.satuan !== master.satuan;
        }
      }

      if (isMismatch) {
        warnings.push({
          nodeId: node.id,
          type,
          level: node.level,
          text: node.text,
          indikator: node.indikator,
          satuan: node.satuan,
          masterId,
          masterNama,
          masterIndikator,
          masterSatuan,
          bidangPengampu: node.bidangPengampu
        });
      }
    };

    annualNodes.forEach(node => checkNode(node, 'annual'));
    fiveYearNodes.forEach(node => checkNode(node, '5years'));

    return NextResponse.json(warnings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await dbConnect();
    const { nodeId, type, requesterRole } = await request.json();

    if (!['admin', 'admin_bidang', 'perencana'].includes(requesterRole)) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    if (!nodeId || !type) {
      return NextResponse.json({ error: 'nodeId dan type wajib diisi' }, { status: 400 });
    }

    let node;
    if (type === 'annual') {
      node = await CascadingAnnual.findOne({ id: nodeId });
    } else {
      node = await Cascading5Years.findOne({ id: nodeId });
    }

    if (!node || !node.masterId) {
      return NextResponse.json({ error: 'Node tidak ditemukan atau tidak terhubung ke data master.' }, { status: 404 });
    }

    const masterId = node.masterId;
    let masterNama = '';
    let masterIndikator = '';
    let masterSatuan = '';

    if (node.level === 'program' || node.level === 'sasaran_program') {
      const master = await MasterProgram.findOne({ id: masterId });
      if (master) masterNama = master.nama;
    } else if (node.level === 'kegiatan' || node.level === 'sasaran_kegiatan') {
      const master = await MasterKegiatan.findOne({ id: masterId });
      if (master) masterNama = master.nama;
    } else if (node.level === 'subkegiatan' || node.level === 'sasaran_subkegiatan') {
      const master = await MasterSubkegiatan.findOne({ id: masterId });
      if (master) {
        masterNama = master.nama;
        masterIndikator = master.indikator;
        masterSatuan = master.satuan;
      }
    }

    if (!masterNama) {
      return NextResponse.json({ error: 'Kamus data master sudah dihapus atau tidak ditemukan.' }, { status: 404 });
    }

    node.text = masterNama;
    if (masterIndikator) node.indikator = masterIndikator;
    if (masterSatuan) node.satuan = masterSatuan;

    await node.save();

    return NextResponse.json({ message: 'Data cascading berhasil dimutakhirkan sesuai kamus data master.', node });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
