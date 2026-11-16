# OneRoboLab database

PostgreSQL schema for OneRoboLab, targeting **Neon** (the future API runs on **Render**).

| File | Purpose |
|---|---|
| `schema.sql` | Canonical initial definition: extension, enums, 30 tables, constraints, indexes, triggers, functions, 2 reporting views. |
| `seed.sql` | Roles and permissions, an admin placeholder, 3 sample students, 2 curricula, 6 worlds, 31 levels (29 published — all 24 Starter Island missions — and 2 drafts) with their real maps, objectives, checkpoints, hints and unlock rules. Also achievements, lessons and sample student activity. |
| `ERD.md` | Relationships and design notes. |

Both files run inside a transaction, on a **fresh** database, **once**. Rerunning `seed.sql` fails on unique constraints on purpose, and nothing is half-applied.

---

## 1. Create the Neon database

1. Create a project at <https://neon.tech> (PostgreSQL 15 or newer; 16 or 17 recommended).
2. Create a database, e.g. `onerobolab`.
3. Copy two connection strings from the dashboard:
   - **Direct** (host without `-pooler`): use it for running these SQL files.
   - **Pooled** (host contains `-pooler`): use it for the API on Render.

Both must include `sslmode=require`.

## 2. Run `schema.sql`

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST/onerobolab?sslmode=require'   # direct URL
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
```

The Neon SQL Editor works too: paste the file and run it.

The only extension used is `pgcrypto`, which Neon supports. `gen_random_uuid()` is also built into PostgreSQL 13 and later.

## 3. Run `seed.sql`

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seed.sql
```

## 4. Replace the admin password hash

`seed.sql` contains **no passwords**. Every seeded account has:

```
password_hash = 'REPLACE_WITH_ARGON2_HASH'
```

This placeholder is not a valid hash, so those accounts cannot sign in. A CHECK constraint on `users.password_hash` accepts only Argon2 or bcrypt hash formats (or this placeholder), so a plaintext password can never be stored by mistake.

**Easiest (Backend Phase 2):** use the API's CLI, which hashes with Argon2id and writes the hash for you. The password is read from stdin, never from the command line:

```bash
pnpm --filter @robolab/api build
DATABASE_URL='…' node apps/api/dist/cli/set-password.js admin
```

Or generate an **Argon2id** hash on your own machine yourself. Never paste a real password into a file or a chat.

```bash
# Python (pip install argon2-cffi)
python -c "import getpass; from argon2 import PasswordHasher; print(PasswordHasher().hash(getpass.getpass()))"

# or Node (npm i argon2), prompting on stdin
node -e "const a=require('argon2');let s='';process.stdin.on('data',d=>s+=d).on('end',async()=>console.log(await a.hash(s.trim(),{type:a.argon2id})))"
```

Then choose **one** of these:

- **Recommended: update after import**, so the hash never lands in a file or in git:

  ```sql
  UPDATE users
     SET password_hash = '$argon2id$v=19$m=65536,t=3,p=4$...your hash...',
         must_change_password = FALSE,
         password_changed_at = CURRENT_TIMESTAMP
   WHERE username_normalized = 'admin';
  ```

- **Or edit before import:** replace `REPLACE_WITH_ARGON2_HASH` in the admin `INSERT` of `seed.sql` with your hash. Do not commit that change.

The sample students (`nguyenvana01`, `tranthib02`, `leminhc03`) also carry the placeholder. Set their hashes the same way, or delete the sample activity for production (see section 7).

## 5. Set `DATABASE_URL`

The backend reads **only** `DATABASE_URL` from the environment. No hostname, user or password is hard-coded anywhere.

| Where | Value |
|---|---|
| Render → service → Environment | `DATABASE_URL` = the Neon **pooled** connection string (`…-pooler…/onerobolab?sslmode=require`) |
| Local development | a `.env` file that is **not committed** (`DATABASE_URL=postgresql://…`) |

## 6. Verify the connection

```bash
psql "$DATABASE_URL" -c "SELECT version();"
psql "$DATABASE_URL" -c "SELECT slug, status, environment_id FROM levels ORDER BY slug;"
psql "$DATABASE_URL" -c "SELECT level_slug, state, reason FROM get_student_level_states((SELECT id FROM users WHERE username_normalized = 'nguyenvana01'));"
```

Expected results:

