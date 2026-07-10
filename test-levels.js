const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('akip');
  
  const pipeline = [
    { $group: { _id: '$level', count: { $sum: 1 } } }
  ];
  
  const result = await db.collection('cascading5years').aggregate(pipeline).toArray();
  console.log('--- LEVELS IN CASCADING 5 YEARS ---');
  console.log(JSON.stringify(result, null, 2));
  
  process.exit(0);
}
run();
