# OneRoboLab — entity relationships

30 tables · 2 views · 3 functions for application use. Arrows point from the parent to its children (1 → many unless marked).

## Identity & access

```
roles ──< role_permissions >── permissions
  │
  └──< users (role)                          one role per user; new roles are rows
         ├── student_profiles      (1:1)     class label / notes — no email, phone, birth date
         ├── student_settings      (1:1)     sound, volume, quality, reduced motion, hints, language
         ├── student_stats         (1:1)     cached totals (maintained by ledger triggers)
         ├──< student_level_progress         one row per student × level
         ├──< student_level_access           admin overrides (unlock / lock / disable one level)
         ├──< student_objective_progress     one row per student × objective
         ├──< programs ──< program_versions
         ├──< submissions
         ├──< level_attempts
         ├──< xp_transactions                XP ledger
         ├──< star_transactions              star ledger
         ├──< student_achievements >── achievements
         ├──< student_hint_usage   >── level_hints
         └──< audit_logs (admin_id)          append-only
```

## Curriculum & content

```
curricula
 ├──< worlds ──── environments (world-map diorama, kind = WORLD_PREVIEW)
 │     └──< levels ─── environments (each level its own, kind = LEVEL)
 │            ├──< level_checkpoints
 │            ├──< level_objectives ── level_checkpoints (for REACH_CHECKPOINT)
 │            ├──< level_hints
 │            └──< level_prerequisite_groups ──< level_prerequisites
 │                                                 ├── prerequisite level
 │                                                 ├── prerequisite world
 │                                                 └── achievement
 └──< lessons (optionally scoped to a world and a level)
```

## Student work

```
levels ─┐
users ──┴──< programs ──< program_versions
                 │               │
                 └──< submissions ┘ (program_version must belong to the program)
                         │
level_attempts ──────────┘ (optional link to the submission it produced)
student_level_progress.last_program_id ── programs
star_transactions.submission_id ── submissions
student_objective_progress.first_attempt_id ── level_attempts
```

## Key design decisions

