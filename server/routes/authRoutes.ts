import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/db.js';
import { webJawsStore } from '../db/store.js';
import {
  AuthenticatedRequest,
  SESSION_COOKIE_NAME,
  getClientIp,
  requireAuth,
  extractSessionToken,
  createPostgresSession,
  revokePostgresSession,
  revokeAllUserSessions,
  recordPostgresLoginAttempt,
  checkPostgresRateLimit,
  addPostgresAuditLog,
  hashSessionToken,
  getSessionCookieOptions,
  getClearCookieOptions,
} from '../auth/auth.js';

export const authRouter = Router();

// POST /api/auth/login - Authenticate strictly with PostgreSQL staff_users & issue PostgreSQL auth_session
authRouter.post('/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  const ip = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || 'Unknown Browser';

  if (!identifier || typeof identifier !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Username/Email and password are required',
    });
  }

  const cleanIdentifier = identifier.trim().toLowerCase();

  // Rate Limiting check against PostgreSQL login_attempts (fail closed if DB is unavailable)
  try {
    const rateLimitStatus = await checkPostgresRateLimit(cleanIdentifier, ip);
    if (rateLimitStatus.limited) {
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${rateLimitStatus.retryAfterSeconds} seconds.`,
        retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
        code: 'RATE_LIMITED',
      });
    }
  } catch (err: any) {
    console.error('Rate limit error:', err.message);
    return res.status(503).json({
      success: false,
      error: 'Authentication service temporarily unavailable',
      code: 'DATABASE_UNAVAILABLE',
    });
  }

  try {
    // Find staff user by username or email in PostgreSQL
    const userRes = await query(
      `SELECT 
        id, username, email, password_hash, full_name, role, contractor_name, area, phone, avatar_url,
        is_active, last_login_at, created_at, updated_at
       FROM staff_users
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
       LIMIT 1`,
      [cleanIdentifier]
    );

    if (userRes.rowCount === 0) {
      await recordPostgresLoginAttempt(cleanIdentifier, ip, false).catch(() => {});
      return res.status(401).json({
        success: false,
        error: 'Invalid username/email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const user = userRes.rows[0];

    // Check account active status
    if (!user.is_active) {
      await recordPostgresLoginAttempt(cleanIdentifier, ip, false).catch(() => {});
      return res.status(403).json({
        success: false,
        error: 'This account has been disabled. Please contact the Superadmin.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // Verify bcrypt password hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await recordPostgresLoginAttempt(cleanIdentifier, ip, false).catch(() => {});
      return res.status(401).json({
        success: false,
        error: 'Invalid username/email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Record successful login attempt
    await recordPostgresLoginAttempt(cleanIdentifier, ip, true).catch(() => {});

    // Update last_login_at and updated_at in PostgreSQL
    await query(
      `UPDATE staff_users 
       SET last_login_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [user.id]
    );

    // Create session in PostgreSQL auth_sessions (strictly token_hash)
    const durationHours = Number(process.env.SESSION_DURATION_HOURS || 24);
    const safeDurationHours = Number.isFinite(durationHours) && durationHours >= 1 && durationHours <= 720 ? durationHours : 24;
    const session = await createPostgresSession(user.id, ip, userAgent, safeDurationHours);

    // Set secure HttpOnly cookie
    res.cookie(SESSION_COOKIE_NAME, session.token, getSessionCookieOptions(safeDurationHours));

    // Write audit log in PostgreSQL audit_logs
    await addPostgresAuditLog({
      user_id: user.id,
      user_name: user.full_name,
      role: user.role,
      activity: 'LOGIN_SUCCESS',
      module: 'Authentication',
      ip_address: ip,
      user_agent: userAgent,
    }).catch((err) => console.error('Failed to write login audit log:', err.message));

    // Strip password_hash before returning to client
    const { password_hash, ...safeUser } = user;

    return res.json({
      success: true,
      message: 'Login successful',
      user: safeUser,
    });
  } catch (error: any) {
    console.error('Login error:', error.message);
    return res.status(503).json({
      success: false,
      error: 'Authentication service temporarily unavailable',
      code: 'DATABASE_UNAVAILABLE',
    });
  }
});

