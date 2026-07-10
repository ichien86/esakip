const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://localhost:27017/esakip');
  const db = mongoose.connection.db;
  const programs = await db.collection('cascading5years').find({
    $or: [{ level: 'sasaran_program' }, { level: 'program' }]
  }).toArray();
  for(let p of programs) {
    console.log(`Program: ${p.text} | Bidang: ${p.bidangPengampu}`);
    const kegs = await db.collection('cascading5years').find({ parentId: p.id }).toArray();
    for (const k of kegs) {
       console.log(`  Keg: ${k.text} | Bidang: ${k.bidangPengampu}`);
       const subkegs = await db.collection('cascading5years').find({ parentId: k.id }).toArray();
       for (const s of subkegs) {
          console.log(`    Subkeg: ${s.text} | Bidang: ${s.bidangPengampu}`);
       }
    }
  }
  process.exit(0);
}
run();
