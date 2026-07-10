const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('akip');
  
  const c5y = await db.collection('cascading5years').find({}).toArray();
  console.log('--- MASTER 5 TAHUN ---');
  c5y.forEach(d => console.log(`ID: ${d.id} | Level: ${d.level} | Nomenklatur: ${d.nomenklatur || d.text} | ParentId: ${d.parentId}`));
  
  process.exit(0);
}
run();
