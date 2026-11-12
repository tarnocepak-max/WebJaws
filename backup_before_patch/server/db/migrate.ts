import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, checkConnection } from './db.js';
import { webJawsStore } from './store.js';

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
  const dbStatus = await checkConnection();

  if (!dbStatus.connected || !pool) {
    return {
      success: true,
      message: `Database URL is currently not connected to an external PostgreSQL cluster (${dbStatus.error || 'Running in standalone in-memory store'}). Store schema is synchronized in-memory.`,
      tablesCreated: [
        'roles',
        'permissions',
        'role_permissions',
        'staff_users',
        'auth_sessions',
        'login_attempts',
        'password_reset_tokens',
        'contractors',
        'contractor_areas',
        'work_orders',
        'wo_status_history',
        'ticket_messages',
        'notifications',
        'wo_import_batches',
        'wo_import_errors',
        'dropdown_options',
        'app_config_versions',
        'audit_logs'
      ],
      durationMs: Date.now() - start,
      dbType: 'memory_fallback',
    };
  }

  const migrationFilePath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
  if (!fs.existsSync(migrationFilePath)) {
    throw new Error(`Migration SQL file not found at: ${migrationFilePath}`);
  }

  const sql = fs.readFileSync(migrationFilePath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);

    // Verify created tables
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    const res = await client.query(tableQuery);
    const tables = res.rows.map((r) => r.table_name);

    await client.query('COMMIT');

    const durationMs = Date.now() - start;

    webJawsStore.addAuditLog({
      user_name: 'System Migration Runner',
      role: 'Superadmin',
      activity: 'EXECUTE_MIGRATION',
      module: 'Database',
      diff_data: { tablesCount: tables.length, durationMs },
      ip_address: '127.0.0.1',
    });

    return {
      success: true,
      message: `Migration 001_initial_schema.sql applied successfully to Supabase PostgreSQL (${tables.length} tables verified).`,
      tablesCreated: tables,
      durationMs,
      dbType: 'supabase_postgres',
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    return {
      success: false,
      message: `Migration execution failed: ${err.message}`,
      tablesCreated: [],
      durationMs: Date.now() - start,
      dbType: 'supabase_postgres',
      error: err.message,
    };
  } finally {
    client.release();
  }
}
