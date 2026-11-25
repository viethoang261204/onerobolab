-- =============================================================================
-- OneRoboLab — PostgreSQL schema (canonical initial definition)
--
-- Target: PostgreSQL 15+ (Neon). Run once on a fresh database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
--
-- Conventions
--   * UUID primary keys (gen_random_uuid), TIMESTAMPTZ everywhere.
--   * Content and users are soft-deleted (deleted_at); student history is never
--     cascade-deleted (student data → content/users FKs are RESTRICT).
--   * Pure content children (objectives, checkpoints, hints, unlock rules)
--     cascade with their level only when the level is hard-deleted AND no
--     student data references them (RESTRICT on student tables blocks it).
--   * No plaintext secrets: passwords are stored only as Argon2id / bcrypt hashes
--     produced by the backend. Sessions store only an HMAC of the token.
-- =============================================================================

BEGIN;

-- gen_random_uuid() is built into PostgreSQL 13+; pgcrypto is enabled for
-- compatibility with older servers and is supported on Neon.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
CREATE TYPE user_status              AS ENUM ('ACTIVE', 'DISABLED', 'PENDING');
CREATE TYPE content_status           AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE level_difficulty         AS ENUM ('BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT');
-- Publication (status) and visibility are separate from unlocking:
CREATE TYPE level_visibility         AS ENUM ('VISIBLE', 'HIDDEN');
-- AUTO = unlock rules decide · UNLOCKED = open for everyone · LOCKED = locked for everyone
CREATE TYPE level_access_mode        AS ENUM ('AUTO', 'UNLOCKED', 'LOCKED');
-- Per-student admin override.
CREATE TYPE student_access_status    AS ENUM ('LOCKED', 'AVAILABLE', 'COMPLETED', 'DISABLED');
-- Effective state computed for a student (see get_student_level_states).
CREATE TYPE level_state              AS ENUM ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'DISABLED');
CREATE TYPE prerequisite_type        AS ENUM ('LEVEL_COMPLETED', 'LEVEL_STARS', 'WORLD_COMPLETED', 'TOTAL_STARS', 'TOTAL_XP', 'ACHIEVEMENT');
CREATE TYPE progress_status          AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE submission_status        AS ENUM ('STARTED', 'SUBMITTED', 'PASSED', 'FAILED');
CREATE TYPE attempt_status           AS ENUM ('RUNNING', 'PASSED', 'FAILED', 'ERROR', 'ABORTED');
CREATE TYPE objective_type           AS ENUM ('START_PROGRAM', 'REACH_CHECKPOINT', 'REACH_ALL_CHECKPOINTS', 'REACH_GOAL', 'AVOID_COLLISIONS', 'FINISH_WITHIN', 'USE_MAX_BLOCKS', 'CUSTOM');
CREATE TYPE environment_kind         AS ENUM ('LEVEL', 'WORLD_PREVIEW');
CREATE TYPE program_version_source   AS ENUM ('AUTOSAVE', 'MANUAL_SAVE', 'SUBMISSION', 'RESTORE');
CREATE TYPE xp_source_type           AS ENUM ('LEVEL_COMPLETION', 'LEVEL_IMPROVEMENT', 'ACHIEVEMENT', 'HINT_PURCHASE', 'BONUS', 'ADMIN_ADJUSTMENT');
CREATE TYPE star_source_type         AS ENUM ('LEVEL_RESULT', 'ADMIN_ADJUSTMENT');
CREATE TYPE lesson_content_type      AS ENUM ('TEXT', 'MARKDOWN', 'VIDEO', 'IMAGE', 'INTERACTIVE');
CREATE TYPE graphics_quality         AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- -----------------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 1. Identity: roles, permissions, users
-- =============================================================================

