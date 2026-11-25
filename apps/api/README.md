# OneRoboLab API (`@robolab/api`)

Authentication, role-based access and the database API for OneRoboLab.
Fastify 5 · zod · node-postgres · Argon2id · PostgreSQL (Neon) · deployed on Render.

```
pnpm --filter @robolab/api dev      # http://localhost:3000 (needs apps/api/.env)
pnpm dev:api:memory                 # same API on an in-memory, freshly seeded database (no Neon needed);
                                    # prints random admin/student passwords (or set DEV_ADMIN_PASSWORD / DEV_STUDENT_PASSWORD)
pnpm --filter @robolab/api build    # typecheck only (tsc --noEmit); nothing is emitted
pnpm --filter @robolab/api start    # node src/server.ts (Node >= 22.18 strips types; no dist)
pnpm test                           # includes the API tests (real PostgreSQL via PGlite)
```

## Layout

```
src/
  server.ts              entry: config → pg pool → app → listen, graceful shutdown
  app.ts                 Fastify setup: helmet, CORS, rate limits, error envelope, route registration
  config.ts              environment (zod-validated; nothing hard-coded)
  db/db.ts               Db interface (query / tx / ping) + pg Pool implementation
  auth/
    passwords.ts         Argon2id hash/verify (constant effort), password policy
    sessions.ts          opaque bearer tokens; DB stores HMAC-SHA256(AUTH_SECRET, token)
    guard.ts             authenticate hook, permissions (role_permissions table), requireRole
  domain/
    program.ts           block-program validation (shape, size, depth, cycles, allowed blocks) + block count
    workflow.ts          publishing workflow DRAFT → REVIEW → PUBLISHED → ARCHIVED (allowed moves)
    level-readiness.ts   publish checks, prerequisite groups with names
    scoring.ts           server-side pass/fail, stars, score + plausibility checks
    levels.ts            level access (get_student_level_states), level rules
    rewards.ts           streaks, achievement evaluation
  http/                  errors (envelope), audit log, SQL helpers (parameterised only)
  routes/                health · auth · student · admin-students · admin-curriculum · admin-content
  cli/set-password.ts    set a user's password from stdin (first admin password)
  dev/                   in-memory PGlite database + dev server (dev only, never used in production)
  test/harness.ts        PGlite database with schema.sql + seed.sql for tests
```

## Authentication

- `POST /api/auth/login` `{username, password}` → `{token, tokenType: "Bearer", expiresAt, user}`.
  Send `Authorization: Bearer <token>` on every other request. No cookies → no CSRF surface.
- The token is 32 random bytes. The database stores only `HMAC-SHA256(AUTH_SECRET, token)` in
  `auth_sessions`; a leaked database cannot be replayed as a login.
- Sessions last `SESSION_TTL_HOURS` (default 7 days). Logout, password change, admin password
  reset and disabling an account revoke sessions immediately.
- Passwords: Argon2id (19 MiB, t=2, p=1). Unknown users / placeholder hashes still cost one
  verification, so timing doesn't reveal which usernames exist. Wrong password and unknown user
  return the same 401.
- Lockout: 5 wrong passwords → account locked for 15 minutes. Plus `LOGIN_RATE_LIMIT` attempts
  per IP per `LOGIN_RATE_WINDOW_MINUTES` (429).
- `must_change_password` accounts can only call `/api/auth/me`, `/logout` and `/change-password`
  (403 `PASSWORD_CHANGE_REQUIRED`) until they choose a new password.
- `password_hash` is never selected by any API query except the login/password check.

## Roles and permissions (RBAC)

Permissions come from the `role_permissions` table (cached 60 s), so new roles need no code:

| Permission | ADMIN | TEACHER | CONTENT_EDITOR | STUDENT |
|---|:-:|:-:|:-:|:-:|
| `students.view` · `progress.view` · `levels.unlock` | ✓ | ✓ | | |
| `students.manage` | ✓ | | | |
| `curriculum.manage` · `content.manage` · `achievements.manage` | ✓ | | ✓ | |
| `levels.publish` · `audit.view` | ✓ | | | |
| `statistics.view` | ✓ | ✓ | ✓ | |

Student routes (`/api/curriculum`, `/api/levels/*`, `/api/me/*`) require role `STUDENT` and always
use the id from the session. No student route takes a student id, so a student cannot address
another student's data.

## Endpoints

