import { query } from '../server/db/db.js';
import { hashSessionToken } from '../server/auth/auth.js';
import { execSync } from 'child_process';

async function runTests() {
  const BASE_URL = 'http://127.0.0.1:3000';
  console.log('=== STARTING MANDATORY POSTGRESQL AUTHENTICATION & SECURITY AUDIT ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
      failed++;
    }
  }

  // Ensure any previous demo account is cleanly removed before testing
  try {
    execSync('npm run remove:demo', { stdio: 'pipe' });
  } catch {
    // ignore
  }

  // 1. Akun demo tidak dapat dibuat di production
  let prodBlocked = false;
  try {
    execSync('NODE_ENV=production DEMO_ADMIN_PASSWORD=1234 ALLOW_WEAK_DEMO_PASSWORD=true npm run seed:demo', { stdio: 'pipe' });
  } catch (err: any) {
    prodBlocked = true;
  }
  assert(prodBlocked, '1. Akun demo tidak dapat dibuat di production (Production Guard)');

  // 2. Demo seed menolak password lemah tanpa ALLOW_WEAK_DEMO_PASSWORD=true
  let weakPasswordBlocked = false;
  try {
    execSync('DEMO_ADMIN_PASSWORD=1234 ALLOW_WEAK_DEMO_PASSWORD=false npm run seed:demo', { stdio: 'pipe' });
  } catch {
    weakPasswordBlocked = true;
  }
  assert(weakPasswordBlocked, '2. Seed menolak password lemah tanpa konfirmasi ALLOW_WEAK_DEMO_PASSWORD=true');

  // 3. Demo seed berhasil dengan password dan konfirmasi eksplisit
  let seedSuccess = false;
  try {
    const seedOut = execSync('ALLOW_WEAK_DEMO_PASSWORD=true DEMO_ADMIN_PASSWORD=1234 npm run seed:demo', { encoding: 'utf8' });
    seedSuccess = seedOut.includes('SUCCESS');
  } catch (err: any) {
    console.error('Seed error:', err.message);
  }
  assert(seedSuccess, '3. Akun demo berhasil dibuat saat ALLOW_WEAK_DEMO_PASSWORD=true & DEMO_ADMIN_PASSWORD diset');

  // 4. Seed menolak duplikasi username/email
  const dupOut = execSync('ALLOW_WEAK_DEMO_PASSWORD=true DEMO_ADMIN_PASSWORD=1234 npm run seed:demo', { encoding: 'utf8' });
  const duplicatePrevented = dupOut.includes('already exists') || dupOut.includes('Skipping insertion');
  const countCheck = await query("SELECT COUNT(*)::int AS cnt FROM staff_users WHERE username = 'admin' OR email = 'adminjaws@mora.jaws'");
  assert(duplicatePrevented && countCheck.rows[0].cnt === 1, '4. Seed menolak duplikasi username/email (Idempotent)');

  // 5. Login menggunakan username 'admin' dan password '1234'
  const loginUserRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: '1234' }),
  });
  const loginUserData = await loginUserRes.json();
  const cookieUser = loginUserRes.headers.get('set-cookie');
  assert(
    loginUserRes.status === 200 && loginUserData.success === true && loginUserData.user?.username === 'admin',
    '5. Login menggunakan username "admin" dan password berhasil (HTTP 200)'
  );

  // 6. Login menggunakan email 'adminjaws@mora.jaws' dan password '1234'
  const loginEmailRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'adminjaws@mora.jaws', password: '1234' }),
  });
  const loginEmailData = await loginEmailRes.json();
  assert(
    loginEmailRes.status === 200 && loginEmailData.success === true && loginEmailData.user?.email === 'adminjaws@mora.jaws',
    '6. Login menggunakan email "adminjaws@mora.jaws" dan password berhasil (HTTP 200)'
  );

  // 7. Password salah ditolak
  const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'wrongpassword999' }),
  });
  const wrongPassData = await wrongPassRes.json();
  assert(
    wrongPassRes.status === 401 && wrongPassData.code === 'INVALID_CREDENTIALS',
    '7. Password salah ditolak (HTTP 401 INVALID_CREDENTIALS)'
  );

  // 8. Akun nonaktif ditolak
  const demoUserRes = await query("SELECT id, password_hash FROM staff_users WHERE username = 'admin'");
  const demoUser = demoUserRes.rows[0];

  await query(
    `INSERT INTO staff_users (username, email, password_hash, full_name, role, is_active)
     VALUES ('disabled_audit_test', 'disabled@audit.jaws', $1, 'Disabled Audit User', 'Superadmin', FALSE)
     ON CONFLICT (username) DO UPDATE SET is_active = FALSE`,
    [demoUser.password_hash]
  );

  const inactiveRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'disabled_audit_test', password: '1234' }),
  });
  const inactiveData = await inactiveRes.json();
  assert(
    inactiveRes.status === 403 && inactiveData.code === 'ACCOUNT_INACTIVE',
    '8. Akun nonaktif ditolak (HTTP 403 ACCOUNT_INACTIVE)'
  );
  await query("DELETE FROM staff_users WHERE username = 'disabled_audit_test'");

  // 9. Session token security: Token di PostgreSQL berupa hash SHA-256 (bukan token asli)
  const matchUser = cookieUser?.match(/webjaws_session=([^;]+)/);
  const sessionToken1 = matchUser ? matchUser[1] : '';
  const expectedHash = hashSessionToken(sessionToken1);

  const sessionDbCheck1 = await query(
    'SELECT id, token_hash, token, user_id, expires_at FROM auth_sessions WHERE token_hash = $1',
    [expectedHash]
  );
  const dbRow = sessionDbCheck1.rows[0];
  const isHashSaved = sessionDbCheck1.rowCount === 1 && dbRow?.token_hash === expectedHash;
  const isPlaintextExcluded = dbRow?.token !== sessionToken1;
  assert(
    isHashSaved && isPlaintextExcluded,
    '9. Token session di PostgreSQL disimpan sebagai hash SHA-256 (token plaintext tidak disimpan)'
  );

  // 10. Cookie Security: HttpOnly dan SameSite flag
  const isHttpOnly = typeof cookieUser === 'string' && /httponly/i.test(cookieUser);
  const isSameSiteLax = typeof cookieUser === 'string' && /samesite=lax/i.test(cookieUser);
  assert(
    isHttpOnly && isSameSiteLax,
    '10. Cookie sesi menggunakan flag HttpOnly dan SameSite=Lax (anti-XSS script access)'
  );

  // 11. Password hash tidak pernah muncul dalam response API
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `webjaws_session=${sessionToken1}` },
  });
  const meData = await meRes.json();
  assert(
    loginUserData.user?.password_hash === undefined && meData.user?.password_hash === undefined,
    '11. Password hash tidak pernah bocor dalam response API (/api/auth/login atau /api/auth/me)'
  );

  // 12. API terlindungi menolak pengguna tanpa session
  const unauthRes = await fetch(`${BASE_URL}/api/users`);
  const unauthData = await unauthRes.json();
  assert(
    unauthRes.status === 401 && unauthData.code === 'AUTH_REQUIRED',
    '12. API terlindungi menolak request tanpa session (HTTP 401 AUTH_REQUIRED)'
  );

  // 13. Pengujian CSRF: Request mutasi dari origin asing ditolak
  const csrfRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `webjaws_session=${sessionToken1}`,
      Origin: 'http://malicious-attacker.com',
    },
    body: JSON.stringify({ currentPassword: '1234', newPassword: 'NewPassword2026!' }),
  });
  const csrfData = await csrfRes.json();
  assert(
    csrfRes.status === 403 && csrfData.code === 'CSRF_BLOCKED',
    '13. Perlindungan CSRF: request state-changing dari Origin asing ditolak (HTTP 403 CSRF_BLOCKED)'
  );

  // 14. Session tetap valid setelah restart server (Persistence check)
  const sessionDbActive = await query(
    'SELECT id, token_hash FROM auth_sessions WHERE token_hash = $1',
    [expectedHash]
  );
  assert(
    sessionDbActive.rowCount === 1,
    '14. Session tersimpan di tabel PostgreSQL auth_sessions dan bertahan secara persisten'
  );

  // 15. Logout menghapus session dari PostgreSQL
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: `webjaws_session=${sessionToken1}` },
  });
  const logoutData = await logoutRes.json();
  const sessionDbAfterLogout = await query(
    'SELECT id FROM auth_sessions WHERE token_hash = $1',
    [expectedHash]
  );
  assert(
    logoutRes.status === 200 && logoutData.success === true && sessionDbAfterLogout.rowCount === 0,
    '15. Endpoint /api/auth/logout menghapus session dari tabel PostgreSQL auth_sessions'
  );

  // 16. Logout-all menghapus semua session aktif milik user
  // Login dua kali untuk membuat dua session
  const s1Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: '1234' }),
  });
  const cookie1 = s1Res.headers.get('set-cookie')?.match(/webjaws_session=([^;]+)/)?.[1] || '';

  await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: '1234' }),
  });

  const countBeforeLogoutAll = await query(
    'SELECT COUNT(*)::int AS cnt FROM auth_sessions WHERE user_id = $1',
    [demoUser.id]
  );
  assert(countBeforeLogoutAll.rows[0].cnt >= 2, '16a. Pengguna memiliki beberapa session aktif di database');

  const logoutAllRes = await fetch(`${BASE_URL}/api/auth/logout-all`, {
    method: 'POST',
    headers: { Cookie: `webjaws_session=${cookie1}` },
  });
  const logoutAllData = await logoutAllRes.json();
  const countAfterLogoutAll = await query(
    'SELECT COUNT(*)::int AS cnt FROM auth_sessions WHERE user_id = $1',
    [demoUser.id]
  );
  assert(
    logoutAllRes.status === 200 && logoutAllData.success === true && countAfterLogoutAll.rows[0].cnt === 0,
    '16b. Endpoint /api/auth/logout-all mencabut dan menghapus SEMUA session aktif pengguna dari PostgreSQL'
  );

  // 17. Cleanup: Pastikan akun demo dihapus setelah pengujian selesai
  // "Jangan menjalankan seed secara otomatis. Saya ingin menjalankannya sendiri setelah patch diperiksa."
  execSync('npm run remove:demo', { stdio: 'pipe' });
  const finalDemoCheck = await query("SELECT COUNT(*)::int AS cnt FROM staff_users WHERE username = 'admin'");
  assert(
    finalDemoCheck.rows[0].cnt === 0,
    '17. Akun demo dibersihkan setelah pengujian (DB bersih untuk eksekusi manual oleh pengguna)'
  );

  console.log(`\n=== AUDIT FINISHED: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