// POST /api/auth/logout - Revoke current session from PostgreSQL
authRouter.post('/logout', async (req: AuthenticatedRequest, res: Response) => {
  const token = extractSessionToken(req);
  const ip = getClientIp(req);

  if (token) {
    try {
      const tokenHash = hashSessionToken(token);
      // Find session to log user info before deleting
      const sessionRes = await query(
        `SELECT s.user_id, u.full_name, u.role
         FROM auth_sessions s
         LEFT JOIN staff_users u ON s.user_id = u.id
         WHERE s.token_hash = $1`,
        [tokenHash]
      );
      if (sessionRes.rowCount && sessionRes.rows[0]) {
        const row = sessionRes.rows[0];
        await addPostgresAuditLog({
          user_id: row.user_id,
          user_name: row.full_name || 'Staff User',
          role: row.role || 'User',
          activity: 'LOGOUT',
          module: 'Authentication',
          ip_address: ip,
          user_agent: (req.headers['user-agent'] as string) || undefined,
        }).catch(() => {});
      }
      await revokePostgresSession(token);
    } catch (err: any) {
      console.error('Logout error:', err.message);
      res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
      return res.status(500).json({
        success: false,
        error: 'Failed to revoke session from database',
        code: 'LOGOUT_FAILED',
      });
    }
  }

  res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());

  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// POST /api/auth/logout-all - Revoke all active sessions for current user in PostgreSQL
authRouter.post('/logout-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const ip = getClientIp(req);

  try {
    await revokeAllUserSessions(user.id);
    await addPostgresAuditLog({
      user_id: user.id,
      user_name: user.full_name,
      role: user.role,
      activity: 'LOGOUT_ALL_DEVICES',
      module: 'Authentication',
      ip_address: ip,
      user_agent: (req.headers['user-agent'] as string) || undefined,
    }).catch(() => {});
  } catch (err: any) {
    console.error('Logout-all error:', err.message);
    res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke all sessions from database',
      code: 'LOGOUT_ALL_FAILED',
    });
  }

  res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());

  return res.json({
    success: true,
    message: 'Logged out from all devices successfully',
  });
});

// GET /api/auth/me - Verify current PostgreSQL session and fetch user profile
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'User not found' });
  }

  const { password_hash, ...safeUser } = req.user;

  return res.json({
    success: true,
    user: safeUser,
    appConfig: webJawsStore.activeConfig,
  });
});

// POST /api/auth/change-password - Change user password with PostgreSQL persistence and session revocation
authRouter.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};
  const ip = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || 'Unknown Browser';

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Current and new password are required' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long' });
  }

  const user = req.user!;

  try {
    // Retrieve actual password hash from staff_users
    const userRes = await query('SELECT password_hash FROM staff_users WHERE id = $1', [user.id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const currentHash = userRes.rows[0].password_hash;
    const isValid = await bcrypt.compare(currentPassword, currentHash);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await query('UPDATE staff_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, user.id]);

    // Consistent session revocation policy: Revoke all existing sessions and issue a fresh one
    await revokeAllUserSessions(user.id);
    const durationHours = Number(process.env.SESSION_DURATION_HOURS || 24);
    const safeDurationHours = Number.isFinite(durationHours) && durationHours >= 1 && durationHours <= 720 ? durationHours : 24;
    const freshSession = await createPostgresSession(user.id, ip, userAgent, safeDurationHours);
    res.cookie(SESSION_COOKIE_NAME, freshSession.token, getSessionCookieOptions(safeDurationHours));

    await addPostgresAuditLog({
      user_id: user.id,
      user_name: user.full_name,
      role: user.role,
      activity: 'CHANGE_PASSWORD',
      module: 'Authentication',
      ip_address: ip,
      user_agent: userAgent,
    });

    return res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    console.error('Change password error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});
