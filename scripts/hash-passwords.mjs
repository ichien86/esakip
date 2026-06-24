import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Resolve __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable inside .env.local');
  process.exit(1);
}

// Since Employee.js is an ES module and relies on mongoose.models,
// we just import it after connecting.
import Employee from '../src/models/Employee.js';

async function run() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const employees = await Employee.find({});
    console.log(`Found ${employees.length} employees.`);

    let updatedCount = 0;
    for (const emp of employees) {
      // Check if password exists and is not already a bcrypt hash (bcrypt hashes usually start with $2a$ or $2b$)
      if (emp.password && !emp.password.startsWith('$2')) {
        console.log(`Hashing password for employee NIP: ${emp.nip}`);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(emp.password, salt);
        
        emp.password = hashedPassword;
        await emp.save();
        updatedCount++;
      }
    }

    console.log(`Finished hashing. Updated ${updatedCount} employees.`);
  } catch (error) {
    console.error('Error during hashing:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
}

run();
