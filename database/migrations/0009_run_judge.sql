-- 0009 — Server-judged runs (G0).
--
-- The API now replays every run headless (same program version, level,
-- layout and seed as the browser) and scores what it observed. Each attempt
-- records which layout and seed it was played with so the judge — and any
-- later re-check — replays exactly that run.

BEGIN;

ALTER TABLE level_attempts
  ADD COLUMN IF NOT EXISTS layout_index SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seed INTEGER NOT NULL DEFAULT 1;

ALTER TABLE level_attempts DROP CONSTRAINT IF EXISTS level_attempts_layout_chk;
ALTER TABLE level_attempts ADD CONSTRAINT level_attempts_layout_chk CHECK (layout_index BETWEEN 0 AND 99);
ALTER TABLE level_attempts DROP CONSTRAINT IF EXISTS level_attempts_seed_chk;
ALTER TABLE level_attempts ADD CONSTRAINT level_attempts_seed_chk CHECK (seed >= 0);

COMMENT ON COLUMN level_attempts.layout_index IS 'Level layout (mission_settings.variants index) the run was played on; replayed by the run judge.';
COMMENT ON COLUMN level_attempts.seed IS 'Seed for random blocks; replayed by the run judge.';

COMMIT;
