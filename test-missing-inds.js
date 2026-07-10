const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('akip');
  
  const inds = await db.collection('indicator5years').find({ id: { $in: ['ind_mig_5y_prog_14', 'ind_mig_5y_prog_25', 'ind_mig_5y_prog_54', 'ind_mig_5y_prog_73', 'ind_mig_5y_prog_79'] } }).toArray();
  console.log(JSON.stringify(inds.map(i => ({id: i.nodeId, indikator: i.indikator})), null, 2));
  
  process.exit(0);
}
run();
