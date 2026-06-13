const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/akip');
  console.log('Connected to MongoDB');

  const nodes = await mongoose.connection.db.collection('cascading5years').find({
    level: { $in: ['tujuan', 'sasaran'] }
  }).toArray();

  const nodeIds = nodes.map(n => n.id);
  const indicators = await mongoose.connection.db.collection('indicator5years').find({
    nodeId: { $in: nodeIds }
  }).toArray();

  console.log('=== NODES ===');
  nodes.forEach(n => {
    console.log(`- ID: ${n.id} | Level: ${n.level} | Text: ${n.text}`);
  });

  console.log('\n=== INDICATORS ===');
  indicators.forEach(i => {
    console.log(`- ID: ${i.id} | NodeID: ${i.nodeId} | Indikator: ${i.indikator} | Satuan: ${i.satuan} | DefOp: ${i.definisiOperasional ? 'Yes (' + i.definisiOperasional.substring(0, 30) + '...)' : 'No'}`);
  });

  await mongoose.disconnect();
}

main().catch(console.error);
