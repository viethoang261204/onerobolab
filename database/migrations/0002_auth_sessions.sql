-- =============================================================================
-- 0002 — API sign-in sessions + ledger trigger fix (Backend Phase 2)
--
-- Apply to a database created with the original schema.sql:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0002_auth_sessions.sql
-- (Fresh installs get both from schema.sql already.) Safe to run twice.
--
-- Only an HMAC-SHA256 of the bearer token is stored (keyed with AUTH_SECRET),
-- never the token itself: a database leak cannot be replayed as a login.
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  ip_address    INET,
  user_agent    TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
  CONSTRAINT auth_sessions_expiry_chk CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_active_idx ON auth_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS auth_sessions_expires_idx ON auth_sessions (expires_at);

-- Fix: negative ledger rows (hint purchases, admin adjustments) failed the
-- student_stats CHECKs on the proposed INSERT row before ON CONFLICT applied.
CREATE OR REPLACE FUNCTION apply_xp_transaction() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- The inserted row must satisfy the CHECKs even when the amount is negative (spending).
  INSERT INTO student_stats (student_id, total_xp) VALUES (NEW.student_id, GREATEST(NEW.amount, 0))
  ON CONFLICT (student_id) DO UPDATE SET total_xp = student_stats.total_xp + NEW.amount;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION apply_star_transaction() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO student_stats (student_id, total_stars) VALUES (NEW.student_id, GREATEST(NEW.stars_after - NEW.stars_before, 0))
  ON CONFLICT (student_id) DO UPDATE SET total_stars = student_stats.total_stars + (NEW.stars_after - NEW.stars_before);
  RETURN NEW;
END;
$$;

COMMIT;
