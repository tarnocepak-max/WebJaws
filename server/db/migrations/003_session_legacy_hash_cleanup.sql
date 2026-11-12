-- ====================================================================
-- WEBJAWS MIGRATION 003: Session Legacy Hash Cleanup
-- Target Database: Supabase PostgreSQL
-- Ensures legacy plaintext tokens are migrated to SHA-256 token_hash
-- and all plaintext token columns are cleared from PostgreSQL storage.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  -- 1. Ensure token_hash column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_sessions' AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE auth_sessions ADD COLUMN token_hash VARCHAR(128);
  END IF;

  -- 2. Migrate legacy plaintext session tokens to SHA-256 token_hash
  -- Preserves existing user sessions without mass-revoking them
  UPDATE auth_sessions
  SET token_hash = encode(digest(token, 'sha256'), 'hex')
  WHERE (token_hash IS NULL OR token_hash = '') AND token IS NOT NULL;

  -- 3. Clear plaintext tokens from PostgreSQL storage
  -- Raw token remains exclusively in client browser HttpOnly cookie
  UPDATE auth_sessions
  SET token = NULL
  WHERE token IS NOT NULL;

  -- 4. Ensure token column is nullable
  ALTER TABLE auth_sessions ALTER COLUMN token DROP NOT NULL;

  -- 5. Ensure unique index on token_hash exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'auth_sessions' AND indexname = 'idx_auth_sessions_token_hash'
  ) THEN
    CREATE UNIQUE INDEX idx_auth_sessions_token_hash ON auth_sessions(token_hash);
  END IF;
END $$;