Errors always look like `{"error": {"code": "LEVEL_LOCKED", "message": "…", "details"?: …}}`:
400 `VALIDATION_FAILED`/`INVALID_JSON` · 401 `UNAUTHENTICATED`/`INVALID_CREDENTIALS` · 403 `FORBIDDEN`/`LEVEL_LOCKED`/`ACCOUNT_DISABLED`/`PASSWORD_CHANGE_REQUIRED` ·
404 `NOT_FOUND` · 409 `CONFLICT`/`PROGRAM_REQUIRED`/`NOT_ENOUGH_XP` · 413 · 422 `PROGRAM_INVALID`/`BLOCK_NOT_ALLOWED`/`IMPLAUSIBLE_RESULT`/`LEVEL_NOT_READY`/`PREREQUISITE_CYCLE` · 429 · 500 `INTERNAL_ERROR` (no internals leaked).

**Public:** `GET /health` → `{"status":"ok","database":"ok"}` (503 `degraded` if the DB is unreachable) · `POST /api/auth/login`

**Session:** `GET /api/auth/me` · `POST /api/auth/logout` · `POST /api/auth/change-password`

**Student** (`:levelId` = UUID or slug such as `starter-01`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/curriculum` | published curricula → worlds → levels with `state` + `lockReason` + own progress |
| GET | `/api/worlds` · `/api/worlds/:id` | world summaries / one world with its levels |
| GET | `/api/levels/:levelId` | full content when playable; locked levels return only the card |
| POST | `/api/levels/:levelId/hints/:hintId/reveal` | free hints are visible already; paid hints spend XP once |
| GET/PUT | `/api/levels/:levelId/program` | `{blockProgram, pythonCode?, createVersion?}` — validated, stored as "Main" |
| POST | `/api/levels/:levelId/attempts` | `{status, result}` — logged, numbered, never rewarded |
| POST | `/api/levels/:levelId/submissions` | `{result}` — server scores; completion, stars, XP, achievements, unlocks |
| GET | `/api/catalog` | the whole journey in one request: student, totals, worlds (journey order), levels with state, lock reason + unlock rules (locked), progress, map/scene preview, and content (objectives, hints — paid ones hidden — allowed blocks, intro, mission settings) only for playable levels |
| POST | `/api/levels/:levelId/runs` | Run pressed: needs a saved program; closes an unfinished run of the level (ABORTED); creates a RUNNING attempt with a program snapshot; body `{layout, seed}` (layout index and seed the browser used; stored in `level_attempts.layout_index` / `seed`); counts the attempt |
| POST | `/api/runs/:runId/finish` | `{outcome: COMPLETED\|FAILED\|ERROR\|STOPPED, result}` — own RUNNING runs only (else 404 / 409); the server replays the program (see "The run judge") and scores what it observed; only COMPLETED runs can pass; returns stars, XP, objectives (with titles), achievements, unlocked levels, totals |
| GET | `/api/me/progress` · `/api/me/achievements` · `/api/lessons` | |
| GET/PUT | `/api/me/settings` | |

`result` = `{objectivesCompleted: string[], timeSeconds, collisions, errorMessage?}`. This is all a client can report.

**Admin**

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/api/admin/students` (`?search&status&page&pageSize`) | view / manage |
| GET/PATCH | `/api/admin/students/:id` (`displayName, status, avatarUrl, classLabel, notes, clearLoginLock`) | view / manage |
| POST | `/api/admin/students/:id/reset-password` | `students.manage` |
| GET | `/api/admin/students/:id/progress` · `/attempts` · `/programs` · `/api/admin/programs/:id` | `progress.view` |
| POST | `/api/admin/students/:studentId/levels/:levelId/unlock` · `/lock` (`{reason?, expiresAt?}`) | `levels.unlock` |
| DELETE | `/api/admin/students/:studentId/levels/:levelId/access` (back to normal rules) | `levels.unlock` |
| GET | `/api/admin/dashboard` (totals, attempts per day, recent activity) · `/api/admin/statistics?days=` | `statistics.view` |
| GET | `/api/admin/attempts` (`?studentId&levelId&programId&status&search&from&to&page`) · `/api/admin/attempts/:id` (with the exact program version and objectives) | `progress.view` |
| GET | `/api/admin/programs` (`?studentId&levelId&search&submitted&page`) | `progress.view` |
| GET/POST, PATCH | `/api/admin/curriculums`, `/api/admin/curriculums/:id` | `curriculum.manage` |
| GET/POST, GET/PATCH | `/api/admin/worlds`, `/api/admin/worlds/:id` | `curriculum.manage` |
| GET/POST, GET/PATCH/DELETE | `/api/admin/levels`, `/api/admin/levels/:id` (new levels are DRAFT) | `curriculum.manage` (+ `levels.publish` for `visibility`/`accessMode`) |
| GET | `/api/admin/levels/graph` (every level with unlock rules, for graphs and pickers) | any of `curriculum.manage`, `levels.unlock`, `progress.view` |
| GET | `/api/admin/levels/:id/access` (per-student overrides on a level) | `levels.unlock` |
| POST | `/api/admin/{curriculums,worlds,levels,lessons,achievements}/:id/status` (`{status, note?}`) | the area's manage permission; moves into/out of PUBLISHED also need `levels.publish` (curricula, worlds, levels) |
| POST | `/api/admin/levels/:id/publish` · `/unpublish` (shortcuts; publish requires REVIEW) | `levels.publish` |
| PUT | `/api/admin/curriculums/order` · `/worlds/order` (`{curriculumId, ids}`) · `/levels/order` (`{worldId, ids}`) · `/levels/:id/objectives/order` · `/levels/:id/hints/order` | `curriculum.manage` |
| POST, PATCH/DELETE | `/api/admin/levels/:id/checkpoints` · `/objectives` · `/hints`, `/api/admin/{checkpoints,objectives,hints}/:id` | `curriculum.manage` |
| GET/PUT | `/api/admin/levels/:id/prerequisites` (`{groups:[{requirements:[…]}]}`) | `curriculum.manage` |
| GET | `/api/admin/environments` | `curriculum.manage` |
| GET/POST, PATCH/DELETE | `/api/admin/lessons`, `/api/admin/lessons/:id` | `content.manage` |
| GET/POST, PATCH/DELETE | `/api/admin/achievements`, `/api/admin/achievements/:id` | `achievements.manage` |
| GET | `/api/admin/statistics` | `statistics.view` |
| GET | `/api/admin/audit-logs` (`?action&entityType&entityId&adminId&page`) | `audit.view` |

**Publishing workflow.** Curricula, worlds, levels, lessons and achievements move
`DRAFT → REVIEW → PUBLISHED → ARCHIVED` only through the `/status` endpoints (status is never
accepted by create or PATCH). Allowed moves: DRAFT→REVIEW|ARCHIVED, REVIEW→PUBLISHED|DRAFT|ARCHIVED,
PUBLISHED→DRAFT|ARCHIVED, ARCHIVED→DRAFT; anything else is 409 `INVALID_TRANSITION` with the
allowed moves. A level can only be published when it is playable (422 `LEVEL_NOT_READY`).
Content editors can send for review; reviewers with `levels.publish` approve. Students only ever
see PUBLISHED content. Audit actions: `REVIEW_*`, `REJECT_*`, `PUBLISH_*`, `UNPUBLISH_*`,
`ARCHIVE_*`, `RESTORE_*` (with the optional note).

Every admin mutation writes an `audit_logs` row **in the same transaction** (`CREATE_STUDENT`,
`DISABLE_STUDENT`, `RESET_PASSWORD`, `CREATE_LEVEL`, `UPDATE_LEVEL`, `PUBLISH_LEVEL`,
`UNPUBLISH_LEVEL`, `UNLOCK_LEVEL`, `LOCK_LEVEL`, …). Passwords never appear in audit data.

## Level access (decided by the server)

`get_student_level_states(student)` (SQL function) returns the effective state per level:

1. Level, world or curriculum not published, or level hidden → not returned → **404**.
2. Admin override `DISABLED` / `LOCKED` → **DISABLED / LOCKED**.
3. Completed → **COMPLETED**.
4. Admin override `AVAILABLE` → **AVAILABLE / IN_PROGRESS**.
5. Level `access_mode` `LOCKED` / `UNLOCKED`.
6. `AUTO`: any prerequisite group fully met (or no groups) → **AVAILABLE / IN_PROGRESS**, else **LOCKED** (`PREREQUISITES_NOT_MET`).

Saving, running and submitting a LOCKED/DISABLED level → 403 `LEVEL_LOCKED` with `{state, reason}`.

## Programs and scoring (anti-cheat)

- Programs must be the editor's `roboverse.blocks` v1 format. Limits: 200 KB, 500 blocks, depth 32,
  50 scripts, 50 variables, strings 200 chars, comments 500, Python 64 KB. References must resolve,
  each block has one parent, no cycles, no detached blocks, a start block, known block types only,
  and only the level's `allowed_blocks`. Reserved keys (`__proto__`…) are refused. Only the parsed,
  validated program is stored.
- Submissions: the server snapshots the stored program (version), counts its blocks itself, loads
  the level's rules and computes pass/fail, stars (complete · ≤ par blocks · ≤ par time), score and
  XP. Collisions decide "avoid collisions"; unknown objectives and physically impossible times
  (faster than the robot's top speed along start → checkpoints → goal) → 422 `IMPLAUSIBLE_RESULT`.
  Extra fields such as `stars` or `xp` → 400. START_PROGRAM objectives are met by any recorded
  run, USE_MAX_BLOCKS uses the server's block count, and CUSTOM objectives (not verifiable) never
  block a pass.
- XP is paid through the `xp_transactions` ledger; a unique index makes level-completion XP payable
  once. Stars are recorded only when the best improves.
- The run itself happens in the browser, but the server no longer trusts its report (next section).

## The run judge

`src/domain/judge.ts` runs on `POST /api/runs/:id/finish` (and the older attempts / submissions
routes). It re-compiles the stored program version (`@robolab/blocks`) and replays it headless
(`runHeadless` from `@robolab/simulation`) on the stored level, layout and seed; stars, score and
XP come from what the judge observed. The browser's report is kept as `result.reported`, the
judge's as `result.judged`, and `result.judge` holds layout, seed, outcome, ticks and the list of
mismatches. Budget: 600 simulated seconds per judged run, also bounded by wall-clock time since the
run started + 5 s. Existing databases need `database/migrations/0009_run_judge.sql`.

## Security summary

Helmet headers (CSP `default-src 'none'`), CORS allow-list (`CORS_ORIGIN`), body limit 512 KB
(program PUT 320 KB), global rate limit 600/min/IP + login limit, strict zod schemas on every body,
query and param (unknown keys rejected), parameterised SQL only (identifiers come from code),
prototype-poisoning protection, Authorization header redacted from logs, `trustProxy` for
Render's proxy, generic 500s.

## Deploy on Render (with Neon)

1. **Database:** create the Neon database, then run `database/schema.sql` and `database/seed.sql`
   (see `database/README.md`). An existing Phase 1 database needs
   `database/migrations/0002_auth_sessions.sql` instead of re-running the schema.
2. **Blueprint:** Render dashboard → *New* → *Blueprint* → select this repository. `render.yaml`
   creates `onerobolab-api`: build `pnpm install … && pnpm --filter @robolab/api typecheck`,
   start `node --max-old-space-size=256 apps/api/src/server.ts` (the API imports the `packages/**` sources, which `tsc` cannot emit outside `apps/api/src`, so production runs TypeScript directly with Node 22.18+ type stripping; `buildFilter` includes `packages/**`), health check `/health`, Node 22.18.
3. **Environment:** set `DATABASE_URL` (Neon *pooled* string, `sslmode=require`) and
   `CORS_ORIGIN` (the web app's origin) in the dashboard. `AUTH_SECRET` is generated by Render.
   Never commit these values.
4. **First admin password.** The seed has no passwords. From your machine, with the same
   `DATABASE_URL` in the environment:
   ```bash
   DATABASE_URL='…' node apps/api/src/cli/set-password.ts admin
   # type the password and press Enter (read from stdin, not from the command line)
   ```
   Or use the Render Shell. Remove or re-password the sample students before real use.
5. Check `https://<service>.onrender.com/health` → `{"status":"ok","database":"ok"}`.

The free Render plan sleeps when idle, so the first request after a pause is slow.

### The admin console (web app)

The admin console is part of the web app (`/admin`) and talks only to this API.

- Build the web app with `VITE_API_URL=https://<api-service>.onrender.com` (a public URL, not a
  secret), host `apps/web/dist` as a static site with an SPA fallback (every path → `index.html`),
  and add the site's origin to the API's `CORS_ORIGIN`.
- Or serve the web app and API from the same origin behind a proxy that forwards `/api` and
  `/health`; then leave `VITE_API_URL` empty.
- Existing databases need `database/migrations/0003_review_status.sql` (adds the REVIEW status) and `0004_starter_island_missions.sql` (Starter Island missions 4–24).
