const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/akip';

async function run() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    console.log('Connecting to MongoDB at:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    const Employee = mongoose.models.Employee || mongoose.model('Employee', new mongoose.Schema({
      id: String, nama: String, nip: String, jabatan: String, password: { type: String, default: 'bpbd@boyolali' }, roles: [String], parentId: String, bidangs: [String]
    }));
    
    const Cascading5Years = mongoose.models.Cascading5Years || mongoose.model('Cascading5Years', new mongoose.Schema({
      id: String, level: String, text: String, indikator: String, satuan: String, tipeTarget: String, parentId: String,
      bidangPengampu: [String], crossCuttingType: String, splitTargets: mongoose.Schema.Types.Mixed,
      target2025: String, target2026: String, target2027: String, target2028: String, target2029: String, target2030: String, targetAkhir: String,
      anggaran2025: String, anggaran2026: String, anggaran2027: String, anggaran2028: String, anggaran2029: String, anggaran2030: String, anggaranAkhir: String
    }));
    
    const CascadingAnnual = mongoose.models.CascadingAnnual || mongoose.model('CascadingAnnual', new mongoose.Schema({
      id: String, level: String, text: String, indikator: String, target: String, satuan: String, tipeTarget: String,
      parentId: String, bidangPengampu: [String], crossCuttingType: String, splitTargets: mongoose.Schema.Types.Mixed, tahun: Number
    }));
    
    const MasterProgram = mongoose.models.MasterProgram || mongoose.model('MasterProgram', new mongoose.Schema({ id: String, nama: String }));
    const MasterKegiatan = mongoose.models.MasterKegiatan || mongoose.model('MasterKegiatan', new mongoose.Schema({ id: String, programId: String, nama: String }));
    const MasterSubkegiatan = mongoose.models.MasterSubkegiatan || mongoose.model('MasterSubkegiatan', new mongoose.Schema({ id: String, kegiatanId: String, nama: String, indikator: String, satuan: String }));
    const Selection = mongoose.models.Selection || mongoose.model('Selection', new mongoose.Schema({ employeeId: String, tahun: Number, selectedIndicators: [String] }));
    
    const Renaksi = mongoose.models.Renaksi || mongoose.model('Renaksi', new mongoose.Schema({
      id: String, employeeId: String, bidang: String, tahun: Number, indicatorId: String, bulan: Number, targetBulanan: Number, realisasiBulanan: Number,
      tanggalRealisasi: String, buktiDukung: String, kendala: String, solusi: String, faktorPendorong: String, inovasi: String, status: String
    }));
    
    const Performance = mongoose.models.Performance || mongoose.model('Performance', new mongoose.Schema({
      id: String, employeeId: String, tahun: Number, status: String, targetIKU: [String],
      evaluasiAtasan: { evaluatorId: String, skorAKIP: Number, predikat: String, catatan: String, tanggalEvaluasi: String }
    }));

    const dbPath = path.join(__dirname, '..', 'legacy', 'db.json');
    if (!fs.existsSync(dbPath)) {
      console.error('Legacy db.json not found at:', dbPath);
      process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    await Employee.deleteMany({});
    await Cascading5Years.deleteMany({});
    await CascadingAnnual.deleteMany({});
    await MasterProgram.deleteMany({});
    await MasterKegiatan.deleteMany({});
    await MasterSubkegiatan.deleteMany({});
    await Selection.deleteMany({});
    await Renaksi.deleteMany({});
    await Performance.deleteMany({});

    console.log('Cleared existing collections.');

    const employeesToInsert = (data.employees || []).map(emp => {
      let roles = [emp.role];
      let bidangs = [emp.bidang];
      if (emp.id === 'admin') {
        roles = ['admin', 'admin_bidang'];
        bidangs = ['Sekretariat', 'Pencegahan & Kesiapsiagaan', 'Kedaruratan & Logistik', 'Rehabilitasi & Rekonstruksi', 'Pimpinan'];
      } else if (emp.role === 'admin_bidang') {
        roles = ['admin_bidang', 'kasi'];
      }
      const isSystemAdmin = emp.id === 'admin';
      const password = isSystemAdmin ? 'admin@123' : 'bpbd@boyolali';
      return { id: emp.id, nama: emp.nama, nip: emp.nip, jabatan: emp.jabatan, password, roles, parentId: emp.parentId, bidangs };
    });
    
    if (!employeesToInsert.some(e => e.id === 'perencana')) {
      employeesToInsert.push({
        id: 'perencana',
        nama: 'Admin Perencana',
        nip: '111111111111111111',
        jabatan: 'Fungsional Perencana',
        password: 'bpbd@boyolali',
        roles: ['perencana'],
        parentId: '1',
        bidangs: ['Sekretariat', 'Pencegahan & Kesiapsiagaan', 'Kedaruratan & Logistik', 'Rehabilitasi & Rekonstruksi', 'Pimpinan']
      });
    }
    await Employee.insertMany(employeesToInsert);

    const c5ToInsert = (data.cascading5Years || []).map(c5 => ({
      id: c5.id, level: c5.level, text: c5.text, indikator: c5.indikator, satuan: c5.satuan, tipeTarget: c5.tipeTarget || 'Kondisi Akhir Naik', parentId: c5.parentId,
      bidangPengampu: [c5.bidangPengampu], crossCuttingType: 'shared', splitTargets: {},
      target2025: c5.target2025 || '0', target2026: c5.target2026 || '0', target2027: c5.target2027 || '0', target2028: c5.target2028 || '0', target2029: c5.target2029 || '0', target2030: c5.target2030 || '0', targetAkhir: c5.targetAkhir || '0',
      anggaran2025: '0', anggaran2026: '0', anggaran2027: '0', anggaran2028: '0', anggaran2029: '0', anggaran2030: '0', anggaranAkhir: '0'
    }));
    await Cascading5Years.insertMany(c5ToInsert);

    const cAnnualToInsert = (data.cascading || []).map(ca => ({
      id: ca.id, level: ca.level, text: ca.text, indikator: ca.indikator, target: ca.target, satuan: ca.satuan, tipeTarget: ca.tipeTarget || 'Kondisi Akhir Naik',
      parentId: ca.parentId, bidangPengampu: [ca.bidangPengampu], crossCuttingType: 'shared', splitTargets: {}, tahun: 2026
    }));
    await CascadingAnnual.insertMany(cAnnualToInsert);

    await MasterProgram.insertMany(data.masterProgram || []);
    await MasterKegiatan.insertMany(data.masterKegiatan || []);
    await MasterSubkegiatan.insertMany(data.masterSubkegiatan || []);
    await Selection.insertMany(data.selections || []);

    const renaksiToInsert = (data.renaksi || []).map(rx => {
      const emp = data.employees.find(e => e.id === rx.employeeId);
      return {
        id: rx.id, employeeId: rx.employeeId, bidang: emp ? emp.bidang : '', tahun: rx.tahun || 2026, indicatorId: rx.indicatorId, bulan: rx.bulan,
        targetBulanan: rx.targetBulanan || 0, realisasiBulanan: rx.realisasiBulanan, tanggalRealisasi: rx.tanggalRealisasi || null, buktiDukung: rx.buktiDukung || '',
        kendala: rx.kendala || '', solusi: rx.solusi || '', faktorPendorong: rx.faktorPendorong || '', inovasi: rx.inovasi || '', status: rx.status || 'Draft'
      };
    });
    await Renaksi.insertMany(renaksiToInsert);

    const perfToInsert = (data.performances || []).map(p => ({
      id: p.id, employeeId: p.employeeId, tahun: p.tahun || 2026, status: p.status || 'Draft', targetIKU: p.targetIKU || [],
      evaluasiAtasan: p.evaluasiAtasan || { evaluatorId: null, skorAKIP: null, predikat: null, catatan: '', tanggalEvaluasi: null }
    }));
    await Performance.insertMany(perfToInsert);

    console.log('Successfully seeded database:');
    console.log(`- Employees: ${employeesToInsert.length}`);
    console.log(`- Cascading 5 Years: ${c5ToInsert.length}`);
    console.log(`- Cascading Annual: ${cAnnualToInsert.length}`);
    console.log(`- Master Program/Kegiatan/Subkegiatan: ${(data.masterProgram || []).length}/${(data.masterKegiatan || []).length}/${(data.masterSubkegiatan || []).length}`);
    console.log(`- Selections: ${(data.selections || []).length}`);
    console.log(`- Renaksi: ${renaksiToInsert.length}`);
    console.log(`- Performance Records: ${perfToInsert.length}`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding script error:', error);
    process.exit(1);
  }
}

run();
