const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('akip');
  
  const docs = await db.collection('cascading5years').find({ level: 'sasaran_kegiatan' }).toArray();
  console.log('--- SASARAN KEGIATAN ---');
  docs.forEach(d => console.log(`ID: ${d.id} | Sasaran: ${d.sasaran} | Nomenklatur: ${d.nomenklatur || d.text} | ParentId: ${d.parentId}`));
  
  process.exit(0);
}
run();