- 31 levels: `starter-01…24`, `canyon-01…03`, `frost-01`, `jungle-01` published, plus the drafts `skylab-01` and `lava-01`.
- For `nguyenvana01`: `starter-01…03` `COMPLETED`, `starter-04` `AVAILABLE` and `canyon-01` `LOCKED` (Canyon Circuit opens only when every Starter Island mission is completed).

## 7. Migrations

`schema.sql` is migration 0001 and always describes the **current** full schema (fresh installs run only it). Changes made after a database exists ship as numbered files in `migrations/`:

| File | What | Apply to |
|---|---|---|
| `migrations/0002_auth_sessions.sql` | `auth_sessions` table (API sign-in; stores only an HMAC of each token) + fix for the XP/star ledger triggers (negative amounts, such as hint purchases, failed a CHECK) | databases created from the Phase 1 `schema.sql` |
| `migrations/0003_review_status.sql` | `REVIEW` value in `content_status` (publishing workflow DRAFT → REVIEW → PUBLISHED → ARCHIVED) | databases created before Admin Phase 3 |
| `migrations/0006_first_delivery.sql` | Mission 1-1 "First Delivery" on the mission framework (map, briefing / scoring / stop-in-zone in `mission_settings`, four tiered hints). Needs 0004, independent of 0005 | databases after 0004 |
| `migrations/0007_power_station_supply_run.sql` | Missions 1-2 "Power Station" (waypoints, left and right turns, stop on the charging pad) and 1-3 "Supply Run" (planned detours around debris, creek bridge, stop on the clinic pad) on the mission framework; renames their environments. Keeps progress; resets objective ticks of these two levels. Needs 0004, independent of 0005 | databases after 0004 |
| `migrations/0008_starter_island_curriculum.sql` | Missions 4–24 rebuilt to the Starter Island curriculum (new maps, scenes, toolboxes, briefings, scoring, four tiered hints, objectives — crate objectives as tracked `CUSTOM`, bonus objectives `required = FALSE`); upserts every Starter Island environment. Keeps progress; resets objective ticks of these levels. Needs 0004; **replaces 0005** (don't apply 0005 after it) | databases after 0004 |
| `migrations/0005_starter_island_rebalance.sql` | Starter Island difficulty curve: missions 5–24 redesigned (maps, scenes, toolboxes, objectives, hints, star targets, time limits) and the `starter-rescue-city` environment for mission 24. Keeps student progress; resets objective ticks of the redesigned levels | databases after 0004 |
| `migrations/0004_starter_island_missions.sql` | Starter Island missions 4–24: 21 environments, 21 published levels with checkpoints, objectives, hints and the unlock chain `starter-N` ← `starter-(N-1)` | databases seeded with only `starter-01…03` |

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0002_auth_sessions.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0003_review_status.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0004_starter_island_missions.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0006_first_delivery.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0007_power_station_supply_run.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0008_starter_island_curriculum.sql
```

0002 and 0003 are safe to run twice. 0002 is one transaction; 0003 is a single `ALTER TYPE` (a new enum value can't be used inside the transaction that adds it). 0004 is one transaction that refuses to run a second time (it stops if `starter-04` already exists), so nothing is half-applied or duplicated.

## 8. How the API uses the database

The backend lives in `apps/api` (see its README). Key rules it follows:

- **Passwords:** Argon2id in the API, never in SQL. Placeholder hashes never verify. `failed_login_count` / `locked_until` for lockout (5 tries → 15 min), `must_change_password` for first sign-in.
- **Sessions:** `auth_sessions` holds `HMAC-SHA256(AUTH_SECRET, token)`, never the token. Rows are revoked on logout, password change/reset and disabling.
- **Usernames:** compared on `username_normalized`. Soft-deleted usernames stay reserved.
- **Student-only foreign keys:** the API checks the role is `STUDENT`, and student routes always take the id from the session.
- **Level access:** `get_student_level_states(student_id)`. Admin overrides go to `student_level_access` with an `audit_logs` row in the same transaction.
- **Programs:** one "Main" program per student and level. Versions come from `save_program_version` (explicit Save/Test, and before every attempt or submission if the program changed).
- **Attempts:** inserted without `attempt_number` (trigger numbers them).
- **XP and stars:** only through `xp_transactions` / `star_transactions`. Totals follow via triggers. Completion XP pays once.
- **Audit:** every admin mutation writes `audit_logs` (append-only).
- **Content deletion:** soft delete (`deleted_at`).
- **Before production:** remove the sample students' activity, or give them real passwords with the CLI.
