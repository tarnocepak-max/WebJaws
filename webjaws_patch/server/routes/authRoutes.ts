import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { webJawsStore } from '../db/store.js';
import {
  AuthenticatedRequest,
  SESSION_COOKIE_NAME,
  getClientIp,
  requireAuth,
  extractSessionToken,
} from '../auth/auth.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Unknown Browser';

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username/Email and password are required',
    });
  }

  // Rate Limiting check
  const rateLimitStatus = webJawsStore.isRateLimited(identifier, ip);
  if (rateLimitStatus.limited) {
    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${rateLimitStatus.retryAfterSeconds} seconds.`,
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
      code: 'RATE_LIMITED',
    });
  }

  // Find user by username or email (case-insensitive)
  const cleanId = identifier.trim().toLowerCase();
  const user = webJawsStore.users.find(
    (u) => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
  );

  if (!user) {
    webJawsStore.recordLoginAttempt(identifier, ip, false);
    return res.status(401).json({
      success: false,
      error: 'Invalid username/email or password',
      code: 'INVALID_CREDENTIALS',
    });
  }

  if (!user.is_active) {
    webJawsStore.recordLoginAttempt(identifier, ip, false);
    return res.status(403).json({
      success: false,
      error: 'This account has been disabled. Please contact the Superadmin.',
      code: 'ACCOUNT_INACTIVE',
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    webJawsStore.recordLoginAttempt(identifier, ip, false);
    return res.status(401).json({
      success: false,
      error: 'Invalid username/email or password',
      code: 'INVALID_CREDENTIALS',
    });
  }

  // Record successful login
  webJawsStore.recordLoginAttempt(identifier, ip, true);
  user.last_login_at = new Date().toISOString();

  // Create Server-side session
  const durationHours = Number(process.env.SESSION_DURATION_HOURS || 24);
  const safeDurationHours = Number.isFinite(durationHours) && durationHours >= 1 && durationHours <= 720 ? durationHours : 24;
  const session = webJawsStore.createSession(user.id, ip, userAgent, safeDurationHours);

  // Set secure HttpOnly cookie
  res.cookie(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: safeDurationHours * 3600 * 1000,
  });

  // Audit Log
  webJawsStore.addAuditLog({
    user_id: user.id,
    user_name: user.full_name,
    role: user.role,
    activity: 'LOGIN_SUCCESS',
    module: 'Authentication',
    ip_address: ip,
  });

  const { password_hash, ...safeUser } = user;

  return res.json({
    success: true,
    message: 'Login successful',
    user: safeUser,
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (req: AuthenticatedRequest, res: Response) => {
  const token = extractSessionToken(req);
  const ip = getClientIp(req);

  if (token) {
    const session = webJawsStore.findSession(token);
    if (session) {
      const user = webJawsStore.users.find((u) => u.id === session.user_id);
      if (user) {
        webJawsStore.addAuditLog({
          user_id: user.id,
          user_name: user.full_name,
          role: user.role,
          activity: 'LOGOUT',
          module: 'Authentication',
          ip_address: ip,
        });
      }
    }
    webJawsStore.revokeSession(token);
  }

  res.clearCookie(SESSION_COOKIE_NAME);

  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// GET /api/auth/me
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

// POST /api/auth/change-password
authRouter.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Current and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long' });
  }

  const user = req.user!;
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    return res.status(400).json({ success: false, error: 'Incorrect current password' });
  }

  const salt = await bcrypt.genSalt(10);
  user.password_hash = await bcrypt.hash(newPassword, salt);
  user.updated_at = new Date().toISOString();

  webJawsStore.addAuditLog({
    user_id: user.id,
    user_name: user.full_name,
    role: user.role,
    activity: 'CHANGE_PASSWORD',
    module: 'Authentication',
    ip_address: getClientIp(req),
  });

  return res.json({
    success: true,
    message: 'Password changed successfully',
  });
});
