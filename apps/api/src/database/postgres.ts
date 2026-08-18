import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export const pgPool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  : null;

export async function queryPostgres(text: string, params?: any[]) {
  if (!pgPool) {
    throw new Error('PostgreSQL is not configured. Please set DATABASE_URL in .env');
  }
  const start = Date.now();
  const res = await pgPool.query(text, params);
  const duration = Date.now() - start;
  if (config.nodeEnv === 'development') {
    console.log('Executed query', { text: text.slice(0, 80), duration, rows: res.rowCount });
  }
  return res;
}
