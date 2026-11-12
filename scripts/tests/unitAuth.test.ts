import crypto from 'crypto';
import {
  hashSessionToken,
  getSessionCookieOptions,
  getClearCookieOptions,
  sanitizeAuditData,
} from '../../server/auth/auth.js';
import {
  isTrustedOrigin,
  getCanonicalOrigin,
  csrfProtection,
} from '../../server/auth/csrf.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

export async function runUnitTests() {
  console.log('=== RUNNING SECTION A: UNIT & NON-DESTRUCTIVE SECURITY TESTS ===\n');

  // 1. Session Token Hashing (SHA-256)
  const sampleToken = 'e4b98cf112a4b86e0987abcdef0123456789abcdef0123456789abcdef0123';
  const hash1 = hashSessionToken(sampleToken);
  const hash2 = hashSessionToken(sampleToken);
  const expectedHash = crypto.createHash('sha256').update(sampleToken).digest('hex');
  assert(
    hash1 === expectedHash && hash1 === hash2 && hash1.length === 64,
    'U1. hashSessionToken generates deterministic, 64-character SHA-256 hex digest'
  );
  assert(hashSessionToken('') === '', 'U2. hashSessionToken returns empty string for empty input');

  // 2. Cookie Options Security
  const cookieOpts = getSessionCookieOptions(24);
  assert(cookieOpts.httpOnly === true, 'U3. Session cookie has httpOnly=true (anti-XSS)');
  assert(cookieOpts.sameSite === 'lax', 'U4. Session cookie has sameSite=lax');
  assert(cookieOpts.path === '/', 'U5. Session cookie path is "/"');
  assert(typeof cookieOpts.maxAge === 'number' && cookieOpts.maxAge > 0, 'U6. Session cookie maxAge is positive number');

  const clearOpts = getClearCookieOptions();
  assert(clearOpts.httpOnly === true && clearOpts.sameSite === 'lax' && clearOpts.path === '/', 'U7. Clear cookie options match session cookie flags');

  // 3. Audit Data Sanitization (Scrubbing passwords and tokens)
  const dirtyData = {
    username: 'john_doe',
    password: 'SuperSecretPassword123!',
    password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    token: 'plaintext_session_token_xyz',
    secretKey: 'my-super-secret',
    nested: {
      userToken: 'token_abc',
      safeField: 'display_name',
    },
  };
  const cleanData = sanitizeAuditData(dirtyData);
  assert(
    cleanData.username === 'john_doe' &&
    cleanData.password === '[REDACTED]' &&
    cleanData.password_hash === '[REDACTED]' &&
    cleanData.token === '[REDACTED]' &&
    cleanData.secretKey === '[REDACTED]' &&
    cleanData.nested.userToken === '[REDACTED]' &&
    cleanData.nested.safeField === 'display_name',
    'U8. sanitizeAuditData scrubs password, password_hash, token, and secrets recursively'
  );

  // 4. CSRF Canonical Origin Parser
  const parsedLocal = getCanonicalOrigin('http://127.0.0.1:3000/api/auth/login?param=1');
  assert(
    parsedLocal !== null &&
    parsedLocal.protocol === 'http:' &&
    parsedLocal.host === '127.0.0.1:3000' &&
    parsedLocal.origin === 'http://127.0.0.1:3000',
    'U9. getCanonicalOrigin correctly parses protocol, host, and origin'
  );

  // 5. CSRF Origin Validation (isTrustedOrigin)
  const mockReqLocal = {
    get: (header: string) => (header.toLowerCase() === 'host' ? '127.0.0.1:3000' : undefined),
    protocol: 'http',
    headers: {},
  } as any;

  assert(isTrustedOrigin('http://127.0.0.1:3000', mockReqLocal), 'U10. isTrustedOrigin allows matching local origin and port');
  assert(isTrustedOrigin('http://localhost:3000', mockReqLocal), 'U11. isTrustedOrigin allows localhost/127.0.0.1 loopback alias on same port in development');
  assert(!isTrustedOrigin('http://malicious-attacker.com', mockReqLocal), 'U12. isTrustedOrigin rejects foreign domain origin');
  assert(!isTrustedOrigin('http://127.0.0.1:8080', mockReqLocal), 'U13. isTrustedOrigin rejects mismatched port (3000 vs 8080)');

  // 6. CSRF Middleware Execution
  let nextCalled = false;
  let blockedStatus: number | null = null;
  let blockedJson: any = null;

  const mockRes = {
    status: (code: number) => {
      blockedStatus = code;
      return {
        json: (data: any) => { blockedJson = data; return mockRes; },
      };
    },
  } as any;

  // Safe method GET passes without Origin
  nextCalled = false;
  csrfProtection({ method: 'GET', headers: {} } as any, mockRes, () => { nextCalled = true; });
  assert(nextCalled, 'U14. CSRF middleware allows safe method GET without Origin/Referer');

  // Mutation method POST without Origin or Referer is rejected (HTTP 403 CSRF_BLOCKED)
  nextCalled = false;
  blockedStatus = null;
  csrfProtection({ method: 'POST', headers: {}, get: () => '127.0.0.1:3000', protocol: 'http' } as any, mockRes, () => { nextCalled = true; });
  assert(!nextCalled && blockedStatus === 403 && blockedJson?.code === 'CSRF_BLOCKED', 'U15. CSRF middleware rejects POST request without Origin or Referer (HTTP 403 CSRF_BLOCKED)');

  // Mutation method POST with foreign Origin is rejected
  nextCalled = false;
  blockedStatus = null;
  csrfProtection({
    method: 'POST',
    headers: { origin: 'http://malicious-attacker.com' },
    get: () => '127.0.0.1:3000',
    protocol: 'http',
  } as any, mockRes, () => { nextCalled = true; });
  assert(!nextCalled && blockedStatus === 403 && blockedJson?.code === 'CSRF_BLOCKED', 'U16. CSRF middleware rejects POST request from foreign origin (HTTP 403 CSRF_BLOCKED)');

  // Mutation method POST with valid same-origin passes
  nextCalled = false;
  csrfProtection({
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:3000' },
    get: () => '127.0.0.1:3000',
    protocol: 'http',
  } as any, mockRes, () => { nextCalled = true; });
  assert(nextCalled, 'U17. CSRF middleware accepts POST request with valid trusted origin');

  console.log(`\nUnit tests completed: ${passed} PASSED, ${failed} FAILED\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('unitAuth.test.ts')) {
  runUnitTests().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
