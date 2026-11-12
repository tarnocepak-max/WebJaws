import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool, checkConnection } from '../db/db.js';

export const setupRouter = Router();

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

// GET /api/setup/status - Public status reveals whether initial setup is available from PostgreSQL
setupRouter.get('/status', async (_req, res) => {
  const dbStatus = await checkConnection();
  if (!dbStatus.connected || !pool) {
    return res.status(503).json({
      success: false,
      available: false,
      error: 'Database is unavailable. Configure DATABASE_URL before setting up Superadmin.',
      code: 'DATABASE_UNAVAILABLE',
    });
  }

  try {
    const result = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM staff_users WHERE role = 'Superadmin') AS has_superadmin"
    );
    const hasSuperadmin = Boolean(result.rows[0]?.has_superadmin);
    return res.json({
      success: true,
      available: !hasSuperadmin,
    });
  } catch (err: any) {
    console.error('Setup status error:', err?.message || 'Unknown database error');
    return res.status(503).json({
      success: false,
      available: false,
      error: 'Unable to check setup status from database',
      code: 'DATABASE_ERROR',
    });
  }
});

// POST /api/setup/superadmin - One-time setup. Requires WEBJAWS_SETUP_TOKEN configured on server
setupRouter.post('/superadmin', async (req, res) => {
  const setupToken = process.env.WEBJAWS_SETUP_TOKEN || '';
  const suppliedToken = typeof req.body?.setupToken === 'string' ? req.body.setupToken : '';

  if (!setupToken || !suppliedToken || !safeEqual(setupToken, suppliedToken)) {
    return res.status(403).json({
      success: false,
      error: 'Setup authorization failed. Invalid or unconfigured setup token.',
    });
  }

  const dbStatus = await checkConnection();
  if (!dbStatus.connected || !pool) {
    return res.status(503).json({
      success: false,
      error: 'Database is unavailable',
      code: 'DATABASE_UNAVAILABLE',
    });
  }

  const { fullName, username, email, password } = req.body || {};
  if (![fullName, username, email, password].every((v) => typeof v === 'string' && v.trim())) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }

  const cleanFullName = String(fullName).trim();
  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();

  if (cleanFullName.length < 2 || cleanFullName.length > 128) {
    return res.status(400).json({ success: false, error: 'Full name must be 2–128 characters' });
  }

  if (cleanUsername.length < 3 || cleanUsername.length > 64 || !/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
    return res.status(400).json({
      success: false,
      error: 'Username must be 3–64 characters and contain only letters, numbers, dots, dashes, or underscores',
    });
  }

  if (cleanEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
  }

  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Password must be 12–128 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Advisory transaction lock to prevent concurrent setup requests from creating duplicate Superadmins
    await client.query("SELECT pg_advisory_xact_lock(hashtext('webjaws_first_superadmin_setup'))");

    // Strictly check if a Superadmin already exists inside the transaction lock
    const existingSuperadmin = await client.query(
      "SELECT 1 FROM staff_users WHERE role = 'Superadmin' LIMIT 1"
    );
    if (existingSuperadmin.rowCount && existingSuperadmin.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'A Superadmin already exists. Initial setup is closed permanently.',
      });
    }

    // Check unique username and email in staff_users
    const existingUser = await client.query(
      'SELECT id FROM staff_users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1',
      [cleanUsername, cleanEmail]
    );
    if (existingUser.rowCount && existingUser.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'A user with this username or email already exists in the system',
      });
    }

    // Ensure role Superadmin exists in roles table
    await client.query(
      `INSERT INTO roles (id, name, description, is_system)
       VALUES ('Superadmin', 'Superadmin', 'Initial WebJaws system administrator', TRUE)
       ON CONFLICT (id) DO NOTHING`
    );

    // Hash password with bcrypt cost 12
    const passwordHash = await bcrypt.hash(password, 12);

    const inserted = await client.query(
      `INSERT INTO staff_users (username, email, password_hash, full_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Superadmin', TRUE, NOW(), NOW())
       RETURNING id, username, email, full_name, role, is_active, created_at, updated_at`,
      [cleanUsername, cleanEmail, passwordHash, cleanFullName]
    );
    const user = inserted.rows[0];

    // Audit log in PostgreSQL audit_logs (never logging sensitive data or token)
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, role, activity, module, record_id, diff_data, ip_address, user_agent, created_at)
       VALUES ($1, $2, 'Superadmin', 'INITIAL_SUPERADMIN_CREATED', 'Authentication', $3, $4, $5, $6, NOW())`,
      [
        user.id,
        user.full_name,
        user.id,
        JSON.stringify({ username: user.username, email: user.email, role: user.role }),
        req.ip || '127.0.0.1',
        (req.headers['user-agent'] as string) || null,
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Initial Superadmin created successfully. You can now sign in.',
      user,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') {
      return res.status(409).json({ success: false, error: 'Username or email is already registered' });
    }
    console.error('Initial Superadmin setup failed:', error?.message || 'Unknown error');
    return res.status(500).json({ success: false, error: 'Unable to create initial Superadmin due to database failure' });
  } finally {
    client.release();
  }
});
