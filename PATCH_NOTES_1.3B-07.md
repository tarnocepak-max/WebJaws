# WebJaws PHASE 1.3B-07 — Feature Lock & Database Readiness Indicator

## Scope
Adds a global feature-readiness indicator to the authenticated application header. It is a visibility/diagnostic feature only; it does not modify authentication, authorization, database schema, migrations, or RLS policies.

## Files changed
- `src/components/layout/FeatureLockIndicator.tsx` — new readiness dropdown, status badges, manual refresh, and 60-second health polling.
- `src/components/layout/Topbar.tsx` — mounts the indicator in the global topbar.
- `PATCH_NOTES_1.3B-07.md` — this change record.

## Status semantics
- `VERIFIED`: only used for the live PostgreSQL connection check when `/api/system/health` confirms `database.connected === true`. This verifies connectivity only, not full CRUD, authorization, persistence, or RLS correctness.
- `OFFLINE`: health endpoint unavailable or PostgreSQL connection check fails.
- `PENDING`: implementation exists but runtime integration/security tests have not been completed.
- `LOCKED`: feature is known to be incomplete or not integrated; notably Work Orders persistence and RLS based on the source audit.

## Current conservative feature register
- Database connection: live health check.
- Custom Authentication: pending runtime login/session verification.
- Work Orders persistence: locked; audited routes still use the in-memory `webJawsStore` path.
- Role authorization (RBAC): pending full role matrix tests.
- Row Level Security (RLS): locked; this patch does not add or enable RLS.

## Safety / compatibility
- No login, cookie, session, auth middleware, role middleware, API endpoint, database query, schema, migration, or RLS policy was changed.
- The indicator does not disable existing application features and is not an authorization boundary. Backend authorization remains authoritative.
- The indicator uses the existing public `/api/system/health` endpoint.
- Health polling starts only in the authenticated app shell and repeats every 60 seconds; users can manually refresh.

## Verification
- Static source review completed.
- `npm run build` could not be completed in this environment because dependency installation did not finish and TypeScript reported missing `vite/client` type definitions. Run `npm ci` followed by `npm run build` in the target environment before deployment.
- No database migrations or production database changes were performed.

## Apply
1. Back up the current project.
2. Merge the changed source file and Topbar import/mount into the matching project version.
3. Run `npm ci` and `npm run build`.
4. Test with database online and offline; verify that only the database connectivity row changes dynamically.
5. Test login/logout and all existing roles. Do not treat this UI indicator as a substitute for the planned RLS integration tests.
