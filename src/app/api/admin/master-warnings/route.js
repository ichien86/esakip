import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CascadingAnnual from '@/models/CascadingAnnual';
import Cascading5Years from '@/models/Cascading5Years';
import MasterProgram from '@/models/MasterProgram';
import MasterKegiatan from '@/models/MasterKegiatan';
import MasterSubkegiatan from '@/models/MasterSubkegiatan';
import IndicatorAnnual from '@/models/IndicatorAnnual';
import Indicator5Years from '@/models/Indicator5Years';

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

    // Fetch indicators to populate node.indicators
    const annualNodeIds = annualNodes.map(n => n.id);
    const annualIndicators = await IndicatorAnnual.find({ nodeId: { $in: annualNodeIds } });
    const annualIndicatorsMap = new Map();
    annualIndicators.forEach(ind => {
      if (!annualIndicatorsMap.has(ind.nodeId)) {
        annualIndicatorsMap.set(ind.nodeId, []);
      }
      annualIndicatorsMap.get(ind.nodeId).push(ind);
    });

    const fiveYearNodeIds = fiveYearNodes.map(n => n.id);
    const fiveYearIndicators = await Indicator5Years.find({ nodeId: { $in: fiveYearNodeIds } });
    const fiveYearIndicatorsMap = new Map();
    fiveYearIndicators.forEach(ind => {
      if (!fiveYearIndicatorsMap.has(ind.nodeId)) {
        fiveYearIndicatorsMap.set(ind.nodeId, []);
      }
      fiveYearIndicatorsMap.get(ind.nodeId).push(ind);
    });

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

      // Populate indicators dynamically
      const nodePlain = typeof node.toObject === 'function' ? node.toObject() : node;
      if (type === 'annual') {
        nodePlain.indicators = annualIndicatorsMap.get(node.id) || [];
      } else {
        nodePlain.indicators = fiveYearIndicatorsMap.get(node.id) || [];
      }

      const masterId = nodePlain.masterId;
      let isMismatch = false;
      let masterNama = '';
      let masterKinerja = '';
      let masterIndikator = '';
      let masterSatuan = '';

      let hasNameMismatch = false;
      let hasKinerjaMismatch = false;
      let hasIndicatorMismatch = false;

      if (nodePlain.level === 'program' || nodePlain.level === 'sasaran_program') {
        const master = programMap.get(masterId);
        if (master) {
          masterNama = master.nama;
          hasNameMismatch = nodePlain.nomenklatur !== master.nama;
          isMismatch = hasNameMismatch;
        }
      } else if (nodePlain.level === 'kegiatan' || nodePlain.level === 'sasaran_kegiatan') {
        const master = kegiatanMap.get(masterId);
        if (master) {
          masterNama = master.nama;
          hasNameMismatch = nodePlain.nomenklatur !== master.nama;
          isMismatch = hasNameMismatch;
        }
      } else if (nodePlain.level === 'subkegiatan' || nodePlain.level === 'sasaran_subkegiatan') {
        const master = subkegiatanMap.get(masterId);
        if (master) {
          masterNama = master.nama;
          masterKinerja = master.kinerja || master.nama;
          masterIndikator = master.indikator;
          masterSatuan = master.satuan;

          // Extract actual local indicator/unit from indicators array if present
          let localIndikator = nodePlain.indikator;
          let localSatuan = nodePlain.satuan;
          if (nodePlain.indicators && nodePlain.indicators.length > 0 && nodePlain.indicators[0]) {
            localIndikator = nodePlain.indicators[0].indikator || localIndikator;
            localSatuan = nodePlain.indicators[0].satuan || localSatuan;
          }

          hasNameMismatch = nodePlain.nomenklatur !== master.nama;
          hasKinerjaMismatch = nodePlain.text !== masterKinerja;
          hasIndicatorMismatch = localIndikator !== master.indikator || localSatuan !== master.satuan;

          isMismatch = hasNameMismatch || hasKinerjaMismatch || hasIndicatorMismatch;
        }
      }

      if (isMismatch) {
        // Use extracted local indicator for warning display
        let warningIndikator = nodePlain.indikator;
        let warningSatuan = nodePlain.satuan;
        if (nodePlain.level === 'subkegiatan' || nodePlain.level === 'sasaran_subkegiatan') {
          if (nodePlain.indicators && nodePlain.indicators.length > 0 && nodePlain.indicators[0]) {
            warningIndikator = nodePlain.indicators[0].indikator || warningIndikator;
            warningSatuan = nodePlain.indicators[0].satuan || warningSatuan;
          }
        }

        warnings.push({
          nodeId: nodePlain.id,
          type,
          level: nodePlain.level,
          text: nodePlain.text,
          nomenklatur: nodePlain.nomenklatur,
          indikator: warningIndikator,
          satuan: warningSatuan,
          masterId,
          masterNama,
          masterKinerja,
          masterIndikator,
          masterSatuan,
          hasNameMismatch,
          hasKinerjaMismatch,
          hasIndicatorMismatch,
          bidangPengampu: nodePlain.bidangPengampu
        });
      }
    };

    // Hanya filter node yang level-nya ada padanannya di master
    const relevantLevels = [
      'program', 'sasaran_program',
      'kegiatan', 'sasaran_kegiatan',
      'subkegiatan', 'sasaran_subkegiatan'
    ];
    annualNodes.filter(n => relevantLevels.includes(n.level)).forEach(node => checkNode(node, 'annual'));
    fiveYearNodes.filter(n => relevantLevels.includes(n.level)).forEach(node => checkNode(node, '5years'));

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
    let masterKinerja = '';
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
        masterKinerja = master.kinerja || master.nama;
        masterIndikator = master.indikator;
        masterSatuan = master.satuan;
      }
    } else {
      return NextResponse.json({ error: 'Level ini tidak memiliki padanan di kamus data master.' }, { status: 400 });
    }

    if (!masterNama) {
      return NextResponse.json({ error: 'Kamus data master sudah dihapus atau tidak ditemukan.' }, { status: 404 });
    }

    if (node.level === 'program' || node.level === 'sasaran_program') {
      node.nomenklatur = masterNama;
    } else if (node.level === 'kegiatan' || node.level === 'sasaran_kegiatan') {
      node.nomenklatur = masterNama;
    } else if (node.level === 'subkegiatan' || node.level === 'sasaran_subkegiatan') {
      node.nomenklatur = masterNama;
      node.text = masterKinerja;
      node.sasaran = masterKinerja;
      if (node.sasaranSubkegiatan !== undefined) {
        node.sasaranSubkegiatan = masterKinerja;
      }
      if (masterIndikator) node.indikator = masterIndikator;
      if (masterSatuan) node.satuan = masterSatuan;

      // Update actual indicator inside indicators array
      if (node.indicators && node.indicators.length > 0 && node.indicators[0]) {
        const updatedIndicators = [...node.indicators];
        updatedIndicators[0] = {
          ...updatedIndicators[0],
          indikator: masterIndikator || updatedIndicators[0].indikator,
          satuan: masterSatuan || updatedIndicators[0].satuan
        };
        node.indicators = updatedIndicators;
        node.markModified('indicators');
      }
    }

    await node.save();

    return NextResponse.json({ message: 'Data cascading berhasil dimutakhirkan sesuai kamus data master.', node });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
