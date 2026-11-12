import { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Validates Origin and Referer headers for state-changing HTTP methods
 * (POST, PUT, PATCH, DELETE) to protect against Cross-Site Request Forgery (CSRF).
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.headers['origin'] as string | undefined;
  const referer = req.headers['referer'] as string | undefined;
  const host = req.get('host');

  // Helper to extract hostname & port
  const extractHost = (urlStr: string): string | null => {
    try {
      const parsed = new URL(urlStr);
      return parsed.host;
    } catch {
      return null;
    }
  };

  // If Origin is provided, it must match current request Host
  if (origin) {
    const originHost = extractHost(origin);
    if (!originHost) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Invalid Origin header',
        code: 'CSRF_BLOCKED',
      });
    }

    // Check host match (allowing local IPv4/IPv6 loopback aliases)
    const isHostMatch =
      originHost === host ||
      (host?.startsWith('localhost') && originHost.startsWith('127.0.0.1')) ||
      (host?.startsWith('127.0.0.1') && originHost.startsWith('localhost'));

    if (!isHostMatch) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cross-Site Request Forgery (CSRF) detected from origin ' + origin,
        code: 'CSRF_BLOCKED',
      });
    }

    return next();
  }

  // If Origin is absent, check Referer
  if (referer) {
    const refererHost = extractHost(referer);
    if (!refererHost) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Invalid Referer header',
        code: 'CSRF_BLOCKED',
      });
    }

    const isRefererMatch =
      refererHost === host ||
      (host?.startsWith('localhost') && refererHost.startsWith('127.0.0.1')) ||
      (host?.startsWith('127.0.0.1') && refererHost.startsWith('localhost'));

    if (!isRefererMatch) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cross-Site Request Forgery (CSRF) detected from referer ' + referer,
        code: 'CSRF_BLOCKED',
      });
    }

    return next();
  }

  // If neither Origin nor Referer is provided:
  // Legitimate same-origin browser AJAX or CLI script
  return next();
}
