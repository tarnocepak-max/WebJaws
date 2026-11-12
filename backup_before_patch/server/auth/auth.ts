import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { webJawsStore, StaffUser } from '../db/store.js';

export interface AuthenticatedRequest extends Request {
  user?: StaffUser;
  sessionToken?: string;
}

export const SESSION_COOKIE_NAME = 'webjaws_session';

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export function extractSessionToken(req: Request): string | null {
  // 1. From HttpOnly Cookie
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }

  // 2. From Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 3. From custom x-session-token header
  const customHeader = req.headers['x-session-token'];
  if (typeof customHeader === 'string') {
    return customHeader.trim();
  }

  return null;
}

// Authentication middleware
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractSessionToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: No active session token provided',
      code: 'AUTH_REQUIRED',
    });
  }

  const session = webJawsStore.findSession(token);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Session is invalid or has expired',
      code: 'SESSION_EXPIRED',
    });
  }

  const user = webJawsStore.users.find((u) => u.id === session.user_id);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'User associated with session not found',
      code: 'USER_NOT_FOUND',
    });
  }

  if (!user.is_active) {
    webJawsStore.revokeSession(token);
    return res.status(403).json({
      success: false,
      error: 'Account has been deactivated by Superadmin. Contact support.',
      code: 'ACCOUNT_DEACTIVATED',
    });
  }

  req.user = user;
  req.sessionToken = token;
  next();
}

// Role Authorization middleware
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (req.user.role === 'Superadmin') {
      return next(); // Superadmin has universal permission
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access Denied: Role '${req.user.role}' lacks permission for this resource. Required: [${allowedRoles.join(', ')}]`,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    next();
  };
}

// Strict Leader Contractor & Area Access Control
export function enforceLeaderAreaBoundary(user: StaffUser, contractorName?: string, area?: string): boolean {
  if (user.role === 'Superadmin' || user.role === 'Agent Dispatch' || user.role === 'Monitoring Data') {
    return true;
  }
  if (user.role === 'Leader') {
    if (user.contractor_name && contractorName && user.contractor_name.toLowerCase() !== contractorName.toLowerCase()) {
      return false;
    }
    if (user.area && area && user.area.toLowerCase() !== area.toLowerCase()) {
      return false;
    }
    return true;
  }
  return false;
}