-- Roles are rows, not an enum: TEACHER / CONTENT_EDITOR / SUPER_ADMIN are inserts.
CREATE TABLE roles (
  code         TEXT PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  name         TEXT NOT NULL,
  description  TEXT,
  is_system    BOOLEAN NOT NULL DEFAULT FALSE,      -- ADMIN / STUDENT cannot be removed by tools
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  code         TEXT PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_.]{2,63}$'),
  description  TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
  role_code        TEXT NOT NULL REFERENCES roles(code) ON UPDATE CASCADE ON DELETE CASCADE,
  permission_code  TEXT NOT NULL REFERENCES permissions(code) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Case-insensitive identity: "NguyenVanA" and "nguyenvana" are the same account.
  username              TEXT NOT NULL CHECK (username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$'),
  username_normalized   TEXT GENERATED ALWAYS AS (lower(username)) STORED,
  -- Only hashes are accepted (Argon2 / bcrypt formats) or the seed placeholder,
  -- which can never verify. A plaintext password cannot pass this check.
  password_hash         TEXT NOT NULL CHECK (
                          password_hash ~ '^\$(argon2id|argon2i|argon2d|2a|2b|2y)\$'
                          OR password_hash = 'REPLACE_WITH_ARGON2_HASH'),
  display_name          TEXT NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  role                  TEXT NOT NULL REFERENCES roles(code) ON UPDATE CASCADE,
  avatar_url            TEXT CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048),
  status                user_status NOT NULL DEFAULT 'ACTIVE',
  must_change_password  BOOLEAN NOT NULL DEFAULT FALSE,
  password_changed_at   TIMESTAMPTZ,
  failed_login_count    INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at            TIMESTAMPTZ
);
-- Usernames stay reserved even after soft delete (no silent account takeover).
CREATE UNIQUE INDEX users_username_normalized_key ON users (username_normalized);
CREATE INDEX users_role_idx ON users (role) WHERE deleted_at IS NULL;
CREATE INDEX users_status_idx ON users (status) WHERE deleted_at IS NULL;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- API sign-in sessions (added in Backend Phase 2; see migrations/0002_auth_sessions.sql).
-- Only an HMAC-SHA256 of the bearer token is stored, never the token itself.
CREATE TABLE auth_sessions (
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
CREATE INDEX auth_sessions_user_active_idx ON auth_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_expires_idx ON auth_sessions (expires_at);

-- Optional student details (no email / phone / birth date / address by design).
CREATE TABLE student_profiles (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  class_label      TEXT CHECK (class_label IS NULL OR char_length(class_label) <= 60),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER student_profiles_set_updated_at BEFORE UPDATE ON student_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE student_settings (
  student_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  sound_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  volume                     NUMERIC(3,2) NOT NULL DEFAULT 0.70 CHECK (volume BETWEEN 0 AND 1),
  music_enabled              BOOLEAN NOT NULL DEFAULT FALSE,
  reduced_motion             BOOLEAN,          -- NULL = follow the device setting
  graphics_quality           graphics_quality NOT NULL DEFAULT 'MEDIUM',
  show_sensor_visualization  BOOLEAN NOT NULL DEFAULT TRUE,
  show_hints                 BOOLEAN NOT NULL DEFAULT TRUE,
  language                   TEXT NOT NULL DEFAULT 'en' CHECK (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER student_settings_set_updated_at BEFORE UPDATE ON student_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 2. Curriculum: curricula → worlds → levels (+ environments)
-- =============================================================================

CREATE TABLE curricula (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  slug         TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  TEXT,
  thumbnail    TEXT,
  status       content_status NOT NULL DEFAULT 'DRAFT',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX curricula_slug_key ON curricula (slug) WHERE deleted_at IS NULL;
CREATE INDEX curricula_status_order_idx ON curricula (status, sort_order) WHERE deleted_at IS NULL;
CREATE TRIGGER curricula_set_updated_at BEFORE UPDATE ON curricula FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3D environments the frontend knows how to render (EnvironmentRegistry ids).
-- One world ≠ one environment: every level points to its own environment.
CREATE TABLE environments (
  id           TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         TEXT NOT NULL,
  kind         environment_kind NOT NULL DEFAULT 'LEVEL',
  theme        TEXT NOT NULL CHECK (theme ~ '^[a-z0-9-]{2,40}$'),
  description  TEXT,
  config       JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  status       content_status NOT NULL DEFAULT 'DRAFT',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at   TIMESTAMPTZ
);
CREATE TRIGGER environments_set_updated_at BEFORE UPDATE ON environments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE worlds (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id      UUID NOT NULL REFERENCES curricula(id) ON DELETE RESTRICT,
  name               TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  slug               TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description  TEXT CHECK (short_description IS NULL OR char_length(short_description) <= 160),
  description        TEXT,
  theme              TEXT NOT NULL CHECK (theme ~ '^[a-z0-9-]{2,40}$'),
  accent_color       TEXT CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-fA-F]{6}$'),
  skills             TEXT[] NOT NULL DEFAULT '{}',
  difficulty         level_difficulty NOT NULL DEFAULT 'BEGINNER',
  thumbnail          TEXT,
  map_preview        TEXT,
  -- World-map diorama (kind = WORLD_PREVIEW); levels have their own environments.
  environment_id     TEXT REFERENCES environments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  map_position       JSONB CHECK (map_position IS NULL OR jsonb_typeof(map_position) = 'object'),
  sort_order         INTEGER NOT NULL DEFAULT 0,
  status             content_status NOT NULL DEFAULT 'DRAFT',
  is_visible         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at         TIMESTAMPTZ
);
CREATE UNIQUE INDEX worlds_slug_key ON worlds (slug) WHERE deleted_at IS NULL;
CREATE INDEX worlds_curriculum_order_idx ON worlds (curriculum_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX worlds_status_idx ON worlds (status) WHERE deleted_at IS NULL;
CREATE INDEX worlds_environment_idx ON worlds (environment_id);
CREATE TRIGGER worlds_set_updated_at BEFORE UPDATE ON worlds FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE levels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id            UUID NOT NULL REFERENCES worlds(id) ON DELETE RESTRICT,
  -- Stable public key, also used by the frontend in URLs ("starter-01").
  slug                TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title               TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  brief_description   TEXT CHECK (brief_description IS NULL OR char_length(brief_description) <= 200),
  description         TEXT,
  difficulty          level_difficulty NOT NULL DEFAULT 'BEGINNER',
  sort_order          INTEGER NOT NULL DEFAULT 0,
  -- Publication, visibility and unlocking are three separate controls.
  status              content_status NOT NULL DEFAULT 'DRAFT',
  visibility          level_visibility NOT NULL DEFAULT 'VISIBLE',
  access_mode         level_access_mode NOT NULL DEFAULT 'AUTO',
  thumbnail           TEXT,
  preview_image       TEXT,
  environment_id      TEXT NOT NULL REFERENCES environments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  estimated_minutes   INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes BETWEEN 1 AND 600),
  xp_reward           INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  max_stars           SMALLINT NOT NULL DEFAULT 3 CHECK (max_stars BETWEEN 0 AND 5),
  -- Star targets beyond completion.
  par_blocks          INTEGER CHECK (par_blocks IS NULL OR par_blocks > 0),
  par_seconds         NUMERIC(8,2) CHECK (par_seconds IS NULL OR par_seconds > 0),
  -- Block types allowed in the toolbox; NULL = every block.
  allowed_blocks      TEXT[],
  intro_steps         TEXT[] NOT NULL DEFAULT '{}',
  -- Data the frontend runs without hard-coding content:
  map_definition      JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(map_definition) = 'object'),
  scene_config        JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(scene_config) = 'object'),
  mission_settings    JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(mission_settings) = 'object'),
  content_version     INTEGER NOT NULL DEFAULT 1 CHECK (content_version > 0),
  published_at        TIMESTAMPTZ,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          TIMESTAMPTZ,
  CONSTRAINT levels_published_at_chk CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL)
);
CREATE UNIQUE INDEX levels_slug_key ON levels (slug) WHERE deleted_at IS NULL;
CREATE INDEX levels_world_order_idx ON levels (world_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX levels_status_idx ON levels (status, visibility) WHERE deleted_at IS NULL;
CREATE INDEX levels_environment_idx ON levels (environment_id);
CREATE TRIGGER levels_set_updated_at BEFORE UPDATE ON levels FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Stamp published_at the first time a level is published.
CREATE FUNCTION levels_stamp_published_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'PUBLISHED' AND NEW.published_at IS NULL THEN
    NEW.published_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER levels_stamp_published_at BEFORE INSERT OR UPDATE OF status ON levels FOR EACH ROW EXECUTE FUNCTION levels_stamp_published_at();

-- -----------------------------------------------------------------------------
-- Level content: checkpoints, objectives, hints
-- -----------------------------------------------------------------------------
CREATE TABLE level_checkpoints (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id     UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  code         TEXT NOT NULL CHECK (code ~ '^[a-z0-9][a-z0-9-]{0,39}$'),   -- map entity id ("cp-1")
  name         TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL CHECK (sort_order > 0),
  -- {"x": 1.2, "y": 0, "z": -4.5}; exact 3D look stays in the environment config.
  position     JSONB NOT NULL CHECK (jsonb_typeof(position) = 'object' AND position ? 'x' AND position ? 'z'),
  radius       NUMERIC(6,3) NOT NULL DEFAULT 0.22 CHECK (radius > 0),
  required     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX level_checkpoints_code_key ON level_checkpoints (level_id, code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX level_checkpoints_order_key ON level_checkpoints (level_id, sort_order) WHERE deleted_at IS NULL;
CREATE TRIGGER level_checkpoints_set_updated_at BEFORE UPDATE ON level_checkpoints FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE level_objectives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id        UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  code            TEXT NOT NULL CHECK (code ~ '^[a-z0-9][a-z0-9-]{0,39}$'),  -- mission objective id ("goal")
  title           TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  description     TEXT,
  objective_type  objective_type NOT NULL,
  checkpoint_id   UUID REFERENCES level_checkpoints(id) ON DELETE RESTRICT,
  -- Type-specific parameters, e.g. {"maxCollisions": 0} or {"seconds": 30}.
  config          JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  required        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT level_objectives_checkpoint_chk CHECK ((objective_type = 'REACH_CHECKPOINT') = (checkpoint_id IS NOT NULL))
);
CREATE UNIQUE INDEX level_objectives_code_key ON level_objectives (level_id, code) WHERE deleted_at IS NULL;
CREATE INDEX level_objectives_level_order_idx ON level_objectives (level_id, sort_order) WHERE deleted_at IS NULL;
CREATE TRIGGER level_objectives_set_updated_at BEFORE UPDATE ON level_objectives FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE level_hints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id    UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL CHECK (char_length(btrim(content)) > 0),
  cost        INTEGER NOT NULL DEFAULT 0 CHECK (cost >= 0),     -- XP spent to reveal (0 = free)
  sort_order  INTEGER NOT NULL CHECK (sort_order > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX level_hints_order_key ON level_hints (level_id, sort_order) WHERE deleted_at IS NULL;
CREATE TRIGGER level_hints_set_updated_at BEFORE UPDATE ON level_hints FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 3. Achievements (declared before unlock rules, which can require one)
-- =============================================================================
CREATE TABLE achievements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  TEXT NOT NULL,
  icon         TEXT,
  xp_reward    INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  -- Machine-readable rule, e.g. {"type": "complete_levels", "count": 10}.
  criteria     JSONB NOT NULL CHECK (jsonb_typeof(criteria) = 'object' AND criteria ? 'type'),
  is_secret    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  status       content_status NOT NULL DEFAULT 'DRAFT',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX achievements_slug_key ON achievements (slug) WHERE deleted_at IS NULL;
CREATE TRIGGER achievements_set_updated_at BEFORE UPDATE ON achievements FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 4. Level unlocking: rule groups (OR) of requirements (AND)
--
--   A level with access_mode = AUTO is unlocked when it has no rule groups, or
--   when ANY of its groups has ALL requirements met. Examples:
--     group 1: LEVEL_COMPLETED(level 2) AND LEVEL_COMPLETED(level 3)
--     group 2: TOTAL_STARS >= 5
--     group 3: ACHIEVEMENT(bridge-builder)
-- =============================================================================
CREATE TABLE level_prerequisite_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id     UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  name         TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (level_id, sort_order)
);
CREATE TRIGGER level_prerequisite_groups_set_updated_at BEFORE UPDATE ON level_prerequisite_groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE level_prerequisites (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id                UUID NOT NULL REFERENCES level_prerequisite_groups(id) ON DELETE CASCADE,
  level_id                UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,   -- the level being unlocked
  requirement_type        prerequisite_type NOT NULL,
  prerequisite_level_id   UUID REFERENCES levels(id) ON DELETE RESTRICT,
  prerequisite_world_id   UUID REFERENCES worlds(id) ON DELETE RESTRICT,
  achievement_id          UUID REFERENCES achievements(id) ON DELETE RESTRICT,
  required_stars          INTEGER CHECK (required_stars IS NULL OR required_stars >= 0),
  required_xp             INTEGER CHECK (required_xp IS NULL OR required_xp >= 0),
  required_completion     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT level_prerequisites_not_self_chk CHECK (prerequisite_level_id IS DISTINCT FROM level_id),
  CONSTRAINT level_prerequisites_shape_chk CHECK (
    CASE requirement_type
      WHEN 'LEVEL_COMPLETED' THEN prerequisite_level_id IS NOT NULL AND prerequisite_world_id IS NULL AND achievement_id IS NULL AND required_xp IS NULL
      WHEN 'LEVEL_STARS'     THEN prerequisite_level_id IS NOT NULL AND required_stars IS NOT NULL AND prerequisite_world_id IS NULL AND achievement_id IS NULL AND required_xp IS NULL
      WHEN 'WORLD_COMPLETED' THEN prerequisite_world_id IS NOT NULL AND prerequisite_level_id IS NULL AND achievement_id IS NULL AND required_stars IS NULL AND required_xp IS NULL
      WHEN 'TOTAL_STARS'     THEN required_stars IS NOT NULL AND prerequisite_level_id IS NULL AND prerequisite_world_id IS NULL AND achievement_id IS NULL AND required_xp IS NULL
      WHEN 'TOTAL_XP'        THEN required_xp IS NOT NULL AND prerequisite_level_id IS NULL AND prerequisite_world_id IS NULL AND achievement_id IS NULL AND required_stars IS NULL
      WHEN 'ACHIEVEMENT'     THEN achievement_id IS NOT NULL AND prerequisite_level_id IS NULL AND prerequisite_world_id IS NULL AND required_stars IS NULL AND required_xp IS NULL
    END)
);
-- No duplicate requirement inside a group.
CREATE UNIQUE INDEX level_prerequisites_level_req_key ON level_prerequisites (group_id, requirement_type, prerequisite_level_id) WHERE prerequisite_level_id IS NOT NULL;
CREATE UNIQUE INDEX level_prerequisites_world_req_key ON level_prerequisites (group_id, prerequisite_world_id) WHERE prerequisite_world_id IS NOT NULL;
CREATE UNIQUE INDEX level_prerequisites_achievement_req_key ON level_prerequisites (group_id, achievement_id) WHERE achievement_id IS NOT NULL;
CREATE UNIQUE INDEX level_prerequisites_total_req_key ON level_prerequisites (group_id, requirement_type) WHERE requirement_type IN ('TOTAL_STARS', 'TOTAL_XP');
CREATE INDEX level_prerequisites_level_idx ON level_prerequisites (level_id);
CREATE INDEX level_prerequisites_prereq_level_idx ON level_prerequisites (prerequisite_level_id) WHERE prerequisite_level_id IS NOT NULL;

-- Keep level_prerequisites.level_id consistent with its group.
CREATE FUNCTION level_prerequisites_check_group() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM level_prerequisite_groups g WHERE g.id = NEW.group_id AND g.level_id = NEW.level_id) THEN
    RAISE EXCEPTION 'level_prerequisites.level_id must match its group''s level' USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER level_prerequisites_check_group BEFORE INSERT OR UPDATE ON level_prerequisites FOR EACH ROW EXECUTE FUNCTION level_prerequisites_check_group();

-- =============================================================================
-- 5. Lessons (educational content, any format)
-- =============================================================================
CREATE TABLE lessons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id  UUID NOT NULL REFERENCES curricula(id) ON DELETE RESTRICT,
  world_id       UUID REFERENCES worlds(id) ON DELETE RESTRICT,
  level_id       UUID REFERENCES levels(id) ON DELETE RESTRICT,
  title          TEXT NOT NULL,
  slug           TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description    TEXT,
  content_type   lesson_content_type NOT NULL,
  -- {"markdown": "..."} · {"text": "..."} · {"url": "...", "captions": ...} · {"widget": "...", ...}
  content        JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  status         content_status NOT NULL DEFAULT 'DRAFT',
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at     TIMESTAMPTZ,
  CONSTRAINT lessons_level_needs_world_chk CHECK (level_id IS NULL OR world_id IS NOT NULL)
);
CREATE UNIQUE INDEX lessons_slug_key ON lessons (curriculum_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX lessons_world_idx ON lessons (world_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX lessons_level_idx ON lessons (level_id) WHERE deleted_at IS NULL;
CREATE TRIGGER lessons_set_updated_at BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A lesson's world must belong to its curriculum, and its level to its world.
CREATE FUNCTION lessons_check_hierarchy() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.world_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM worlds w WHERE w.id = NEW.world_id AND w.curriculum_id = NEW.curriculum_id) THEN
    RAISE EXCEPTION 'lesson world does not belong to its curriculum' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.level_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM levels l WHERE l.id = NEW.level_id AND l.world_id = NEW.world_id) THEN
    RAISE EXCEPTION 'lesson level does not belong to its world' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER lessons_check_hierarchy BEFORE INSERT OR UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION lessons_check_hierarchy();

