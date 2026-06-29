import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
    
    // Auto-migration check (Opsi A) - Runs once per process boot
    // Only runs if RUN_MIGRATION=true is set in environment variables.
    // This is intentionally disabled in production (Vercel) to prevent
    // 4 heavy DB queries on every cold start, which caused 15s login delays.
    if (!cached.migrated) {
      cached.migrated = true;
      if (process.env.RUN_MIGRATION === 'true') {
        try {
          const { runAutoMigration } = await import('./auto-migrate');
          await runAutoMigration();
        } catch (err) {
          console.error('[db] Auto-migration initialization failed:', err);
        }
      }
    }
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
