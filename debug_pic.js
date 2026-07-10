const mongoose = require('mongoose');
const uri = 'mongodb://localhost:27017/esakip';
async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  const inds = await db.collection('indicatorannuals').find({
    indikator: { $regex: 'informasi rawan bencana', $options: 'i' }
  }).toArray();
  
  console.log('--- INDICATORS FOUND ---');
  console.log(JSON.stringify(inds, null, 2));

  for (const ind of inds) {
    const node = await db.collection('cascadingannuals').findOne({ id: ind.nodeId });
    console.log('\n--- PARENT NODE ---');
    if(node) {
      console.log('ID:', node.id, 'Level:', node.level);
      console.log('Text:', node.text);
      console.log('BidangPengampu:', node.bidangPengampu);
      
      const kegs = await db.collection('cascadingannuals').find({ parentId: node.id }).toArray();
      console.log('\n  --- CHILD KEGIATAN ('+kegs.length+') ---');
      for (const k of kegs) {
         console.log('  Keg:', k.text, 'Bidang:', k.bidangPengampu);
         const subkegs = await db.collection('cascadingannuals').find({ parentId: k.id }).toArray();
         console.log('    --- CHILD SUBKEG ('+subkegs.length+') ---');
         for (const s of subkegs) {
            console.log('    Sub:', s.text, 'Bidang:', s.bidangPengampu);
         }
      }
    } else {
      console.log('Node not found for id', ind.nodeId);
    }
  }

  process.exit(0);
}
run().catch(console.error);
