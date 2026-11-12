import crypto from 'crypto';

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

export async function runUserUnitTests() {
  console.log('=== RUNNING SECTION B: USER MANAGEMENT & SETUP LOGIC UNIT TESTS ===\n');

  // 1. Username and Email format validation
  const validUsernameRegex = /^[a-zA-Z0-9._-]+$/;
  assert(validUsernameRegex.test('superadmin'), 'M1. Standard lowercase username valid');
  assert(validUsernameRegex.test('doni.septiawan'), 'M2. Username with dot valid');
  assert(validUsernameRegex.test('teknisi-01'), 'M3. Username with dash valid');
  assert(!validUsernameRegex.test('user name'), 'M4. Username with space rejected');
  assert(!validUsernameRegex.test('user@mora'), 'M5. Username with @ symbol rejected');

  const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  assert(validEmailRegex.test('admin@webjaws.internal'), 'M6. Standard email format accepted');
  assert(!validEmailRegex.test('invalid-email'), 'M7. Invalid email format rejected');
  assert(!validEmailRegex.test('user@domain'), 'M8. Email without TLD rejected');

  // 2. Safe string comparison for setup tokens (Constant-Time comparison against timing attacks)
  function safeEqual(a: string, b: string): boolean {
    const aa = Buffer.from(a);
    const bb = Buffer.from(b);
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  }

  const tokenA = 'abc123secrettoken456789012345678';
  const tokenB = 'abc123secrettoken456789012345678';
  const tokenC = 'abc123secrettoken456789012345679';
  const tokenShort = 'abc123secret';

  assert(safeEqual(tokenA, tokenB), 'M9. safeEqual matches identical tokens in constant time');
  assert(!safeEqual(tokenA, tokenC), 'M10. safeEqual rejects mismatched token');
  assert(!safeEqual(tokenA, tokenShort), 'M11. safeEqual rejects token of different length');

  // 3. Last Superadmin Demotion Guard Check
  function canDemoteSuperadmin(currentRole: string, newRole: string, activeSuperadminCount: number): boolean {
    if (currentRole === 'Superadmin' && newRole && newRole !== 'Superadmin') {
      return activeSuperadminCount > 1;
    }
    return true;
  }

  assert(!canDemoteSuperadmin('Superadmin', 'Leader', 1), 'M12. Last Superadmin cannot be demoted when count = 1');
  assert(canDemoteSuperadmin('Superadmin', 'Leader', 2), 'M13. Superadmin can be demoted when count > 1');
  assert(canDemoteSuperadmin('Agent Dispatch', 'Leader', 1), 'M14. Non-superadmin role can be modified');

  // 4. Deactivation of self guard
  function canDeactivateUser(targetUserId: string, currentUserId: string, isActive: boolean): boolean {
    if (targetUserId === currentUserId && !isActive) return false;
    return true;
  }

  assert(!canDeactivateUser('usr-1', 'usr-1', false), 'M15. User cannot deactivate own account');
  assert(canDeactivateUser('usr-2', 'usr-1', false), 'M16. Superadmin can deactivate other staff account');

  console.log(`\nUser unit tests completed: ${passed} PASSED, ${failed} FAILED\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('unitUserManagement.test.ts')) {
  runUserUnitTests().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
