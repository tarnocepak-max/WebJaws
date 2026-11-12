import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, checkConnection } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MigrationResult {
  success: boolean;
  message: string;
  tablesCreated: string[];
  durationMs: number;
  dbType: string;
  error?: string;
}

export async function runMigrations(): Promise<MigrationResult> {
  const start = Date.now();
  const status = await checkConnection();
  if (!status.connected || !pool) {
    return {
      success: false,
      message: 'Migration BLOCKED: real PostgreSQL connection is unavailable. No in-memory migration is performed.',
      tablesCreated: [],
      durationMs: Date.now() - start,
      dbType: 'unavailable',
      error: status.error || 'DATABASE_URL is not configured',
    };
  }

  const migrationPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
  if (!fs.existsSync(migrationPath)) throw new Error(`Migration SQL file not found: ${migrationPath}`);
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    const result = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const tables = result.rows.map((row: { table_name: string }) => row.table_name);
    const required = ['roles', 'permissions', 'role_permissions', 'staff_users', 'auth_sessions', 'work_orders', 'wo_status_history', 'ticket_messages', 'notifications', 'wo_import_batches', 'wo_import_errors', 'dropdown_options', 'app_config_versions', 'audit_logs'];
    const missing = required.filter((name) => !tables.includes(name));
    if (missing.length) throw new Error(`Schema verification failed. Missing tables: ${missing.join(', ')}`);
    await client.query('COMMIT');
    return {
      success: true,
      message: `Migration applied and verified against PostgreSQL (${tables.length} public tables found).`,
      tablesCreated: tables,
      durationMs: Date.now() - start,
      dbType: 'supabase_postgres',
    };
  } catch (error: any) {
    await client.query('ROLLBACK');
    return {
      success: false,
      message: `Migration failed: ${error.message}`,
      tablesCreated: [],
      durationMs: Date.now() - start,
      dbType: 'supabase_postgres',
      error: error.message,
    };
  } finally {
    client.release();
  }
}
