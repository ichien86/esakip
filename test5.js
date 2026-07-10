const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('akip');
  const docs = await db.collection('cascadingannuals').find({ parentId: '5y_prog_14_2026' }).toArray();
  const kegIds = docs.map(k => k.id);
  const subs = await db.collection('cascadingannuals').find({ parentId: { $in: kegIds } }).toArray();
  console.log(JSON.stringify(docs.map(x=>({level:x.level, sasaran:x.sasaran})), null, 2));
  console.log(JSON.stringify(subs.map(x=>({level:x.level, sasaran:x.sasaran, sasaranSubkegiatan:x.sasaranSubkegiatan})), null, 2));
  process.exit(0);
}
run();
