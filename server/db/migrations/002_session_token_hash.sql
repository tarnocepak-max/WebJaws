-- Migration 002: Session Token Security (Hash Storage)
-- Store SHA-256 hash of session tokens in PostgreSQL instead of plaintext tokens.

DO $$
BEGIN
  -- 1. Add token_hash column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_sessions' AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE auth_sessions ADD COLUMN token_hash VARCHAR(128);
  END IF;

  -- 2. Make legacy token column nullable so plaintext token is never stored
  ALTER TABLE auth_sessions ALTER COLUMN token DROP NOT NULL;

  -- 3. Create unique index on token_hash for secure indexed lookup
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'auth_sessions' AND indexname = 'idx_auth_sessions_token_hash'
  ) THEN
    CREATE UNIQUE INDEX idx_auth_sessions_token_hash ON auth_sessions(token_hash);
  END IF;
END $$;
