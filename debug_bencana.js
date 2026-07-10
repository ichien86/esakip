const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://localhost:27017/esakip');
  const db = mongoose.connection.db;
  const inds = await db.collection('indicatorannuals').find({
    indikator: { $regex: 'bencana', $options: 'i' }
  }).toArray();
  for(let i of inds) console.log(i.indikator, i.nodeId);
  process.exit(0);
}
run();