-- =============================================================================
-- 6. Student access overrides (admin / teacher unlocks for one student)
-- =============================================================================
CREATE TABLE student_level_access (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  level_id         UUID NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  status           student_access_status NOT NULL,
  override_reason  TEXT,
  granted_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at       TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- One override row per student+level (history lives in audit_logs).
  UNIQUE (student_id, level_id)
);
CREATE INDEX student_level_access_level_idx ON student_level_access (level_id);
CREATE TRIGGER student_level_access_set_updated_at BEFORE UPDATE ON student_level_access FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 7. Programs and versions (block tree as JSONB)
-- =============================================================================
CREATE TABLE programs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  level_id        UUID NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL DEFAULT 'Main' CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- The frontend's serialized block graph ({"format": "roboverse.blocks", "version": 1, "blocks": {...}, "roots": [...]}).
  block_program   JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(block_program) = 'object'),
  python_code     TEXT,
  editor_format   TEXT NOT NULL DEFAULT 'roboverse.blocks',
  -- Latest program_versions.version_number (0 = never versioned).
  version         INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  is_submitted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT programs_size_chk CHECK (pg_column_size(block_program) <= 1048576 AND (python_code IS NULL OR octet_length(python_code) <= 262144))
);
CREATE UNIQUE INDEX programs_student_level_name_key ON programs (student_id, level_id, name) WHERE deleted_at IS NULL;
CREATE INDEX programs_student_idx ON programs (student_id) WHERE deleted_at IS NULL;
CREATE INDEX programs_level_idx ON programs (level_id) WHERE deleted_at IS NULL;
CREATE TRIGGER programs_set_updated_at BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE program_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
  version_number  INTEGER NOT NULL CHECK (version_number > 0),
  block_program   JSONB NOT NULL CHECK (jsonb_typeof(block_program) = 'object'),
  python_code     TEXT,
  source          program_version_source NOT NULL DEFAULT 'MANUAL_SAVE',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (program_id, version_number),
  -- lets submissions reference (program_id, id) and prove the version belongs to the program
  UNIQUE (program_id, id)
);

