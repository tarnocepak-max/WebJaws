import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

export interface DBStatus {
  connected: boolean;
  type: 'supabase_postgres' | 'unavailable';
  databaseName?: string;
  serverTime?: string;
  latencyMs?: number;
  error?: string;
  connectionStringMasked?: string;
}

const databaseUrl = process.env.DATABASE_URL || '';
let pool: pg.Pool | null = null;
const hasPlaceholder = /your-db-password|your-supabase-ref|\[YOUR-PASSWORD\]|change-me/i.test(databaseUrl);

if (databaseUrl.trim() && !hasPlaceholder) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (err) => console.error('Unexpected PostgreSQL pool error:', err.message));
}

export function maskConnectionString(str: string): string {
  if (!str) return 'Not Configured';
  return str.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/i, '$1********$2');
}

export async function checkConnection(): Promise<DBStatus> {
  if (!pool) {
    return {
      connected: false,
      type: 'unavailable',
      connectionStringMasked: maskConnectionString(databaseUrl),
      error: !databaseUrl ? 'DATABASE_URL is not configured' : 'DATABASE_URL contains placeholder values or could not initialize the pool',
    };
  }
  const start = Date.now();
  try {
    const result = await pool.query('SELECT current_database() AS db_name, NOW() AS current_time');
    return {
      connected: true,
      type: 'supabase_postgres',
      databaseName: result.rows[0]?.db_name || 'postgres',
      serverTime: result.rows[0]?.current_time,
      latencyMs: Date.now() - start,
      connectionStringMasked: maskConnectionString(databaseUrl),
    };
  } catch (error: any) {
    return {
      connected: false,
      type: 'unavailable',
      connectionStringMasked: maskConnectionString(databaseUrl),
      error: `PostgreSQL connection failed: ${error.message}`,
    };
  }
}

export async function query<T extends pg.QueryResultRow = any>(sql: string, params?: any[]): Promise<pg.QueryResult<T>> {
  if (!pool) throw new Error('PostgreSQL is unavailable. Configure DATABASE_URL before using persistent features.');
  return pool.query<T>(sql, params);
}

export { pool };
