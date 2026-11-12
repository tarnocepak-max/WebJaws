import dotenv from 'dotenv';
import { pool, checkConnection } from './db.js';

dotenv.config({ override: true });

export async function runRemoveDemoAdmin(): Promise<{ success: boolean; message: string; deletedSessions: number; deletedUser: boolean }> {
  console.log('[WebJaws Cleanup] Starting safe removal of Demo Superadmin account...');

  const dbStatus = await checkConnection();
  if (!dbStatus.connected || !pool) {
    const msg = `ERROR: PostgreSQL is unavailable: ${dbStatus.error || 'Pool not initialized'}`;
    console.error(`[WebJaws Cleanup] ${msg}`);
    return { success: false, message: msg, deletedSessions: 0, deletedUser: false };
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const DEMO_USERNAME = 'admin';
    const DEMO_EMAIL = 'adminjaws@mora.jaws';

    // 1. Locate the demo account precisely by BOTH username AND email
    const findRes = await client.query(
      `SELECT id, username, email, full_name, role 
       FROM staff_users 
       WHERE LOWER(username) = LOWER($1) AND LOWER(email) = LOWER($2)
       LIMIT 1`,
      [DEMO_USERNAME, DEMO_EMAIL]
    );

    if (findRes.rowCount === 0) {
      const msg = `Notice: Demo account ('${DEMO_USERNAME}' / '${DEMO_EMAIL}') not found in database. No action needed.`;
      console.log(`[WebJaws Cleanup] ${msg}`);
      await client.query('COMMIT');
      return { success: true, message: msg, deletedSessions: 0, deletedUser: false };
    }

    const demoUser = findRes.rows[0];

    // 2. Remove all active sessions for the demo user first
    const deleteSessionsRes = await client.query(
      'DELETE FROM auth_sessions WHERE user_id = $1',
      [demoUser.id]
    );
    const deletedSessions = deleteSessionsRes.rowCount || 0;
    console.log(`[WebJaws Cleanup] Revoked ${deletedSessions} active session(s) belonging to demo account.`);

    // 3. Remove the demo user strictly from staff_users
    await client.query(
      'DELETE FROM staff_users WHERE id = $1',
      [demoUser.id]
    );
    console.log(`[WebJaws Cleanup] Deleted demo user '${demoUser.username}' (ID: ${demoUser.id}) from staff_users.`);

    // 4. Audit log entry (sanitized, historical logs preserved)
    await client.query(
      `INSERT INTO audit_logs (
        user_name, role, activity, module, record_id, ip_address, created_at
      ) VALUES ($1, 'Superadmin', 'DEMO_SUPERADMIN_REMOVED', 'Authentication', $2, '127.0.0.1', NOW())`,
      [demoUser.full_name, demoUser.username]
    );

    // Note: 'Superadmin' in roles table is strictly preserved as required.
    // Note: Historical audit logs are strictly preserved as required.
    await client.query('COMMIT');

    console.log('[WebJaws Cleanup] SUCCESS: Demo Superadmin account and associated sessions removed cleanly.');
    return {
      success: true,
      message: 'Demo Superadmin account and associated sessions removed cleanly',
      deletedSessions,
      deletedUser: true,
    };
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    const msg = `ERROR during cleanup transaction: ${error.message}`;
    console.error(`[WebJaws Cleanup] ${msg}`);
    return { success: false, message: msg, deletedSessions: 0, deletedUser: false };
  } finally {
    if (client) client.release();
  }
}

// When executed directly from CLI: npm run remove:demo
async function main() {
  let exitCode = 0;
  try {
    const result = await runRemoveDemoAdmin();
    if (!result.success) {
      exitCode = 1;
    }
  } catch (err: any) {
    console.error('[WebJaws Cleanup] Unexpected fatal error:', err.message);
    exitCode = 1;
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
    process.exitCode = exitCode;
  }
}

main();