-- Save a new version atomically: bump programs.version, store the snapshot.
CREATE FUNCTION save_program_version(p_program_id UUID, p_block_program JSONB, p_python_code TEXT, p_source program_version_source DEFAULT 'MANUAL_SAVE')
RETURNS program_versions
LANGUAGE plpgsql AS $$
DECLARE
  v_version INTEGER;
  v_row program_versions;
BEGIN
  UPDATE programs
     SET version = version + 1, block_program = p_block_program, python_code = p_python_code
   WHERE id = p_program_id AND deleted_at IS NULL
  RETURNING version INTO v_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'program % not found', p_program_id USING ERRCODE = 'no_data_found';
  END IF;
  INSERT INTO program_versions (program_id, version_number, block_program, python_code, source)
  VALUES (p_program_id, v_version, p_block_program, p_python_code, p_source)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- =============================================================================
-- 8. Submissions, attempts, progress
-- =============================================================================
CREATE TABLE submissions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  level_id                UUID NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  program_id              UUID NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
  program_version_id      UUID,
  status                  submission_status NOT NULL DEFAULT 'STARTED',
  score                   INTEGER CHECK (score IS NULL OR score >= 0),
  stars                   SMALLINT CHECK (stars IS NULL OR stars BETWEEN 0 AND 5),
  xp_earned               INTEGER NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  execution_time_seconds  NUMERIC(10,3) CHECK (execution_time_seconds IS NULL OR execution_time_seconds >= 0),
  block_count             INTEGER CHECK (block_count IS NULL OR block_count >= 0),
  -- Objective results, star criteria, collisions… as reported by the simulator.
  result                  JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result) = 'object'),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at            TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  FOREIGN KEY (program_id, program_version_id) REFERENCES program_versions (program_id, id) ON DELETE RESTRICT,
  CONSTRAINT submissions_final_chk CHECK (status NOT IN ('PASSED', 'FAILED') OR completed_at IS NOT NULL)
);
CREATE INDEX submissions_student_idx ON submissions (student_id, created_at DESC);
CREATE INDEX submissions_level_idx ON submissions (level_id, status);
CREATE INDEX submissions_program_idx ON submissions (program_id);

