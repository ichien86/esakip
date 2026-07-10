const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb+srv://ichien86_db_user:HSYNcGfNQVVhKT0K@bpbd.owdfvaa.mongodb.net/akip?appName=bpbd');
  const db = mongoose.connection.db;
  const inds = await db.collection('indicatorannuals').find({
    indikator: { $regex: 'informasi rawan bencana', $options: 'i' }
  }).toArray();
  
  console.log('--- INDICATORS FOUND ---');
  for (const ind of inds) {
     console.log(`\nIndikator: ${ind.indikator}`);
     console.log(`NodeId: ${ind.nodeId}`);
     
     const node = await db.collection('cascadingannuals').findOne({ id: ind.nodeId });
     if(node) {
        console.log(`Node [${node.level}]: ${node.text}`);
        console.log(`BidangPengampu:`, node.bidangPengampu);
        console.log(`CrossCuttingType:`, node.crossCuttingType);
        
        const kegs = await db.collection('cascadingannuals').find({ parentId: node.id }).toArray();
        for (const k of kegs) {
           console.log(`  Keg: ${k.text} | Bidang: ${k.bidangPengampu}`);
           const subkegs = await db.collection('cascadingannuals').find({ parentId: k.id }).toArray();
           for (const s of subkegs) {
              console.log(`    Subkeg: ${s.text} | Bidang: ${s.bidangPengampu}`);
           }
        }
     }
  }
  process.exit(0);
}
run();
