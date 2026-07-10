const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('akip');
  
  const docs = await db.collection('cascading5years').find({ id: { $in: ['5y_prog_14', '5y_prog_25', '5y_prog_54', '5y_prog_73', '5y_prog_79'] } }).toArray();
  console.log(JSON.stringify(docs.map(x=>({id:x.id, level:x.level, text:x.text}))));
  
  process.exit(0);
}
run();
