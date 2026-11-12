import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query, checkConnection } from '../db/db.js';
import { StaffUser, AuthSession, webJawsStore } from '../db/store.js';

export interface AuthenticatedRequest extends Request {
  user?: StaffUser;
  sessionToken?: string;
}

export const SESSION_COOKIE_NAME = 'webjaws_session';

/**
 * Deterministic cryptographic one-way SHA-256 hash for session tokens.
 * Plaintext token is only possessed by the client browser cookie,
 * while PostgreSQL strictly stores the token_hash.
 */
export function hashSessionToken(token: string): string {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Standard secure cookie options for session cookie
 */
export function getSessionCookieOptions(durationHours = 24) {
  const safeHours = Number.isFinite(durationHours) && durationHours >= 1 && durationHours <= 720 ? durationHours : 24;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: safeHours * 3600 * 1000,
    path: '/',
  };
}

// Session credentials are accepted only from the HttpOnly cookie.
export function extractSessionToken(req: Request): string | null {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/**
 * Creates a cryptographically secure random session.
 * Stores only token_hash in PostgreSQL auth_sessions.
 * Returns AuthSession containing the raw plaintext token for the Set-Cookie header.
 */
export async function createPostgresSession(
  userId: string,
  ip: string,
  userAgent: string,
  durationHours = 24
): Promise<AuthSession> {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const safeDuration = Number.isFinite(durationHours) && durationHours >= 1 && durationHours <= 720 ? durationHours : 24;
  const expiresAt = new Date(Date.now() + safeDuration * 3600 * 1000);

  const dbStatus = await checkConnection();
  if (dbStatus.connected) {
    const res = await query(
      `INSERT INTO auth_sessions (token_hash, user_id, ip_address, user_agent, expires_at, last_active_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, token_hash, user_id, ip_address, user_agent, expires_at, last_active_at, created_at`,
      [tokenHash, userId, ip, userAgent, expiresAt.toISOString()]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      token: rawToken, // Client-only raw token
      user_id: row.user_id,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      expires_at: row.expires_at,
      last_active_at: row.last_active_at,
      created_at: row.created_at,
    };
  }

  // Fallback to in-memory store
  return webJawsStore.createSession(userId, ip, userAgent, safeDuration);
}

// Revoke a specific session from PostgreSQL using token hash
export async function revokePostgresSession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);

  try {
    await query('DELETE FROM auth_sessions WHERE token_hash = $1 OR token = $2', [tokenHash, rawToken]);
  } catch (err: any) {
    console.error('Error revoking session from PostgreSQL:', err.message);
  }

  // Also clean up in-memory if present
  webJawsStore.revokeSession(rawToken);
}

// Revoke all sessions belonging to a specific user (e.g. upon password reset or account deactivation)
export async function revokeAllUserSessions(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
  } catch (err: any) {
    console.error('Error revoking all user sessions from PostgreSQL:', err.message);
  }

  webJawsStore.revokeUserSessions(userId);
}

// Record login attempt in PostgreSQL login_attempts
export async function recordPostgresLoginAttempt(identifier: string, ip: string, success: boolean): Promise<void> {
  try {
    await query(
      `INSERT INTO login_attempts (identifier, ip_address, success, attempt_time)
       VALUES ($1, $2, $3, NOW())`,
      [identifier.toLowerCase().trim(), ip, success]
    );
  } catch (err: any) {
    console.error('Error recording login attempt in PostgreSQL:', err.message);
  }

  webJawsStore.recordLoginAttempt(identifier, ip, success);
}

// Check brute-force rate limit from PostgreSQL login_attempts (max 5 failed attempts in 15 mins)
export async function checkPostgresRateLimit(
  identifier: string,
  ip: string
): Promise<{ limited: boolean; retryAfterSeconds?: number }> {
  try {
    const res = await query(
      `SELECT COUNT(*)::int AS failed_count, MIN(attempt_time) AS oldest_attempt
       FROM login_attempts
       WHERE success = FALSE
         AND (LOWER(identifier) = LOWER($1) OR ip_address = $2)
         AND attempt_time > NOW() - INTERVAL '15 minutes'`,
      [identifier.toLowerCase().trim(), ip]
    );

    const failedCount = res.rows[0]?.failed_count || 0;
    if (failedCount >= 5) {
      const oldest = res.rows[0]?.oldest_attempt ? new Date(res.rows[0].oldest_attempt).getTime() : Date.now();
      const unlockTime = oldest + 15 * 60 * 1000;
      const waitSec = Math.max(1, Math.ceil((unlockTime - Date.now()) / 1000));
      return { limited: true, retryAfterSeconds: waitSec };
    }

    return { limited: false };
  } catch {
    return webJawsStore.isRateLimited(identifier, ip);
  }
}

