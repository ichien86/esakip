const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb+srv://ichien86_db_user:HSYNcGfNQVVhKT0K@bpbd.owdfvaa.mongodb.net/akip?appName=bpbd');
  const db = mongoose.connection.db;
  const employees = await db.collection('employees').find({ jenisJabatan: 'Administrator' }).toArray();
  
  console.log('--- ADMINISTRATORS ---');
  for (const emp of employees) {
     console.log(`Name: ${emp.nama}`);
     console.log(`Jabatan: ${emp.jabatan}`);
     console.log(`Bidangs:`, emp.bidangs);
     console.log(`PltBidangs:`, emp.pltBidangs);
     console.log('---');
  }
  process.exit(0);
}
run();
