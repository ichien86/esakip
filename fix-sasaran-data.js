const { MongoClient, ObjectId } = require('mongodb');

async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('akip');
  const Cascading5Years = db.collection('cascading5years');
  const Indicator5Years = db.collection('indicator5years');
  
  console.log('--- STARTING DATA FIX ---');
  
  // 1. Dapatkan node 14 sebagai template
  const prog14 = await Cascading5Years.findOne({ id: '5y_prog_14' });
  if (!prog14) {
    console.error('Node 5y_prog_14 not found!');
    process.exit(1);
  }
  
  // 2. Data indikator yang perlu dipindah dan sasarannya
  const dataMap = [
    {
      id: '5y_prog_25',
      sasaran: 'Meningkatnya Pelayanan Pencegahan dan Kesiapsiagaan Terhadap Bencana',
      indikatorId: 'ind_mig_5y_prog_25',
      kegiatanIds: ['5y_keg_26', '5y_keg_39']
    },
    {
      id: '5y_prog_54',
      sasaran: 'Meningkatnya Pelayanan Penyelamatan dan Evakuasi Korban Bencana',
      indikatorId: 'ind_mig_5y_prog_54',
      kegiatanIds: ['5y_keg_55']
    },
    {
      id: '5y_prog_73',
      sasaran: 'Meningkatnya Pemulihan Pascabencana',
      indikatorId: 'ind_mig_5y_prog_73',
      kegiatanIds: ['5y_keg_74']
    },
    {
      id: '5y_prog_79',
      sasaran: 'Meningkatnya Partisipasi Kelembagaan Bencana',
      indikatorId: 'ind_mig_5y_prog_79',
      kegiatanIds: ['5y_keg_80']
    }
  ];
  
  // 3. Eksekusi pemulihan
  for (const data of dataMap) {
    // a. Buat simpul sasaran_program baru jika belum ada
    const existingNode = await Cascading5Years.findOne({ id: data.id });
    if (!existingNode) {
      const newNode = {
        ...prog14,
        _id: new ObjectId(), // fix ObjectID
        id: data.id,
        sasaran: data.sasaran,
        text: data.sasaran, 
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await Cascading5Years.insertOne(newNode);
      console.log(`Created node ${data.id}`);
    } else {
      console.log(`Node ${data.id} already exists`);
      // Pastikan sasarannya benar
      await Cascading5Years.updateOne({ id: data.id }, { $set: { sasaran: data.sasaran, text: data.sasaran } });
    }
    
    // b. Pindahkan anak kegiatan
    for (const kegId of data.kegiatanIds) {
      const result = await Cascading5Years.updateOne({ id: kegId }, { $set: { parentId: data.id, updatedAt: new Date() } });
      if (result.modifiedCount > 0) {
        console.log(`Reparented ${kegId} to ${data.id}`);
      }
    }
    
    // c. Pindahkan indikator
    const indResult = await Indicator5Years.updateOne({ id: data.indikatorId }, { $set: { nodeId: data.id, updatedAt: new Date() } });
    if (indResult.modifiedCount > 0) {
      console.log(`Restored indicator ${data.indikatorId} to node ${data.id}`);
    }
  }
  
  // 4. Update Node 14: Sasarannya kembali difokuskan ke Informasi Bencana
  await Cascading5Years.updateOne(
    { id: '5y_prog_14' },
    { $set: { sasaran: 'Meningkatnya Kualitas Layanan Informasi Bencana', text: 'Meningkatnya Kualitas Layanan Informasi Bencana' } }
  );
  console.log(`Updated 5y_prog_14 sasaran text.`);
  
  console.log('--- DONE ---');
  process.exit(0);
}
run().catch(console.dir);
