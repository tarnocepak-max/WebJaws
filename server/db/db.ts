import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ override: true });
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
const hasPlaceholder =
  !databaseUrl ||
  /(PROJECT_REF|DB_PASSWORD|@HOST[:/]|your-db-password|your-supabase-ref|\[YOUR-PASSWORD\]|change-me)/i.test(databaseUrl);

const isLocal = /localhost|127\.0\.0\.1|host=\/tmp/i.test(databaseUrl);

if (databaseUrl.trim() && !hasPlaceholder) {
  // If local PostgreSQL is targeted and data directory exists, ensure the local cluster is running
  if (isLocal) {
    try {
      const fs = await import('fs');
      const cp = await import('child_process');
      const possibleDirs = [
        '/app/applet/data/pgdata',
        './data/pgdata',
        '/app/applet/data/postgres',
        './data/postgres',
      ];
      for (const dir of possibleDirs) {
        if (fs.existsSync(`${dir}/PG_VERSION`) && fs.existsSync(`${dir}/postgresql.conf`)) {
          try {
            cp.execSync(
              `su -s /bin/bash appuser -c "/usr/lib/postgresql/15/bin/pg_ctl -D ${dir} status >/dev/null 2>&1 || /usr/lib/postgresql/15/bin/pg_ctl -D ${dir} -o '-k /tmp -p 5432' start >/dev/null 2>&1"`,
              { timeout: 3000 }
            );
            break;
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
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