CREATE TABLE level_attempts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  level_id                UUID NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  program_id              UUID REFERENCES programs(id) ON DELETE RESTRICT,
  program_version_id      UUID REFERENCES program_versions(id) ON DELETE RESTRICT,
  submission_id           UUID REFERENCES submissions(id) ON DELETE RESTRICT,
  attempt_number          INTEGER NOT NULL CHECK (attempt_number > 0),   -- assigned automatically when omitted
  status                  attempt_status NOT NULL DEFAULT 'RUNNING',
  score                   INTEGER CHECK (score IS NULL OR score >= 0),
  stars                   SMALLINT CHECK (stars IS NULL OR stars BETWEEN 0 AND 5),
  execution_time_seconds  NUMERIC(10,3) CHECK (execution_time_seconds IS NULL OR execution_time_seconds >= 0),
  block_count             INTEGER CHECK (block_count IS NULL OR block_count >= 0),
  collisions              INTEGER CHECK (collisions IS NULL OR collisions >= 0),
  error_message           TEXT,
  result                  JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result) = 'object'),
  -- Layout (mission_settings.variants index) and random seed the run was played with; the API judge replays exactly these (migration 0009).
  layout_index            SMALLINT NOT NULL DEFAULT 0,
  seed                    INTEGER NOT NULL DEFAULT 1,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at            TIMESTAMPTZ,
  UNIQUE (student_id, level_id, attempt_number),
  CONSTRAINT level_attempts_layout_chk CHECK (layout_index BETWEEN 0 AND 99),
  CONSTRAINT level_attempts_seed_chk CHECK (seed >= 0),
  CONSTRAINT level_attempts_times_chk CHECK (completed_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX level_attempts_student_idx ON level_attempts (student_id, started_at DESC);
CREATE INDEX level_attempts_level_idx ON level_attempts (level_id, status);
CREATE INDEX level_attempts_program_idx ON level_attempts (program_id);

-- Attempts are numbered per student+level; never overwritten.
CREATE FUNCTION level_attempts_assign_number() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.attempt_number IS NULL THEN
    -- Serialize concurrent inserts for the same student+level.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.student_id::text || ':' || NEW.level_id::text, 0));
    SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO NEW.attempt_number
      FROM level_attempts WHERE student_id = NEW.student_id AND level_id = NEW.level_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER level_attempts_assign_number BEFORE INSERT ON level_attempts FOR EACH ROW EXECUTE FUNCTION level_attempts_assign_number();

