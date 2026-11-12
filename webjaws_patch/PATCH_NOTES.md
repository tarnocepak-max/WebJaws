# WebJaws Foundation Security Patch (overlay ZIP)

## Apply
1. Make a backup/copy of the original WebJaws project.
2. Extract this ZIP into the project root and allow files to be replaced.
3. Compare changed files before deployment.
4. Install dependencies using the project's existing package manager, then run the TypeScript check/build.
5. Do not deploy until the remaining blockers below are addressed.

## Included changes
- Database connection status now reports `unavailable` rather than pretending a memory fallback is a database.
- Migration returns `success: false` if PostgreSQL is unavailable and verifies required tables before success.
- Login screen no longer pre-fills demo credentials or exposes demo-profile buttons.
- Hardcoded demo staff accounts are no longer seeded in the in-memory store.
- Browser no longer persists or sends bearer session tokens; requests rely on HttpOnly cookies.
- Login response no longer returns the session token in JSON.
- Session cookie lifetime uses `SESSION_DURATION_HOURS`.
- Leader contractor/area boundary fails closed when scope values are missing.
- Health endpoint reports degraded state when PostgreSQL is unavailable.
- `.env.example` documents server-only environment variables without real secrets.

## Important remaining blockers (not solved by this patch)
This is a targeted remediation overlay, not a complete PostgreSQL migration. The current project still has route handlers and session/user/config/WO operations that use `webJawsStore` in memory. The custom login/session middleware has not yet been converted to query `staff_users` and `auth_sessions` in PostgreSQL. As demo staff seeding is removed, login will remain unavailable until the database-backed Superadmin bootstrap and database-backed authentication are implemented. Do not treat the app as production-ready or claim all modules persist in Supabase.

The `SUPABASE_SERVICE_ROLE_KEY` is not needed for direct PostgreSQL access through `DATABASE_URL`; only retain it if server-side Supabase APIs are actually used. Never place it in frontend code.
