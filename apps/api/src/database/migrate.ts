import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ ERROR: DATABASE_URL is not set in .env file.');
    console.log('\n💡 Example .env setting:');
    console.log('DATABASE_URL="postgresql://postgres:your_password@localhost:5432/lendora_db"');
    console.log('Or a free cloud database like Neon.tech or Supabase:\nDATABASE_URL="postgresql://user:pass@ep-cool-xyz.ap-southeast-1.aws.neon.tech/lendora?sslmode=require"');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    console.log('🔄 Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    // Read schema.sql from the repository root database/schema.sql
    const candidatePaths = [
      path.resolve(baseDir, '../../../../database/schema.sql'),
      path.resolve(baseDir, '../../../database/schema.sql'),
      path.resolve(process.cwd(), 'database/schema.sql'),
      path.resolve(process.cwd(), '../../database/schema.sql'),
    ];
    const schemaPath = candidatePaths.find(p => fs.existsSync(p));
    if (!schemaPath) {
      throw new Error(`schema.sql not found in candidate paths: ${candidatePaths.join(', ')}`);
    }

    console.log(`📖 Reading schema file: ${schemaPath}`);
    const sql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('⚡ Executing schema migration...');
    await client.query(sql);

    console.log('================================================================');
    console.log('🎉 SUCCESS: Lendora PostgreSQL Database Schema & Tables Created!');
    console.log('   All tables, constraints, indexes & default seeds are ready.');
    console.log('================================================================');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();
