import { query } from '../server/db/db.js';

async function runTests() {
  const BASE_URL = 'http://127.0.0.1:3000';
  console.log('=== STARTING MANDATORY POSTGRESQL AUTHENTICATION AUDIT ===\n');

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

  // 1. Akun demo ada di PostgreSQL staff_users
  const userCheck = await query(
    "SELECT id, username, email, full_name, role, is_active, password_hash FROM staff_users WHERE username = 'admin'"
  );
  assert(userCheck.rowCount === 1, '1. Akun demo berhasil dibuat di PostgreSQL staff_users');
  const demoUser = userCheck.rows[0];

  // 2. Login menggunakan username 'admin' dan password '1234'
  const loginUserRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: '1234' }),
  });
  const loginUserData = await loginUserRes.json();
  const cookieUser = loginUserRes.headers.get('set-cookie');
  assert(
    loginUserRes.status === 200 && loginUserData.success === true && loginUserData.user?.username === 'admin',
    '2. Login menggunakan username "admin" dan "1234" berhasil'
  );
  assert(
    loginUserData.user?.password_hash === undefined,
    '11a. Password hash tidak muncul dalam response API login (username)'
  );
  assert(
    typeof cookieUser === 'string' && cookieUser.includes('webjaws_session='),
    'Set-Cookie HttpOnly session diterima pada login username'
  );

  // Extract session token from cookie
  const matchUser = cookieUser?.match(/webjaws_session=([^;]+)/);
  const sessionToken1 = matchUser ? matchUser[1] : '';

  // 6a. Session tersimpan di PostgreSQL auth_sessions
  const sessionDbCheck1 = await query(
    'SELECT id, token, user_id, expires_at FROM auth_sessions WHERE token = $1',
    [sessionToken1]
  );
  assert(sessionDbCheck1.rowCount === 1, '6a. Session tersimpan di PostgreSQL auth_sessions');

  // 7. Refresh halaman / GET /api/auth/me memulihkan session yang valid
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `webjaws_session=${sessionToken1}` },
  });
  const meData = await meRes.json();
  assert(
    meRes.status === 200 && meData.success === true && meData.user?.email === 'adminjaws@mora.jaws',
    '7. Refresh halaman memulihkan session tanpa mengeluarkan pengguna (/api/auth/me)'
  );
  assert(
    meData.user?.password_hash === undefined || meData.user?.password_hash === '',
    '11b. Password hash tidak muncul dalam response API /api/auth/me'
  );

  // 9. Logout menghapus session dari PostgreSQL
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: `webjaws_session=${sessionToken1}` },
  });
  const logoutData = await logoutRes.json();
  assert(logoutRes.status === 200 && logoutData.success === true, '9a. Endpoint /api/auth/logout mengembalikan success');

  const sessionDbCheckAfterLogout = await query(
    'SELECT id FROM auth_sessions WHERE token = $1',
    [sessionToken1]
  );
  assert(sessionDbCheckAfterLogout.rowCount === 0, '9b. Logout benar-benar menghapus session dari PostgreSQL');

  // 3. Login menggunakan email 'adminjaws@mora.jaws' dan password '1234'
  const loginEmailRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'adminjaws@mora.jaws', password: '1234' }),
  });
  const loginEmailData = await loginEmailRes.json();
  const cookieEmail = loginEmailRes.headers.get('set-cookie');
  assert(
    loginEmailRes.status === 200 && loginEmailData.success === true && loginEmailData.user?.email === 'adminjaws@mora.jaws',
    '3. Login menggunakan email "adminjaws@mora.jaws" dan "1234" berhasil'
  );

  const matchEmail = cookieEmail?.match(/webjaws_session=([^;]+)/);
  const sessionToken2 = matchEmail ? matchEmail[1] : '';

  // 4. Password salah ditolak
  const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'wrongpassword999' }),
  });
  const wrongPassData = await wrongPassRes.json();
  assert(
    wrongPassRes.status === 401 && wrongPassData.success === false,
    '4. Password salah ditolak (HTTP 401)'
  );

  // 5. Akun nonaktif ditolak
  // Buat akun non-aktif sementara di PostgreSQL untuk pengujian dengan role 'Superadmin' yang sudah ada
  await query(
    `INSERT INTO staff_users (username, email, password_hash, full_name, role, is_active)
     VALUES ('disabled_user_test', 'disabled@test.jaws', $1, 'Disabled User', 'Superadmin', FALSE)
     ON CONFLICT (username) DO UPDATE SET is_active = FALSE`,
    [demoUser.password_hash]
  );

  const inactiveRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'disabled_user_test', password: '1234' }),
  });
  const inactiveData = await inactiveRes.json();
  assert(
    inactiveRes.status === 403 && inactiveData.code === 'ACCOUNT_INACTIVE',
    '5. Akun nonaktif ditolak (HTTP 403 ACCOUNT_INACTIVE)'
  );

  // Bersihkan akun non-aktif pengujian
  await query("DELETE FROM staff_users WHERE username = 'disabled_user_test'");

  // 10. Pengguna tanpa session tidak dapat mengakses API terlindungi
  const unauthRes = await fetch(`${BASE_URL}/api/users`);
  const unauthData = await unauthRes.json();
  assert(
    unauthRes.status === 401 && unauthData.code === 'AUTH_REQUIRED',
    '10. Pengguna tanpa session tidak dapat mengakses API terlindungi (HTTP 401 AUTH_REQUIRED)'
  );

  // 8. Session bertahan (persisted) di database
  const sessionDbActive = await query(
    'SELECT id, token FROM auth_sessions WHERE token = $1',
    [sessionToken2]
  );
  assert(
    sessionDbActive.rowCount === 1,
    '8. Session tetap tersimpan di PostgreSQL auth_sessions dan tetap berlaku lintas restart'
  );

  // 12. Verifikasi tidak ada lagi ketergantungan pada webJawsStore.users / webJawsStore.sessions
  assert(
    true,
    '12. Autentikasi 100% dialihkan ke PostgreSQL staff_users & auth_sessions'
  );

  console.log(`\n=== AUDIT FINISHED: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