// Record audit log entry into PostgreSQL audit_logs
export async function addPostgresAuditLog(entry: {
  user_id?: string;
  user_name: string;
  role?: string;
  activity: string;
  module: string;
  record_id?: string;
  diff_data?: any;
  ip_address: string;
  user_agent?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, user_name, role, activity, module, record_id, diff_data, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        entry.user_id || null,
        entry.user_name,
        entry.role || null,
        entry.activity,
        entry.module,
        entry.record_id || null,
        entry.diff_data ? JSON.stringify(entry.diff_data) : null,
        entry.ip_address,
        entry.user_agent || null,
      ]
    );
  } catch (err: any) {
    console.error('Error saving audit log in PostgreSQL:', err.message);
  }

  webJawsStore.addAuditLog(entry);
}

// PostgreSQL-authoritative authentication middleware with constant-time token hash verification
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractSessionToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }

  const tokenHash = hashSessionToken(token);

  try {
    const sessionRes = await query(
      `SELECT 
        s.id AS session_id,
        s.token_hash,
        s.token,
        s.user_id,
        s.expires_at,
        s.last_active_at,
        u.id AS user_id,
        u.username,
        u.email,
        u.full_name,
        u.role,
        u.contractor_name,
        u.area,
        u.phone,
        u.avatar_url,
        u.is_active,
        u.last_login_at,
        u.created_at,
        u.updated_at
       FROM auth_sessions s
       JOIN staff_users u ON s.user_id = u.id
       WHERE s.token_hash = $1 OR s.token = $2`,
      [tokenHash, token]
    );

    if (sessionRes.rowCount === 0) {
      res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
      return res.status(401).json({ success: false, error: 'Session invalid or expired', code: 'SESSION_EXPIRED' });
    }

    const row = sessionRes.rows[0];

    // Constant-time hash verification if token_hash is stored
    if (row.token_hash) {
      const computedBuf = Buffer.from(tokenHash, 'hex');
      const storedBuf = Buffer.from(row.token_hash, 'hex');
      if (computedBuf.length !== storedBuf.length || !crypto.timingSafeEqual(computedBuf, storedBuf)) {
        res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
        return res.status(401).json({ success: false, error: 'Session verification failed', code: 'SESSION_EXPIRED' });
      }
    }

    // Check expiration
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await revokePostgresSession(token);
      res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
      return res.status(401).json({ success: false, error: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    // Check active status
    if (!row.is_active) {
      await revokePostgresSession(token);
      res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
      return res.status(403).json({ success: false, error: 'Account is inactive', code: 'ACCOUNT_INACTIVE' });
    }

    // Async update last_active_at without blocking the request
    query('UPDATE auth_sessions SET last_active_at = NOW() WHERE token_hash = $1 OR token = $2', [tokenHash, token]).catch(() => {});

    const safeUser: StaffUser = {
      id: row.user_id,
      username: row.username,
      email: row.email,
      password_hash: '', // Never expose password_hash
      full_name: row.full_name,
      role: row.role,
      contractor_name: row.contractor_name || undefined,
      area: row.area || undefined,
      phone: row.phone || undefined,
      avatar_url: row.avatar_url || undefined,
      is_active: row.is_active,
      last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    };

    req.user = safeUser;
    req.sessionToken = token;
    return next();
  } catch (error: any) {
    console.error('requireAuth database error:', error.message);
    return res.status(503).json({
      success: false,
      error: 'Authentication service temporarily unavailable',
      code: 'DATABASE_UNAVAILABLE',
    });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (req.user.role === 'Superadmin' || allowedRoles.includes(req.user.role)) return next();
    return res.status(403).json({ success: false, error: 'Insufficient role permissions', code: 'INSUFFICIENT_PERMISSIONS' });
  };
}

export function enforceLeaderAreaBoundary(user: StaffUser, contractorName?: string, area?: string): boolean {
  if (user.role === 'Superadmin' || user.role === 'Agent Dispatch' || user.role === 'Monitoring Data') return true;
  if (user.role !== 'Leader') return false;
  // Fail closed: a Leader without assigned scope cannot access contractor/area data.
  if (!user.contractor_name || !user.area || !contractorName || !area) return false;
  return user.contractor_name.trim().toLowerCase() === contractorName.trim().toLowerCase()
    && user.area.trim().toLowerCase() === area.trim().toLowerCase();
}
