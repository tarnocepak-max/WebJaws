import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export interface DBStatus {
  connected: boolean;
  type: 'supabase_postgres' | 'memory_fallback';
  databaseName?: string;
  serverTime?: string;
  latencyMs?: number;
  error?: string;
  connectionStringMasked?: string;
}

const databaseUrl = process.env.DATABASE_URL || '';

let pool: pg.Pool | null = null;

if (databaseUrl && databaseUrl.trim().length > 0 && !databaseUrl.includes('your-db-password')) {
  try {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err.message);
    });
  } catch (err: any) {
    console.error('Failed to initialize PostgreSQL pool:', err.message);
    pool = null;
  }
}

export function maskConnectionString(str: string): string {
  if (!str) return 'Not Configured';
  try {
    return str.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:********@');
  } catch {
    return 'Configured (Masked)';
  }
}

export async function checkConnection(): Promise<DBStatus> {
  if (!pool) {
    return {
      connected: false,
      type: 'memory_fallback',
      connectionStringMasked: maskConnectionString(databaseUrl),
      error: databaseUrl ? 'Database URL is configured with placeholder values' : 'DATABASE_URL is not set in environment variables',
    };
  }

  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT current_database() as db_name, NOW() as current_time');
      const latencyMs = Date.now() - start;
      return {
        connected: true,
        type: 'supabase_postgres',
        databaseName: res.rows[0]?.db_name || 'postgres',
        serverTime: res.rows[0]?.current_time,
        latencyMs,
        connectionStringMasked: maskConnectionString(databaseUrl),
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return {
      connected: false,
      type: 'memory_fallback',
      connectionStringMasked: maskConnectionString(databaseUrl),
      error: `PostgreSQL connection error: ${err.message}`,
    };
  }
}

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  if (!pool) {
    throw new Error('PostgreSQL database pool is not configured or offline.');
  }
  return pool.query<T>(text, params);
}

export { pool };
