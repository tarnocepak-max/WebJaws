import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool, checkConnection } from './db.js';

dotenv.config();

async function seedDemoAdmin() {
  console.log('[WebJaws Seed] Starting Demo Superadmin account provision...');

  // 1. Production Safety Check
  const env = (process.env.NODE_ENV || 'development').trim().toLowerCase();
  if (env === 'production') {
    console.error('[WebJaws Seed] ERROR: Demo account seeding is strictly forbidden in PRODUCTION environment.');
    process.exit(1);
  }

  // 2. Database Connection Check
  const dbStatus = await checkConnection();
  if (!dbStatus.connected || !pool) {
    console.error(`[WebJaws Seed] ERROR: PostgreSQL is unavailable: ${dbStatus.error || 'Pool not initialized'}`);
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 3. Ensure role 'Superadmin' exists in roles table
    const roleCheck = await client.query(
      "SELECT id FROM roles WHERE id = 'Superadmin' LIMIT 1"
    );
    if (roleCheck.rowCount === 0) {
      await client.query(
        `INSERT INTO roles (id, name, description, is_system)
         VALUES ('Superadmin', 'Superadmin', 'Administrator utama WebJaws', TRUE)
         ON CONFLICT (id) DO NOTHING`
      );
      console.log("[WebJaws Seed] Initialized 'Superadmin' role in roles table.");
    }

    const DEMO_USERNAME = 'admin';
    const DEMO_EMAIL = 'adminjaws@mora.jaws';
    const DEMO_FULLNAME = 'WebJaws Demo Admin';
    const DEMO_RAW_PASSWORD = '1234';

    // 4. Duplicate Check - do not overwrite existing accounts
    const existingCheck = await client.query(
      `SELECT id, username, email FROM staff_users 
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) 
       LIMIT 1`,
      [DEMO_USERNAME, DEMO_EMAIL]
    );

    if (existingCheck.rowCount && existingCheck.rowCount > 0) {
      const existing = existingCheck.rows[0];
      console.log(`[WebJaws Seed] Notice: Account with username '${existing.username}' or email '${existing.email}' already exists. Skipping insertion to prevent overwriting.`);
      await client.query('COMMIT');
      process.exit(0);
    }

    // 5. Hash password with bcrypt cost 10 (never log plaintext or hash)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(DEMO_RAW_PASSWORD, salt);

    // 6. Insert Demo Superadmin
    const insertRes = await client.query(
      `INSERT INTO staff_users (
        username, email, password_hash, full_name, role, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'Superadmin', TRUE, NOW(), NOW())
      RETURNING id, username, email, full_name, role, is_active, created_at`,
      [DEMO_USERNAME, DEMO_EMAIL, passwordHash, DEMO_FULLNAME]
    );

    const createdUser = insertRes.rows[0];

    // 7. Audit log
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
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error(`[WebJaws Seed] ERROR during transaction: ${error.message}`);
    process.exit(1);
  } finally {
    client.release();
    // Do not hang the process
    process.exit(0);
  }
}

seedDemoAdmin();
