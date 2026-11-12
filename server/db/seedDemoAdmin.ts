import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool, checkConnection } from './db.js';

const explicitEnv = process.env.NODE_ENV;
dotenv.config({ override: true });

async function seedDemoAdmin() {
  console.log('[WebJaws Seed] Starting Demo Superadmin account provision...');

  // 1. Production Safety Check - Strictly forbidden in production
  const env = (explicitEnv || process.env.NODE_ENV || 'development').trim().toLowerCase();
  if (env === 'production') {
    console.error('[WebJaws Seed] ERROR: Demo account seeding is strictly forbidden in PRODUCTION environment.');
    process.exit(1);
  }

  // 2. Demo Password Validation via Environment Variable
  const demoPassword = process.env.DEMO_ADMIN_PASSWORD;
  if (!demoPassword || typeof demoPassword !== 'string' || !demoPassword.trim()) {
    console.error('[WebJaws Seed] ERROR: Environment variable DEMO_ADMIN_PASSWORD is required.');
    console.error('[WebJaws Seed] Usage: DEMO_ADMIN_PASSWORD=your_password npm run seed:demo');
    process.exit(1);
  }

  // 3. Weak Password Protection Check
  const isWeak = demoPassword.length < 8 || /^(1234|admin|password|123456)$/i.test(demoPassword);
  if (isWeak && process.env.ALLOW_WEAK_DEMO_PASSWORD !== 'true') {
    console.error('[WebJaws Seed] ERROR: DEMO_ADMIN_PASSWORD is weak (< 8 characters or trivial dictionary word).');
    console.error('[WebJaws Seed] To proceed intentionally with a weak password, you must explicitly confirm ALLOW_WEAK_DEMO_PASSWORD=true.');
    console.error('[WebJaws Seed] Example: ALLOW_WEAK_DEMO_PASSWORD=true DEMO_ADMIN_PASSWORD=1234 npm run seed:demo');
    process.exit(1);
  }

  // 4. Database Connection Check
  const dbStatus = await checkConnection();
  if (!dbStatus.connected || !pool) {
    console.error(`[WebJaws Seed] ERROR: PostgreSQL is unavailable: ${dbStatus.error || 'Pool not initialized'}`);
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 5. Ensure role 'Superadmin' exists in roles table
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

    // 6. Duplicate Check - Do not overwrite existing accounts
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

    // 9. Audit log entry
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
    process.exit(0);
  }
}

seedDemoAdmin();
