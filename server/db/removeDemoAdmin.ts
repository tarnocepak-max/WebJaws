import dotenv from 'dotenv';
import { pool, checkConnection } from './db.js';

dotenv.config();

async function removeDemoAdmin() {
  console.log('[WebJaws Cleanup] Starting safe removal of Demo Superadmin account...');

  const dbStatus = await checkConnection();
  if (!dbStatus.connected || !pool) {
    console.error(`[WebJaws Cleanup] ERROR: PostgreSQL is unavailable: ${dbStatus.error || 'Pool not initialized'}`);
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const DEMO_USERNAME = 'admin';
    const DEMO_EMAIL = 'adminjaws@mora.jaws';

    // 1. Locate the demo account precisely by both username AND email
    const findRes = await client.query(
      `SELECT id, username, email, full_name, role 
       FROM staff_users 
       WHERE LOWER(username) = LOWER($1) AND LOWER(email) = LOWER($2)
       LIMIT 1`,
      [DEMO_USERNAME, DEMO_EMAIL]
    );

    if (findRes.rowCount === 0) {
      console.log(`[WebJaws Cleanup] Notice: Demo account ('${DEMO_USERNAME}' / '${DEMO_EMAIL}') not found in database. No action needed.`);
      await client.query('COMMIT');
      process.exit(0);
    }

    const demoUser = findRes.rows[0];

    // 2. Remove all active sessions for the demo user
    const deleteSessionsRes = await client.query(
      'DELETE FROM auth_sessions WHERE user_id = $1',
      [demoUser.id]
    );
    console.log(`[WebJaws Cleanup] Revoked ${deleteSessionsRes.rowCount} active session(s) belonging to demo account.`);

    // 3. Remove the demo user from staff_users
    await client.query(
      'DELETE FROM staff_users WHERE id = $1',
      [demoUser.id]
    );
    console.log(`[WebJaws Cleanup] Deleted demo user '${demoUser.username}' (ID: ${demoUser.id}) from staff_users.`);

    // 4. Audit log entry
    await client.query(
      `INSERT INTO audit_logs (
        user_name, role, activity, module, record_id, ip_address, created_at
      ) VALUES ($1, 'Superadmin', 'DEMO_SUPERADMIN_REMOVED', 'Authentication', $2, '127.0.0.1', NOW())`,
      [demoUser.full_name, demoUser.username]
    );

    // Note: roles table is intentionally left intact as required
    await client.query('COMMIT');

    console.log('[WebJaws Cleanup] SUCCESS: Demo Superadmin account and associated sessions removed cleanly.');
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error(`[WebJaws Cleanup] ERROR during cleanup transaction: ${error.message}`);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

removeDemoAdmin();
