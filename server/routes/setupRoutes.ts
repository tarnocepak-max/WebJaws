import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db/db.js';

export const setupRouter = Router();

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

// Public status reveals only whether initial setup is available.
setupRouter.get('/status', async (_req, res) => {
  if (!pool) return res.status(503).json({ success: false, available: false, error: 'Database is unavailable' });
  try {
    const result = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM staff_users WHERE role = 'Superadmin') AS has_superadmin"
    );
    const hasSuperadmin = Boolean(result.rows[0]?.has_superadmin);
    return res.json({ success: true, available: !hasSuperadmin });
  } catch {
    return res.status(503).json({ success: false, available: false, error: 'Unable to check setup status' });
  }
});

// One-time setup. Requires WEBJAWS_SETUP_TOKEN configured only on the server.
setupRouter.post('/superadmin', async (req, res) => {
  const setupToken = process.env.WEBJAWS_SETUP_TOKEN || '';
  const suppliedToken = typeof req.body?.setupToken === 'string' ? req.body.setupToken : '';
  if (!setupToken || !suppliedToken || !safeEqual(setupToken, suppliedToken)) {
    return res.status(403).json({ success: false, error: 'Setup authorization failed' });
  }
  if (!pool) return res.status(503).json({ success: false, error: 'Database is unavailable' });

  const { fullName, username, email, password } = req.body || {};
  if (![fullName, username, email, password].every((v) => typeof v === 'string' && v.trim())) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }
  if (fullName.trim().length > 128 || username.trim().length < 3 || username.trim().length > 64 ||
      email.trim().length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Please check name, username, and email format' });
  }
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Password must be 12–128 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('webjaws_first_superadmin_setup'))");
    const existing = await client.query("SELECT 1 FROM staff_users WHERE role = 'Superadmin' LIMIT 1");
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'A Superadmin already exists. Initial setup is closed.' });
    }

    await client.query(
      `INSERT INTO roles (id, name, description, is_system)
       VALUES ('Superadmin', 'Superadmin', 'Initial WebJaws system administrator', TRUE)
       ON CONFLICT (id) DO NOTHING`
    );

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await client.query(
      `INSERT INTO staff_users (username, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, 'Superadmin', TRUE)
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [username.trim(), email.trim().toLowerCase(), passwordHash, fullName.trim()]
    );
    const user = inserted.rows[0];

    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, role, activity, module, record_id, ip_address, user_agent)
       VALUES ($1, $2, 'Superadmin', 'INITIAL_SUPERADMIN_CREATED', 'Authentication', $3, $4, $5)`,
      [user.id, user.full_name, user.username, req.ip, req.headers['user-agent'] || null]
    );
    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'Initial Superadmin created. You can now sign in.', user });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') return res.status(409).json({ success: false, error: 'Username or email is already registered' });
    console.error('Initial Superadmin setup failed:', error?.message || 'Unknown error');
    return res.status(500).json({ success: false, error: 'Unable to create initial Superadmin' });
  } finally {
    client.release();
  }
});
