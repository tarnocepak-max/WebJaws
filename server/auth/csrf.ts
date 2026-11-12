import { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Normalizes a URL string to its canonical origin (scheme://hostname:port)
 */
export function getCanonicalOrigin(urlStr: string): { protocol: string; host: string; origin: string } | null {
  try {
    const parsed = new URL(urlStr);
    return {
      protocol: parsed.protocol, // e.g. "http:" or "https:"
      host: parsed.host,         // e.g. "127.0.0.1:3000" or "example.com"
      origin: parsed.origin,     // e.g. "http://127.0.0.1:3000"
    };
  } catch {
    return null;
  }
}

/**
 * Checks if a candidate origin matches trusted application origins,
 * taking into account scheme, hostname, and port.
 */
export function isTrustedOrigin(candidateOriginStr: string, req: Request): boolean {
  const candidate = getCanonicalOrigin(candidateOriginStr);
  if (!candidate) return false;

  const reqHost = req.get('host'); // includes hostname:port if non-standard
  if (!reqHost) return false;

  // Determine current expected scheme
  const forwardedProto = req.headers['x-forwarded-proto'];
  const expectedProto = typeof forwardedProto === 'string'
    ? `${forwardedProto.split(',')[0].trim().toLowerCase()}:`
    : `${req.protocol.toLowerCase()}:`;

  const isProd = process.env.NODE_ENV === 'production';

  // 1. In production, scheme must be https unless explicitly running on a local cluster
  const isLocalCandidate = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(candidate.host);
  if (isProd && !isLocalCandidate && candidate.protocol !== 'https:') {
    return false;
  }

  // Check against Host header or X-Forwarded-Host header
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostCandidates = [reqHost];
  if (typeof forwardedHost === 'string') {
    hostCandidates.push(forwardedHost.split(',')[0].trim());
  }

  // AI Studio preview domain support
  if (candidate.host.endsWith('.run.app') || candidate.host.endsWith('.google.com')) {
    return true;
  }

  for (const host of hostCandidates) {
    if (candidate.host.toLowerCase() === host.toLowerCase()) {
      return true;
    }
  }

  // 3. Local loopback alias match for development (localhost <-> 127.0.0.1 <-> 0.0.0.0)
  if (!isProd || isLocalCandidate) {
    const [candidateHostname, candidatePort = candidate.protocol === 'https:' ? '443' : '80'] = candidate.host.split(':');
    const [reqHostname, reqPort = expectedProto === 'https:' ? '443' : '80'] = reqHost.split(':');

    const loopbackIps = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
    if (loopbackIps.has(candidateHostname.toLowerCase()) && loopbackIps.has(reqHostname.toLowerCase())) {
      if (candidatePort === reqPort) {
        return true;
      }
    }
  }

  // 4. Explicitly configured trusted origins from environment variables
  const configuredAllowed = [
    process.env.APP_URL,
    process.env.FRONTEND_URL,
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
  ].filter(Boolean) as string[];

  for (const allowedStr of configuredAllowed) {
    const allowed = getCanonicalOrigin(allowedStr.trim());
    if (allowed && allowed.origin.toLowerCase() === candidate.origin.toLowerCase()) {
      return true;
    }
  }

  return false;
}

/**
 * Validates Origin and Referer headers for all state-changing HTTP methods
 * (POST, PUT, PATCH, DELETE) to protect against Cross-Site Request Forgery (CSRF).
 *
 * Policy:
 * 1. Safe methods (GET, HEAD, OPTIONS) pass through.
 * 2. State-changing requests MUST provide a valid Origin or Referer.
 *    Requests lacking both headers are rejected (fail closed).
 * 3. Origin/Referer must match the trusted origin scheme, host, and port.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const originHeader = req.headers['origin'];
  const refererHeader = req.headers['referer'];

  // Reject state-changing requests without Origin or Referer
  if (!originHeader && !refererHeader) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Missing Origin or Referer header on state-changing request',
      code: 'CSRF_BLOCKED',
    });
  }

  // Primary check: Origin header
  if (typeof originHeader === 'string' && originHeader.trim()) {
    if (!isTrustedOrigin(originHeader.trim(), req)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cross-Site Request Forgery (CSRF) detected from origin ${originHeader}`,
        code: 'CSRF_BLOCKED',
      });
    }
    return next();
  }

  // Secondary check: Referer header (when Origin is omitted by older clients)
  if (typeof refererHeader === 'string' && refererHeader.trim()) {
    const refererOrigin = getCanonicalOrigin(refererHeader.trim());
    if (!refererOrigin || !isTrustedOrigin(refererOrigin.origin, req)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cross-Site Request Forgery (CSRF) detected from referer ${refererHeader}`,
        code: 'CSRF_BLOCKED',
      });
    }
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Forbidden: Invalid Origin or Referer header',
    code: 'CSRF_BLOCKED',
  });
}