CREATE TABLE student_level_progress (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  level_id             UUID NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  status               progress_status NOT NULL DEFAULT 'NOT_STARTED',
  best_score           INTEGER CHECK (best_score IS NULL OR best_score >= 0),
  best_stars           SMALLINT NOT NULL DEFAULT 0 CHECK (best_stars BETWEEN 0 AND 5),
  best_time_seconds    NUMERIC(10,3) CHECK (best_time_seconds IS NULL OR best_time_seconds >= 0),
  attempt_count        INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  hints_used           INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  first_started_at     TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  last_attempt_at      TIMESTAMPTZ,
  last_program_id      UUID REFERENCES programs(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, level_id),
  CONSTRAINT student_level_progress_completed_chk CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
);
CREATE INDEX student_level_progress_level_idx ON student_level_progress (level_id, status);
CREATE TRIGGER student_level_progress_set_updated_at BEFORE UPDATE ON student_level_progress FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE student_objective_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  objective_id      UUID NOT NULL REFERENCES level_objectives(id) ON DELETE RESTRICT,
  completed         BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at      TIMESTAMPTZ,
  first_attempt_id  UUID REFERENCES level_attempts(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, objective_id),
  CONSTRAINT student_objective_progress_completed_chk CHECK (completed = (completed_at IS NOT NULL))
);
CREATE INDEX student_objective_progress_objective_idx ON student_objective_progress (objective_id);
CREATE TRIGGER student_objective_progress_set_updated_at BEFORE UPDATE ON student_objective_progress FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE student_hint_usage (
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  hint_id     UUID NOT NULL REFERENCES level_hints(id) ON DELETE RESTRICT,
  xp_cost     INTEGER NOT NULL DEFAULT 0 CHECK (xp_cost >= 0),
  used_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, hint_id)
);
CREATE INDEX student_hint_usage_hint_idx ON student_hint_usage (hint_id);

-- =============================================================================
-- 9. Rewards: stats (cached totals), XP ledger, star ledger, achievements
-- =============================================================================
CREATE TABLE student_stats (
  student_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  total_xp          INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  total_stars       INTEGER NOT NULL DEFAULT 0 CHECK (total_stars >= 0),
  levels_completed  INTEGER NOT NULL DEFAULT 0 CHECK (levels_completed >= 0),
  current_streak    INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak    INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_active_date  DATE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX student_stats_xp_idx ON student_stats (total_xp DESC);
CREATE TRIGGER student_stats_set_updated_at BEFORE UPDATE ON student_stats FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Every XP change is a ledger row (auditable); totals follow via trigger.
CREATE TABLE xp_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount       INTEGER NOT NULL CHECK (amount <> 0),
  source_type  xp_source_type NOT NULL,
  source_id    UUID,                   -- level / achievement / hint / submission id
  description  TEXT NOT NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,   -- admin for manual adjustments
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX xp_transactions_student_idx ON xp_transactions (student_id, created_at DESC);
-- A level completion / achievement / hint purchase can only pay out once.
CREATE UNIQUE INDEX xp_transactions_once_key ON xp_transactions (student_id, source_type, source_id)
  WHERE source_type IN ('LEVEL_COMPLETION', 'ACHIEVEMENT', 'HINT_PURCHASE');

CREATE TABLE star_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  level_id       UUID NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  submission_id  UUID REFERENCES submissions(id) ON DELETE SET NULL,
  source_type    star_source_type NOT NULL DEFAULT 'LEVEL_RESULT',
  stars_before   SMALLINT NOT NULL CHECK (stars_before BETWEEN 0 AND 5),
  stars_after    SMALLINT NOT NULL CHECK (stars_after BETWEEN 0 AND 5),
  delta          SMALLINT GENERATED ALWAYS AS (stars_after - stars_before) STORED,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT star_transactions_change_chk CHECK (stars_after <> stars_before)
);
CREATE INDEX star_transactions_student_idx ON star_transactions (student_id, created_at DESC);
CREATE INDEX star_transactions_level_idx ON star_transactions (level_id);

