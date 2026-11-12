import { Request, Response, NextFunction } from 'express';
import { webJawsStore, StaffUser } from '../db/store.js';

export interface AuthenticatedRequest extends Request {
  user?: StaffUser;
  sessionToken?: string;
}
export const SESSION_COOKIE_NAME = 'webjaws_session';

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

// Session credentials are accepted only from the HttpOnly cookie.
export function extractSessionToken(req: Request): string | null {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractSessionToken(req);
  if (!token) return res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' });
  const session = webJawsStore.findSession(token);
  if (!session) return res.status(401).json({ success: false, error: 'Session invalid or expired', code: 'SESSION_EXPIRED' });
  const user = webJawsStore.users.find((item) => item.id === session.user_id);
  if (!user) return res.status(401).json({ success: false, error: 'Session user not found', code: 'USER_NOT_FOUND' });
  if (!user.is_active) {
    webJawsStore.revokeSession(token);
    return res.status(403).json({ success: false, error: 'Account is inactive', code: 'ACCOUNT_INACTIVE' });
  }
  req.user = user;
  req.sessionToken = token;
  next();
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
