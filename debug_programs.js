const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://localhost:27017/esakip');
  const db = mongoose.connection.db;
  const programs = await db.collection('cascadingannuals').find({
    $or: [{ level: 'sasaran_program' }, { level: 'program' }]
  }).toArray();
  for(let p of programs) {
    console.log(`Program: ${p.text} | Bidang: ${p.bidangPengampu}`);
  }
  process.exit(0);
}
run();