CREATE TABLE student_achievements (
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  achievement_id  UUID NOT NULL REFERENCES achievements(id) ON DELETE RESTRICT,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  context         JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context) = 'object'),
  PRIMARY KEY (student_id, achievement_id)
);
CREATE INDEX student_achievements_achievement_idx ON student_achievements (achievement_id);

-- Ledgers keep student_stats in sync (totals can never drift from history).
CREATE FUNCTION apply_xp_transaction() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- The inserted row must satisfy the CHECKs even when the amount is negative (spending).
  INSERT INTO student_stats (student_id, total_xp) VALUES (NEW.student_id, GREATEST(NEW.amount, 0))
  ON CONFLICT (student_id) DO UPDATE SET total_xp = student_stats.total_xp + NEW.amount;
  RETURN NEW;
END;
$$;
CREATE TRIGGER xp_transactions_apply AFTER INSERT ON xp_transactions FOR EACH ROW EXECUTE FUNCTION apply_xp_transaction();

CREATE FUNCTION apply_star_transaction() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO student_stats (student_id, total_stars) VALUES (NEW.student_id, GREATEST(NEW.stars_after - NEW.stars_before, 0))
  ON CONFLICT (student_id) DO UPDATE SET total_stars = student_stats.total_stars + (NEW.stars_after - NEW.stars_before);
  RETURN NEW;
END;
$$;
CREATE TRIGGER star_transactions_apply AFTER INSERT ON star_transactions FOR EACH ROW EXECUTE FUNCTION apply_star_transaction();

CREATE FUNCTION count_level_completion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_delta INTEGER := 0;
BEGIN
  IF NEW.status = 'COMPLETED' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'COMPLETED') THEN
    v_delta := 1;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'COMPLETED' AND NEW.status <> 'COMPLETED' THEN
    v_delta := -1;
  END IF;
  IF v_delta <> 0 THEN
    INSERT INTO student_stats (student_id, levels_completed) VALUES (NEW.student_id, GREATEST(v_delta, 0))
    ON CONFLICT (student_id) DO UPDATE SET levels_completed = student_stats.levels_completed + v_delta;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER student_level_progress_count_completion AFTER INSERT OR UPDATE OF status ON student_level_progress FOR EACH ROW EXECUTE FUNCTION count_level_completion();