| Topic | Design |
|---|---|
| **Usernames** | `username` keeps the student's casing. `username_normalized = lower(username)` is a stored generated column with a unique index, so matching is case-insensitive and usernames stay reserved after soft delete. |
| **Passwords** | Only `password_hash`. A CHECK accepts Argon2 or bcrypt formats, or the non-verifiable seed placeholder, so plaintext is rejected. No tokens or sessions are stored. |
| **Roles** | `roles` and `permissions` are data. TEACHER, CONTENT_EDITOR and SUPER_ADMIN exist without schema changes. `users.role` references `roles.code`. |
| **Curriculum** | curricula → worlds → levels. Human-readable names and slugs; no course codes. Level `slug` (e.g. `starter-01`) is the stable key the frontend uses. |
| **Unique environments** | `levels.environment_id` is required (FK to `environments`), so one world can hold many different places. `worlds.environment_id` is the world-map diorama. |
| **Level data** | Everything the frontend needs lives on the level as JSONB: `map_definition` (physics map), `scene_config` (road, bridges, water), `mission_settings`, plus `allowed_blocks`, `intro_steps` and star targets (`par_blocks`, `par_seconds`). Objectives, checkpoints and hints are rows so admins can edit them. |
| **Publication vs unlock** | Three independent controls on a level: `status` (DRAFT, PUBLISHED, ARCHIVED), `visibility` (VISIBLE, HIDDEN) and `access_mode` (AUTO = unlock rules decide, UNLOCKED, LOCKED). A level can be published and visible but still locked. |
| **Unlock rules** | A level unlocks when **any** `level_prerequisite_groups` row has **all** of its `level_prerequisites` met (OR of ANDs). Requirement types: LEVEL_COMPLETED (optionally with minimum stars), LEVEL_STARS, WORLD_COMPLETED, TOTAL_STARS, TOTAL_XP, ACHIEVEMENT. A CHECK enforces the right columns per type; unique indexes prevent duplicate requirements; self-prerequisites are rejected. |
| **Per-student overrides** | `student_level_access` (LOCKED, AVAILABLE, COMPLETED, DISABLED), with reason, granting admin, optional expiry and revocation. History lives in `audit_logs`. |
| **Effective state** | `get_student_level_states(student)`. Priority: hidden or unpublished (not returned) → override DISABLED → override LOCKED → completed → override AVAILABLE → access mode → unlock rules. It returns a `reason` so the UI can explain why a level is locked. |
| **Programs** | The block graph is JSONB (the frontend's serialized format) with optional `python_code`. `programs.version` points at the latest `program_versions.version_number`. `save_program_version()` bumps the version and snapshots it atomically. Size limits are enforced by CHECK. |
| **Attempts vs submissions** | `level_attempts` records every run (numbered automatically per student and level, never overwritten). `submissions` records "I solved it" events tied to an exact program version. |
| **Progress** | `student_level_progress` (NOT_STARTED, IN_PROGRESS, COMPLETED; best score, stars and time; attempt count). A CHECK ties `completed_at` to COMPLETED. |
| **Rewards** | XP and stars are ledgers (`xp_transactions`, `star_transactions`). Triggers keep `student_stats` totals in sync, a completion can pay out only once, and totals can't go negative. `levels_completed` follows progress changes. |
| **Achievements** | `criteria` JSONB (e.g. `{"type":"complete_levels","count":1}`) is evaluated by the backend. Unlocks are unique per student. |
| **Lessons** | `content_type` (TEXT, MARKDOWN, VIDEO, IMAGE, INTERACTIVE) with a JSONB `content` payload, so new formats need no schema change. A trigger checks that the lesson's world belongs to its curriculum and its level to its world. |
| **Audit** | `audit_logs` records the admin, action (e.g. `UNLOCK_LEVEL`), entity, old and new data (JSONB), IP (INET), user agent and request id. It is append-only, enforced by a trigger. |
| **Soft delete** | `deleted_at` on users, curricula, worlds, levels, checkpoints, objectives, hints, lessons, achievements, environments and programs. Slug uniqueness ignores deleted rows (partial unique indexes). |
| **Student history safety** | Every foreign key from student data to users or content is RESTRICT. Pure content children cascade only with their level, and only when no student row references them. |
| **Timestamps** | `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP` everywhere. A shared `set_updated_at()` trigger maintains `updated_at`. `levels.published_at` is stamped on first publish. |

## Views

- `v_level_statistics`: attempts, pass rate, students completed and average best stars per level.
- `v_student_overview`: XP, stars, levels completed, streak and last activity per student.

## Main indexes (beyond primary and unique keys)

- **users:** `username_normalized` (unique), `role`, `status`.
- **curriculum:** `worlds (curriculum_id, sort_order)`, `levels (world_id, sort_order)`, `levels (status, visibility)`, `levels.environment_id`, slug uniques on curricula, worlds, levels, achievements and lessons.
- **unlocking:** `level_prerequisites.level_id` and `prerequisite_level_id`, plus four partial uniques against duplicate requirements.
- **student work:** `programs (student_id)`, `programs (level_id)`, `programs (student_id, level_id, name)` (unique); `submissions (student_id, created_at)`, `submissions (level_id, status)`, `submissions.program_id`; `level_attempts (student_id, started_at)`, `level_attempts (level_id, status)`, `level_attempts.program_id`; `student_level_progress (level_id, status)`, plus the unique `(student_id, level_id)`.
- **rewards:** `xp_transactions (student_id, created_at)` and the pay-once partial unique; `star_transactions (student_id, created_at)`; `student_stats.total_xp`.
- **audit:** `audit_logs (admin_id, created_at)`, `(entity_type, entity_id, created_at)` and `created_at`.
