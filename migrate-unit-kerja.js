// Script untuk menstandarkan teks "Bidang Pengampu" di database
// Jalankan dengan: node migrate-unit-kerja.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables dari .env.local
dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI tidak ditemukan di .env.local');
  process.exit(1);
}

// Kamus Alias: Key adalah teks lama/typo/singkatan, Value adalah teks baku baru.
const ALIAS_MAP = {
  // Renstra to Formal
  'Sekretariat': 'Sekretariat',
  'Pencegahan & Kesiapsiagaan': 'Bidang Pencegahan dan Kesiapsiagaan',
  'Kedaruratan & Logistik': 'Bidang Kedaruratan dan Logistik',
  'Rehabilitasi & Rekonstruksi': 'Bidang Rehabilitasi dan Rekonstruksi',
  
  // Variations
  'Pencegahan dan Kesiapsiagaan': 'Bidang Pencegahan dan Kesiapsiagaan',
  'Kedaruratan dan Logistik': 'Bidang Kedaruratan dan Logistik',
  'Rehabilitasi dan Rekonstruksi': 'Bidang Rehabilitasi dan Rekonstruksi',
  
  'Subbagian Tata Usaha': 'Subbagian Tata Usaha',
  'Tata Usaha': 'Subbagian Tata Usaha',
  
  // Add other known aliases here
};

// Initial Master Data for Unit Kerja
const INITIAL_MASTER_DATA = [
  {
    id: "bid_sekretariat",
    name: "Sekretariat",
    type: "Sekretariat",
    subUnits: [
      { id: "sub_tu", name: "Subbagian Tata Usaha" }
    ]
  },
  {
    id: "bid_pencegahan",
    name: "Bidang Pencegahan dan Kesiapsiagaan",
    type: "Bidang",
    subUnits: []
  },
  {
    id: "bid_kedaruratan",
    name: "Bidang Kedaruratan dan Logistik",
    type: "Bidang",
    subUnits: []
  },
  {
    id: "bid_rehab",
    name: "Bidang Rehabilitasi dan Rekonstruksi",
    type: "Bidang",
    subUnits: []
  }
];

function normalize(str) {
  if (!str) return null;
  const trimmed = str.trim();
  return ALIAS_MAP[trimmed] || ALIAS_MAP[trimmed.replace(/^Bidang\s+/i, '')] || trimmed;
}

async function run() {
  console.log('Mulai migrasi standarisasi Unit Kerja...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // 1. Inisialisasi Settings Master Data
  const settingsColl = db.collection('settings');
  const existingMaster = await settingsColl.findOne({ key: 'master_unit_kerja' });
  if (!existingMaster) {
    console.log('Membuat Master Unit Kerja awal di koleksi Settings...');
    await settingsColl.insertOne({
      key: 'master_unit_kerja',
      value: INITIAL_MASTER_DATA,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } else {
    console.log('Master Unit Kerja sudah ada, melewati inisialisasi.');
  }

  // 2. Update Employee
  console.log('\n--- Migrasi Employee ---');
  const employees = await db.collection('employees').find({}).toArray();
  let empUpdated = 0;
  for (const emp of employees) {
    let changed = false;
    const newBidangs = (emp.bidangs || []).map(b => {
      const norm = normalize(b);
      if (norm !== b) changed = true;
      return norm;
    });
    
    const newPlt = (emp.pltBidangs || []).map(b => {
      const norm = normalize(b);
      if (norm !== b) changed = true;
      return norm;
    });

    if (changed) {
      await db.collection('employees').updateOne(
        { _id: emp._id },
        { $set: { bidangs: newBidangs, pltBidangs: newPlt } }
      );
      empUpdated++;
    }
  }
  console.log(`Berhasil mengupdate ${empUpdated} pegawai.`);

  // 3. Update Cascading5Years
  console.log('\n--- Migrasi Cascading5Years (Renstra) ---');
  const c5s = await db.collection('cascading5years').find({}).toArray();
  let c5Updated = 0;
  for (const node of c5s) {
    let changed = false;
    const newBidangs = (node.bidangPengampu || []).map(b => {
      const norm = normalize(b);
      if (norm !== b) changed = true;
      return norm;
    });

    if (changed) {
      await db.collection('cascading5years').updateOne(
        { _id: node._id },
        { $set: { bidangPengampu: newBidangs } }
      );
      c5Updated++;
    }
  }
  console.log(`Berhasil mengupdate ${c5Updated} node Renstra.`);

  // 4. Update CascadingAnnual (Renja)
  console.log('\n--- Migrasi CascadingAnnual (Renja) ---');
  const cas = await db.collection('cascadingannuals').find({}).toArray();
  let caUpdated = 0;
  for (const node of cas) {
    let changed = false;
    const newBidangs = (node.bidangPengampu || []).map(b => {
      const norm = normalize(b);
      if (norm !== b) changed = true;
      return norm;
    });

    if (changed) {
      await db.collection('cascadingannuals').updateOne(
        { _id: node._id },
        { $set: { bidangPengampu: newBidangs } }
      );
      caUpdated++;
    }
  }
  console.log(`Berhasil mengupdate ${caUpdated} node Renja.`);

  console.log('\nMigrasi selesai! Tekan Ctrl+C untuk keluar.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
