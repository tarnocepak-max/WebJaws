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
  appliedMigrations?: string[];
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

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    throw new Error('No migration files found in migrations directory');
  }

  const client = await pool.connect();
  const appliedMigrations: string[] = [];

  try {
    await client.query('BEGIN');

    // Create schema_migrations tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Fetch already applied migrations
    const appliedRes = await client.query('SELECT version FROM schema_migrations');
    const alreadyApplied = new Set<string>(appliedRes.rows.map((r: { version: string }) => r.version));

    for (const file of migrationFiles) {
      if (alreadyApplied.has(file)) {
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      appliedMigrations.push(file);
    }

    // Verify required core tables
    const result = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const tables = result.rows.map((row: { table_name: string }) => row.table_name);
    const required = [
      'roles',
      'permissions',
      'role_permissions',
      'staff_users',
      'auth_sessions',
      'work_orders',
      'wo_status_history',
      'ticket_messages',
      'notifications',
      'wo_import_batches',
      'wo_import_errors',
      'dropdown_options',
      'app_config_versions',
      'audit_logs',
    ];
    const missing = required.filter((name) => !tables.includes(name));
    if (missing.length) {
      throw new Error(`Schema verification failed. Missing tables: ${missing.join(', ')}`);
    }

    await client.query('COMMIT');
    return {
      success: true,
      message: `Migrations applied successfully (${appliedMigrations.length} new, ${tables.length} tables verified).`,
      tablesCreated: tables,
      appliedMigrations,
      durationMs: Date.now() - start,
      dbType: 'supabase_postgres',
    };
  } catch (error: any) {
    await client.query('ROLLBACK');
    return {
      success: false,
      message: `Migration failed: ${error.message}`,
      tablesCreated: [],
      appliedMigrations: [],
      durationMs: Date.now() - start,
      dbType: 'supabase_postgres',
      error: error.message,
    };
  } finally {
    client.release();
  }
}

if (process.argv[1] && (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'))) {
  runMigrations()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(r.success ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

