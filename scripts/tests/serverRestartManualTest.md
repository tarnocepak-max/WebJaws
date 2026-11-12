# WebJaws Manual & Automated Server Restart Verification Guide

## Purpose
Verify that session persistence is strictly backed by the PostgreSQL `auth_sessions` table, so an actual physical or process restart of the WebJaws Node.js Express server does not drop authenticated sessions.

---

## Pre-conditions
- PostgreSQL database is provisioned and configured in `.env` (`DATABASE_URL`).
- WebJaws server is running on `http://127.0.0.1:3000`.

---

## Test Steps

### Step 1: Establish an Authenticated Session
Execute a login request with valid credentials:
```bash
curl -i -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:3000" \
  -d '{"identifier":"superadmin","password":"YourPasswordHere"}'
```
Note the `Set-Cookie: webjaws_session=<SESSION_TOKEN>; ...` header in the response.

### Step 2: Verify PostgreSQL Token Hash Storage
Query PostgreSQL directly to confirm only `token_hash` is stored (and plaintext `token` is NULL):
```sql
SELECT id, token_hash, token, user_id, expires_at 
FROM auth_sessions 
WHERE token_hash = encode(digest('<SESSION_TOKEN>', 'sha256'), 'hex');
```
Result must return 1 row with `token_hash` populated and `token` is NULL.

### Step 3: Stop and Restart the WebJaws Express Server
Terminate the dev server process and restart it:
```bash
# In your terminal or container
pkill -f "tsx server.ts" || pkill -f "node server.ts"
npm run dev
```

### Step 4: Verify Session Validity After Restart
Issue an authenticated request to `/api/auth/me` with the previous cookie:
```bash
curl -i -X GET http://127.0.0.1:3000/api/auth/me \
  -H "Cookie: webjaws_session=<SESSION_TOKEN>"
```

### Expected Result
- HTTP Status: **200 OK**
- Body: `{"success": true, "user": {...}}`
- User remains authenticated seamlessly across process restarts because session validation is 100% PostgreSQL-backed without in-memory dependency.