-- =============================================================================
-- 10. Admin audit log (append-only)
-- =============================================================================
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL CHECK (action ~ '^[A-Z][A-Z0-9_]{1,63}$'),   -- e.g. UNLOCK_LEVEL
  entity_type  TEXT NOT NULL CHECK (entity_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  entity_id    TEXT,                -- uuid or text key (environments use text ids)
  old_data     JSONB,
  new_data     JSONB,
  ip_address   INET,
  user_agent   TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
  request_id   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX audit_logs_admin_idx ON audit_logs (admin_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);

CREATE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

-- =============================================================================
-- 11. Effective level state for a student
--
--   Priority (highest first):
--     1. hidden / unpublished (level, world or curriculum) → not returned
--     2. admin override DISABLED                           → DISABLED
--     3. admin override LOCKED                             → LOCKED
--     4. completed (progress or override COMPLETED)        → COMPLETED
--     5. admin override AVAILABLE                          → AVAILABLE / IN_PROGRESS
--     6. level access_mode LOCKED / UNLOCKED               → LOCKED / AVAILABLE
--     7. AUTO: no rule groups, or any group fully met      → AVAILABLE / IN_PROGRESS, else LOCKED
-- =============================================================================
CREATE FUNCTION get_student_level_states(p_student_id UUID)
RETURNS TABLE (level_id UUID, level_slug TEXT, world_id UUID, curriculum_id UUID, state level_state, reason TEXT)
LANGUAGE sql STABLE AS $$
  WITH visible_levels AS (
    SELECT l.id, l.slug, l.world_id, w.curriculum_id, l.access_mode
      FROM levels l
      JOIN worlds w    ON w.id = l.world_id
      JOIN curricula c ON c.id = w.curriculum_id
     WHERE l.deleted_at IS NULL AND w.deleted_at IS NULL AND c.deleted_at IS NULL
       AND l.status = 'PUBLISHED' AND w.status = 'PUBLISHED' AND c.status = 'PUBLISHED'
       AND l.visibility = 'VISIBLE' AND w.is_visible
  ),
  progress AS (
    SELECT p.level_id, p.status, p.best_stars FROM student_level_progress p WHERE p.student_id = p_student_id
  ),
  totals AS (
    SELECT COALESCE(MAX(s.total_stars), 0) AS total_stars, COALESCE(MAX(s.total_xp), 0) AS total_xp
      FROM student_stats s WHERE s.student_id = p_student_id
  ),
  overrides AS (
    SELECT a.level_id, a.status FROM student_level_access a
     WHERE a.student_id = p_student_id AND a.revoked_at IS NULL
       AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)
  ),
  requirement_results AS (
    SELECT r.group_id,
           CASE r.requirement_type
             WHEN 'LEVEL_COMPLETED' THEN EXISTS (
               SELECT 1 FROM progress p WHERE p.level_id = r.prerequisite_level_id
                  AND (NOT r.required_completion OR p.status = 'COMPLETED')
                  AND p.best_stars >= COALESCE(r.required_stars, 0))
             WHEN 'LEVEL_STARS' THEN EXISTS (
               SELECT 1 FROM progress p WHERE p.level_id = r.prerequisite_level_id AND p.best_stars >= r.required_stars)
             WHEN 'WORLD_COMPLETED' THEN NOT EXISTS (
               SELECT 1 FROM levels l2
                WHERE l2.world_id = r.prerequisite_world_id AND l2.deleted_at IS NULL AND l2.status = 'PUBLISHED'
                  AND NOT EXISTS (SELECT 1 FROM progress p WHERE p.level_id = l2.id AND p.status = 'COMPLETED'))
             WHEN 'TOTAL_STARS' THEN (SELECT t.total_stars FROM totals t) >= r.required_stars
             WHEN 'TOTAL_XP'    THEN (SELECT t.total_xp FROM totals t) >= r.required_xp
             WHEN 'ACHIEVEMENT' THEN EXISTS (
               SELECT 1 FROM student_achievements sa WHERE sa.student_id = p_student_id AND sa.achievement_id = r.achievement_id)
           END AS met
      FROM level_prerequisites r
  ),
  group_results AS (
    SELECT g.level_id, g.id, COALESCE(bool_and(rr.met), TRUE) AS met
      FROM level_prerequisite_groups g
      LEFT JOIN requirement_results rr ON rr.group_id = g.id
     GROUP BY g.level_id, g.id
  ),
  rules AS (
    SELECT gr.level_id, bool_or(gr.met) AS met FROM group_results gr GROUP BY gr.level_id
  )
  SELECT v.id, v.slug, v.world_id, v.curriculum_id,
         CASE
           WHEN o.status = 'DISABLED' THEN 'DISABLED'
           WHEN o.status = 'LOCKED' THEN 'LOCKED'
           WHEN p.status = 'COMPLETED' OR o.status = 'COMPLETED' THEN 'COMPLETED'
           WHEN o.status = 'AVAILABLE' OR v.access_mode = 'UNLOCKED' OR (v.access_mode = 'AUTO' AND COALESCE(ru.met, TRUE))
             THEN CASE WHEN p.status = 'IN_PROGRESS' THEN 'IN_PROGRESS' ELSE 'AVAILABLE' END
           ELSE 'LOCKED'
         END::level_state,
         CASE
           WHEN o.status IS NOT NULL THEN 'ADMIN_OVERRIDE'
           WHEN p.status = 'COMPLETED' THEN 'COMPLETED'
           WHEN v.access_mode = 'LOCKED' THEN 'LOCKED_BY_ADMIN'
           WHEN v.access_mode = 'UNLOCKED' THEN 'OPEN_FOR_ALL'
           WHEN ru.level_id IS NULL THEN 'NO_PREREQUISITES'
           WHEN ru.met THEN 'PREREQUISITES_MET'
           ELSE 'PREREQUISITES_NOT_MET'
         END
    FROM visible_levels v
    LEFT JOIN progress p  ON p.level_id = v.id
    LEFT JOIN overrides o ON o.level_id = v.id
    LEFT JOIN rules ru    ON ru.level_id = v.id;
$$;

-- =============================================================================
-- 12. Reporting views for the admin dashboard
-- =============================================================================
CREATE VIEW v_level_statistics AS
SELECT l.id AS level_id,
       l.slug,
       l.title,
       w.name AS world_name,
       COUNT(a.id)                                         AS attempts,
       COUNT(DISTINCT a.student_id)                        AS students_attempted,
       COUNT(a.id) FILTER (WHERE a.status = 'PASSED')      AS passed_attempts,
       ROUND(100.0 * COUNT(a.id) FILTER (WHERE a.status = 'PASSED') / NULLIF(COUNT(a.id), 0), 1) AS pass_rate_percent,
       (SELECT COUNT(*) FROM student_level_progress p WHERE p.level_id = l.id AND p.status = 'COMPLETED') AS students_completed,
       (SELECT ROUND(AVG(p.best_stars), 2) FROM student_level_progress p WHERE p.level_id = l.id AND p.status = 'COMPLETED') AS avg_best_stars
  FROM levels l
  JOIN worlds w ON w.id = l.world_id
  LEFT JOIN level_attempts a ON a.level_id = l.id
 WHERE l.deleted_at IS NULL
 GROUP BY l.id, l.slug, l.title, w.name;

CREATE VIEW v_student_overview AS
SELECT u.id AS student_id,
       u.username,
       u.display_name,
       u.status,
       u.last_login_at,
       COALESCE(s.total_xp, 0)          AS total_xp,
       COALESCE(s.total_stars, 0)       AS total_stars,
       COALESCE(s.levels_completed, 0)  AS levels_completed,
       COALESCE(s.current_streak, 0)    AS current_streak,
       (SELECT MAX(a.started_at) FROM level_attempts a WHERE a.student_id = u.id) AS last_attempt_at
  FROM users u
  LEFT JOIN student_stats s ON s.student_id = u.id
 WHERE u.role = 'STUDENT' AND u.deleted_at IS NULL;

COMMIT;
