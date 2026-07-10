const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('akip');
  
  const inds = await db.collection('indicator5years').find({ nodeId: '5y_prog_14' }).toArray();
  console.log('--- INDICATORS FOR 5y_prog_14 ---');
  inds.forEach(ind => console.log(`ID: ${ind.id} | Indikator: ${ind.indikator}`));
  
  process.exit(0);
}
run();
