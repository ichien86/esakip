const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('akip');
  
  console.log('--- CLEARING TAHUNAN 2026 ---');
  await db.collection('cascadingannuals').deleteMany({ tahun: 2026 });
  await db.collection('indicatorannuals').deleteMany({ tahun: 2026 });
  console.log('Cleared CascadingAnnuals and IndicatorAnnuals for 2026');
  
  process.exit(0);
}
run().catch(console.dir);
