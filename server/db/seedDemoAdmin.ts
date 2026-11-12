import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool, checkConnection } from './db.js';

dotenv.config({ override: true });

export async function runSeedDemoAdmin(): Promise<{ success: boolean; message: string; userId?: string }> {
  console.log('[WebJaws Seed] Starting Demo Superadmin account provision...');

  // 1. Production Safety Check - Strictly forbidden in production
  const env = (process.env.NODE_ENV || 'development').trim().toLowerCase();
  if (env === 'production') {
    const msg = 'ERROR: Demo account seeding is strictly forbidden in PRODUCTION environment.';
    console.error(`[WebJaws Seed] ${msg}`);
    return { success: false, message: msg };
  }

  // 2. Demo Password Validation via Environment Variable
  const demoPassword = process.env.DEMO_ADMIN_PASSWORD;
  if (!demoPassword || typeof demoPassword !== 'string' || !demoPassword.trim()) {
    const msg = 'ERROR: Environment variable DEMO_ADMIN_PASSWORD is required. Usage: DEMO_ADMIN_PASSWORD=your_password npm run seed:demo';
    console.error(`[WebJaws Seed] ${msg}`);
    return { success: false, message: msg };
  }

  // 3. Weak Password Protection Check
  const isWeak = demoPassword.length < 8 || /^(1234|admin|password|123456)$/i.test(demoPassword);
  if (isWeak && process.env.ALLOW_WEAK_DEMO_PASSWORD !== 'true') {
    const msg = 'ERROR: DEMO_ADMIN_PASSWORD is weak (< 8 characters or trivial dictionary word). Must explicitly confirm ALLOW_WEAK_DEMO_PASSWORD=true.';
    console.error(`[WebJaws Seed] ${msg}`);
    return { success: false, message: msg };
  }

  // 4. Database Connection Check
  const dbStatus = await checkConnection();
  if (!dbStatus.connected || !pool) {
    const msg = `ERROR: PostgreSQL is unavailable: ${dbStatus.error || 'Pool not initialized'}`;
    console.error(`[WebJaws Seed] ${msg}`);
    return { success: false, message: msg };
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 5. Ensure role 'Superadmin' exists in roles table
    await client.query(
      `INSERT INTO roles (id, name, description, is_system)
       VALUES ('Superadmin', 'Superadmin', 'Administrator utama WebJaws', TRUE)
       ON CONFLICT (id) DO NOTHING`
    );

    const DEMO_USERNAME = 'admin';
    const DEMO_EMAIL = 'adminjaws@mora.jaws';
    const DEMO_FULLNAME = 'WebJaws Demo Admin';

    // 6. Duplicate Check - Reject duplicate and never overwrite existing accounts
    const existingCheck = await client.query(
      `SELECT id, username, email FROM staff_users 
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) 
       LIMIT 1`,
      [DEMO_USERNAME, DEMO_EMAIL]
    );

    if (existingCheck.rowCount && existingCheck.rowCount > 0) {
      const existing = existingCheck.rows[0];
      const msg = `Notice: Account with username '${existing.username}' or email '${existing.email}' already exists. Skipping insertion to prevent overwriting.`;
      console.log(`[WebJaws Seed] ${msg}`);
      await client.query('COMMIT');
      return { success: true, message: msg, userId: existing.id };
    }

    // 7. Hash password with bcrypt cost 10 (never log plaintext or hash)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(demoPassword, salt);

    // 8. Insert Demo Superadmin
    const insertRes = await client.query(
      `INSERT INTO staff_users (
        username, email, password_hash, full_name, role, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'Superadmin', TRUE, NOW(), NOW())
      RETURNING id, username, email, full_name, role, is_active, created_at`,
      [DEMO_USERNAME, DEMO_EMAIL, passwordHash, DEMO_FULLNAME]
    );

    const createdUser = insertRes.rows[0];

    // 9. Audit log entry (sanitized, no secrets)
    await client.query(
      `INSERT INTO audit_logs (
        user_id, user_name, role, activity, module, record_id, ip_address, created_at
      ) VALUES ($1, $2, 'Superadmin', 'DEMO_SUPERADMIN_SEEDED', 'Authentication', $3, '127.0.0.1', NOW())`,
      [createdUser.id, createdUser.full_name, createdUser.username]
    );

    await client.query('COMMIT');

    console.log('[WebJaws Seed] SUCCESS: Demo Superadmin account provisioned successfully.');
    console.log(`[WebJaws Seed] User ID   : ${createdUser.id}`);
    console.log(`[WebJaws Seed] Username  : ${createdUser.username}`);
    console.log(`[WebJaws Seed] Email     : ${createdUser.email}`);
    console.log(`[WebJaws Seed] Role      : ${createdUser.role}`);
    console.log(`[WebJaws Seed] Status    : ${createdUser.is_active ? 'Active' : 'Inactive'}`);

    return {
      success: true,
      message: 'Demo Superadmin provisioned successfully',
      userId: createdUser.id,
    };
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    const msg = `ERROR during transaction: ${error.message}`;
    console.error(`[WebJaws Seed] ${msg}`);
    return { success: false, message: msg };
  } finally {
    if (client) client.release();
  }
}

// When executed directly from CLI: npm run seed:demo
async function main() {
  let exitCode = 0;
  try {
    const result = await runSeedDemoAdmin();
    if (!result.success) {
      exitCode = 1;
    }
  } catch (err: any) {
    console.error('[WebJaws Seed] Unexpected fatal error:', err.message);
    exitCode = 1;
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
    process.exitCode = exitCode;
  }
}

// Run if this script is executed directly
main();
