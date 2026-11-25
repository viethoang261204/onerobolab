# RoboLab Roadmap

Each phase ends with `pnpm check`, `pnpm build`, a manual run of the app, and
a stop for review. Do not start the next phase automatically.

There are two tracks. The **UI track** (OneRoboLab reference design) sets the
order of work; the **engine phases** below provide the logic it plugs into.

Product plan and priorities: `docs/strategy/00-master-plan.md` (market research,
3D direction and tech audit sit next to it in `docs/strategy/`).

## G0 — Core (server-judged runs) ✅
- [x] `packages/blocks` (`@robolab/blocks`): block data model (block-types, block-registry without icons, block-model, block-utils, block-validation, serialization, sample-program) and the compiler (compiler, expression-compiler, compiler-errors, command-types) moved out of `apps/web/src/features/programming/{blocks,compiler}`; test helpers at `@robolab/blocks/test-utils`; toolbox icons in `features/programming/toolbox/category-icons.ts`; `newBlockId()` deterministic, the web app calls `setBlockIdSalt(random)` in `main.tsx`
- [x] `packages/simulation` (`@robolab/simulation`) is real: `SimulationRuntime`, `RuntimeEvents`, `RuntimeState`, `RobotBody` (web `RobotRuntime extends RobotBody`), `runHeadless` (compiled program + level → `RunFacts`, no rendering), `level/layout.ts` (`LevelLayout`, `applyLayout`, `layoutCount`) and `level/codec.ts` (stored level → `PlayableLevel`), used by the web catalog adapter and the API
- [x] All packages: explicit `.ts` imports, erasable TypeScript only (`allowImportingTsExtensions`, `erasableSyntaxOnly`) so the API runs the sources with Node type stripping
- [x] API run judge (`apps/api/src/domain/judge.ts`): `POST /api/runs/:id/finish` (and the attempts/submissions routes) re-compile the stored program version and replay it headless on the stored layout + seed (`level_attempts.layout_index`, `level_attempts.seed`, migration `0009_run_judge.sql`); the server scores what it observed (`result.reported` vs `result.judged`, details in `result.judge`); `POST /api/levels/:id/runs` accepts `{layout, seed}`; budget 600 simulated s per run, also bounded by wall-clock time + 5 s
- [x] Deploy: production runs the TypeScript directly (`node --max-old-space-size=256 apps/api/src/server.ts`); the build step is `pnpm --filter @robolab/api typecheck`; `render.yaml` `buildFilter` includes `packages/**` and `tsconfig.packages.json`

## UI track (OneRoboLab)
- [x] **UI 1 — App shell:** top navigation, toolbox rail, Blocks/Python editor, console/variables, full-bleed simulator with mission card, Run/Stop/Reset, view tools, camera rail (Top/Front/Side/Free), minimap + zoom, robot carousel; placeholder 3D scene
- [x] **UI 2 — 3D environment:** map-driven course ("Rescue the Supplies": curves, intersection, checkpoints, zones, goal, barriers, cones, crates), main island with charging station, terminal, ramp → supply depot, bridge → control-tower islet; background islands, towers, ring gates, clouds, gradient sky + sun, fog, one shadow-casting sun
  - Open: bridge/ramp/depot are decorative (not in the map schema, no elevation in physics yet); no bloom post-processing (emissive only); sky clouds are sparse
- [x] **UI 3 — Robot:** procedural 4-wheel robot (rig: 4 independent wheels, head yaw/pitch, LED status display), idle/running/stopped/success/error animation, exact differential-drive kinematics + pure-pursuit demo autopilot on Run/Stop/Reset, toggleable sensor visuals (distance cone, line rays, camera FOV)
  - Engine Phase 1 (kinematics) is effectively done by this: `stepDifferentialDrive`, `wheelAngleDelta` in robot-engine, with tests
- [x] **UI 4 — Block editor:** typed serializable block graph, 31 block types in 7 categories, drag & drop (toolbox → workspace, move, insert, nest, value sockets), snap + drop indicator, validation hints, comments, disable, duplicate, delete (animated / drag to toolbox or trash), undo/redo, copy/paste, keyboard shortcuts, pan/zoom, toolbox search + collapsible categories, Python preview from the same program, localStorage save
  - Replaces the planned Blockly dependency: the custom editor + `ProgramCompiler` contract covers the same role
- [x] **UI 5 — Blocks → robot:** compiler (blocks → shared IR), `CommandQueue` interpreter (runtime control flow, live conditions, variables, seeded random, per-tick budget), sensors (raycast distance, obstacle, line + offset, colour, touch), 2D collision world, mission tracker, runtime events, active-block highlight, live Variables tab, educational errors; covers engine Phases 2, 3 (runtime) and 6 (mission; scoring engine still pending)
  - Open: event hats other than “when program starts” don’t run yet; Rapier physics (pushable crates, ramps/bridge elevation) still pending; no Pause button (engine supports pause/resume)
- [x] **UI 6 — Production polish & levels:** data-driven levels (six missions; renamed in UI 7 to world-based ids) in `content/`, level selector + unlock progression, local progress via `ProgressStore`, level intro, stars (complete / par blocks / par time), success + failure panels (Try again keeps the program), hints, per-level `allowedBlocks`, per-level program save, 5-step onboarding tour, tooltips, synthesized audio, settings (sound, volume, hints, sensors, reduced motion, quality, fullscreen), quality presets, checkpoint/goal feedback + particle bursts, shortcuts (Space / R / F / Esc), error boundaries, dev debug overlay, analytics abstraction
  - Open: music toggle is a placeholder; no Pause; real-GPU FPS still to be measured on the user's machine after the DPR change; minimap is schematic
- [x] **UI 7 — Home hub + World Map:** routes (`/`, `/world`, `/world/:worldId`, `/world/:worldId/level/:levelId`, `/simulator[/:levelId]`) on a tiny History-API router; Home (hero with the real robot, continue learning, stats, world previews, quick actions); 3D World Map (six themed floating islands, energy-path network, constrained pan/zoom camera, DOM labels, journey list, world detail panel, mission cards with course previews, mission detail dialog → Start Mission → simulator); worlds as data (`content/worlds`), level ids world-based with legacy migration; all world progress derived from the UI 6 progress store (+ activity days for the streak)
  - Open: Jungle Ruins / Sky Lab / Lava Core have no missions yet ("coming soon"); simulator environment is the same course for every world; Robots page is a disabled nav item; production hosting needs an SPA fallback (all paths → index.html)
- [x] **UI 8 — 3D quality, Code Studio, unique environments:** programming and simulation split into Code Studio (`/studio/:levelId`) and a full-screen 3D Simulator (`/simulator/:levelId`) sharing one program store; data-driven environment system (catalog + registry + lighting profiles + reusable terrain/prop/water primitives + gameplay layer from the map); every mission has its own map and environment (Starter Courtyard, Campus Crossing, Creek Bridge, Canyon Passage, Canyon Warehouse, Canyon Bridge, Frost Depot, Jungle Trail — 2 new missions: Bridge Crossing, Forest Checkpoint); cinematic chase camera with soft follow; world-map islands rebuilt as per-world terrain dioramas; rendered environment previews on mission cards
  - Open: Sky Lab and Lava Core still have no missions; no post-processing (not in the stack — emissive + tone mapping only); physics is 2D, so bridges/cliffs are visual (colliders are the map walls); real-GPU FPS still to be measured

## Backend track
- [x] **Database Phase 1 — PostgreSQL schema:** `database/schema.sql` + `seed.sql` for Neon (users/roles/permissions, curriculum → worlds → levels, objectives, prerequisites, programs + versions, attempts, submissions, progress, XP/star ledgers, achievements, lessons, audit log, `get_student_level_states`)
- [x] **Backend Phase 2 — Auth, RBAC, API:** `apps/api` (Fastify + zod + pg + Argon2id); username/password login with opaque bearer sessions (HMAC-hashed in `auth_sessions`), lockout + rate limits; permission-based admin API (students, curriculum, worlds, levels, objectives/checkpoints/hints, prerequisites, publish/unpublish, per-student unlock/lock, lessons, achievements, reports, statistics, audit log) with audit rows in the same transaction; student API (curriculum/worlds/levels with server-decided state, programs with strict validation, attempts, server-scored submissions → stars/XP/achievements/unlocks); PGlite-backed tests; Render blueprint
  - Deviation: Fastify instead of NestJS/Prisma (NestJS DI needs `emitDecoratorMetadata`, which the TS 7 toolchain doesn't emit; `schema.sql` with triggers/functions stays the source of truth instead of a Prisma schema)
  - Open: the frontend still uses local progress (next: API-backed `ProgressStore` + login screen); runs are judged by server-side replay since G0; no teacher classes yet

- [x] **Admin Phase 3 — Admin console:** `/admin` (lazy chunk, light data-oriented design, sidebar + tables/filters/modals/drawers/breadcrumbs/tabs) on the Phase 2 API: staff sign-in (students refused before a session is stored; bearer token in sessionStorage), dashboard (totals, attempts chart, recent activity), students (search/sort/filter, create, disable/enable, reset password, unlock level; detail with profile, progress + per-level overrides, programs, attempts, achievements), curriculum (curricula with worlds, reorder, workflow; Curriculum → World → Level → Lesson tree with lesson editor for text/instructions/tips/videos/images), worlds (edit, thumbnail, environment, reorder, workflow), levels (table with unlock rule/attempts/completion, dependency graph; editor with details, objectives, hints, visual unlock rules + per-student overrides + focused graph, lessons, map & checkpoints), programs and attempts (readable block outline + Python, versions, server result), achievements, analytics, audit log (readable subjects, filters, before/after), settings
  - API additions: publishing workflow DRAFT → REVIEW → PUBLISHED → ARCHIVED (migration 0003), reorder endpoints, dashboard/statistics, global attempts/programs, level graph and per-level overrides, readable audit entries; `pnpm dev:api:memory` (in-memory seeded API for local work)
  - Open: no drag-and-drop reordering (↑↓ buttons); map editing is JSON (no visual map editor yet); no bulk actions or CSV export; the student app still uses local progress (API-backed progress + student login is next); no role management UI (roles stay in the seed/database)

- [x] **Student Phase 4 — Student app on the API:** username/password sign-in (staff refused; "keep me signed in" opt-in; forced first-time password change) in front of every student page; the whole journey from one `GET /api/catalog` (worlds, levels with server state, lock rules and progress, content only for playable levels, totals) rebuilt into the existing content model, so the UI 7/8 world map and per-level 3D environments are unchanged; lock messages in words ("Complete First Steps to unlock this mission."); Code Studio loads the saved program (starter template otherwise), autosaves to the API (block JSON + Python + versions on Save/Test) with a per-student local copy; Run creates a server attempt (program snapshot), the end sends what the simulator saw and the server decides pass/fail, stars, XP, achievements and unlocks (wall-clock plausibility check); result screen with server stars, +XP, objectives, Next Mission / Replay / Edit Program; Home greets the student and shows server XP, stars, missions, streak and "Continue learning"; paid hints through the API; offline: "Connection lost. Your program is saved locally.", sync and result retry on reconnect
  - API additions: `GET /api/catalog`, `POST /api/levels/:id/runs`, `POST /api/runs/:id/finish`; START_PROGRAM / USE_MAX_BLOCKS judged by the server, CUSTOM objectives never block a pass
  - Open: runs are replayed and judged by the server since G0; a run started while offline can't be recorded later; settings and lessons aren't shown in the student app yet; levels whose environment this app version doesn't know are skipped (logged)

- [x] **World Adventure Map:** entering a world opens a 3D isometric island (same art direction as Explore) instead of a mission list: a road climbing terrace by terrace past region set pieces (launch pad, research camps, windmills, rock spires, forests), a river gorge with bridge and waterfalls, robot stations at checkpoints, energy gates across the road, optional challenge outposts and a final arena; 20–25 missions per world (World 1 = the 24-mission journey), real levels bound in order, the rest "coming soon"; camera opens on the current mission (drag / wheel / pinch / keys, overview); small numbered markers with hover cards; slim HUD (progress, current mission, legend); locked/planned/checkpoint/gate details
  - Open: missions beyond the bundled/API levels are placeholders until their levels are authored; the student app shell is still desktop-first (min width 1024 px), so the phone drawer / bottom-sheet layout isn't reachable yet

- [x] **Robot Garage (`/robots`):** personal robot customisation in a 3D workshop — four models with their own silhouettes (Rover = the simulator robot; Scout, Tank, Biped procedural placeholders), paint per part (body, head, frame, panels, wheels, LEDs) with hover preview, custom colour and two-tone combos, patterns per part, decals by placement (icons, number, initials), accessories that physically attach, wheel styles, animations; part highlight, turntable, orbit / zoom / reset / auto-rotate, undo / redo / reset (confirmed), up to four saved robots; unlocks tied to the journey (worlds reached, missions completed). The saved robot is the student's robot on the Explore map, the Home hero and in the simulator
  - Open: configurations are stored per student in localStorage (`RobotPersistence` is ready for an API endpoint); the simulator keeps the rover body for physics when another model is chosen; phone layout waits for the app shell (min width 1024 px)

## Phase 0 — Foundation ✅
- [x] Monorepo (pnpm workspaces), strict TypeScript, Vitest
- [x] `CLAUDE.md`, architecture doc, roadmap
- [x] Shared types: geometry, ids, robot, sensors, map, program IR, mission, scoring, simulation
- [x] Engine contracts for all eight engines + Simulation Controller
- [x] Deterministic math helpers (+ tests)
- [x] Map Engine: validation, surface/checkpoint/finish queries, demo arena (+ tests)
- [x] Robot catalogue (Rover)
- [x] Vite/React app shell with the five-region layout and design tokens
- [x] 3D scene: floor, grid, walls, boxes, obstacles, line, colour zones, checkpoints, start, finish
- [x] Procedural robot placeholder
- [x] Camera: orbit controls, Overview / Follow / Top presets, reset, FPS meter

## Phase 1 — Robot kinematics (next)
- [ ] Differential-drive kinematics in `robot-engine` (wheel speeds → body velocity → pose integration)
- [ ] Drive controller: move distance, turn angle, drive, stop, speed control (closed loop on odometry)
- [ ] Unit tests: straight line, in-place turn, arc, speed clamping, determinism
- [ ] A temporary kinematic `PhysicsEngine` implementation (no collisions) for tests and early wiring

## Phase 2 — Program interpreter
- [ ] Tick-driven IR interpreter in `robot-engine` (blocking motion/wait, repeat, while, if/else, variables, expressions)
- [ ] Per-tick statement budget and runtime errors surfaced in `ProgramStatus`
- [ ] Tests driven by hand-written IR programs

## Phase 3 — Simulation Controller + live robot
- [ ] `simulation` package: fixed-timestep loop, phases, events, `step()` for debugging
- [ ] Wire UI Run / Pause / Step / Reset; renderer pulls pose from snapshots
- [ ] Inspector shows throttled pose; debug tab shows tick/time/program status
- [ ] Headless "golden run" tests (program + map → final pose)

## Phase 4 — Physics (Rapier) + sensors
- [ ] `physics-engine` with Rapier: static walls/obstacles, dynamic boxes, robot body, contacts, raycast, overlap
- [ ] `sensor-engine`: distance (raycast), line & colour (map surface), touch (overlap)
- [ ] Sensor readouts in the inspector; distance beam visualisation
- [ ] Rendering of dynamic box poses

## Phase 5 — Blockly
- [ ] Install Blockly; RoboLab theme matching design tokens
- [ ] Blocks: move forward/backward, turn left/right, stop, wait, repeat, if, if/else, distance/line/color conditions, variables
- [ ] Pure compiler Blockly JSON → IR with diagnostics (+ tests on fixture workspaces)
- [ ] Running-block highlight; compiled IR in the Program tab

## Phase 6 — Missions & scoring
- [ ] `mission-engine`: start, checkpoints (ordered/unordered), finish, collisions, timer, out-of-bounds, success/failure
- [ ] `scoring-engine`: completion, checkpoints, time bonus, efficiency, collision penalty, stars
- [ ] Mission brief, HUD progress, result dialog

## Phase 7 — Polish & performance
- [ ] GLB robot model(s) with lazy loading; procedural fallback
- [ ] Performance pass: frame budget profiling, `frameloop="demand"` while idle, texture/geometry audit
- [ ] Accessibility and keyboard shortcuts; responsive tweaks
- [ ] Save/load programs locally

- [x] **Starter Island — 24 missions:** missions 4–24 authored (21 new levels), each with its own map, environment, mission, toolbox, intro, three hints, star targets and XP, bound in order to the World 1 adventure stops (the final mission included). The toolbox grows one idea at a time (`starter-island/kit.ts`): moves → loops → forever / if / if-else with the distance and obstacle sensors → painted guide lines and the line sensor → colour signal tiles and the colour sensor → variables → everything for the final. Missions: zigzag lanes, beacons, boulder slalom, log bridge, first sensor stop, river crossing, distance-sensor boardwalk, stair loop, obstacle spiral, precision parking with speed, line + wall sensor lab, route planning, colour signals, rescue loop, variable spiral, right-hand autonomous rule, loop + sensor gorge run, supply bays with reversing, detour loop around fallen trees, line follower, final arena. Environments come from one region system (`scenes/regions`: meadow, forest, river, facility, canyon pass, research outpost, arena presets + one landmark per mission), all within the draw-call budget (≈180–200 calls, ≤135k triangles on Medium). Every level is proven solvable with 3 stars in `levels.test.ts`. Canyon Circuit opens after all 24 (existing WORLD_COMPLETED rule); `database/migrations/0004_starter_island_missions.sql` adds the missions to existing databases
  - Open: the optional challenge 17-A (Speed Run) is still a planned stop; the new missions reuse the rover's sensors (no new sensor kinds)

- [x] **Starter Island — difficulty curve:** missions 1–4 stay short (first moves); 5–24 rebuilt so routes and logic grow together — 45° diagonals (5), loops over a boulder slalom and a four-bridge weave (6–7), first obstacle sensor (8), right-first wall rule with nested ifs (9), a turn-flag variable (10), long line following and line following with crate detours (11–12), a timed angled parking that needs the speed block (13), lines + walls with six bends (14), a timed 15 m yard (15), six signal junctions (16), counting markers with a variable (17), a seven-side variable spiral (18), a real seeded maze solved with the right-hand rule (19), shrinking switchbacks with variables + a sensor stop (20), two-sided colour-coded deliveries (21), storm road with detours and signals (22), a long guide line with two detours (23) and **mission 24: Rescue City** — an 11 × 10 m district with 7 signal junctions, 3 roadworks, 3 survivors and Rescue HQ found by counting green bays (one ~30-block program). New `starter-rescue-city` environment (city blocks, skyline, traffic lights, HQ). `database/migrations/0005_starter_island_rebalance.sql` updates existing databases (progress kept, objective ticks of redesigned levels reset)

- [x] **Mission framework + Level 1 "First Delivery":** curriculum architecture for all 24 Starter Island missions (`docs/STARTER_ISLAND_CURRICULUM.md`: stages, dependency graph, skill and sensor progression, Blockly → Python map, mechanics, required systems, data model, scoring, hints). Framework: mission briefing with PREDICT step, stop-in-zone rule, scoring engine (completion, checkpoints, time and efficiency bonuses, collision penalty, Bronze → Platinum ranks) shared with the server verdict, live HUD (objectives · timer · points), four-tier hints, `mechanics` registry (cargo). Level 1 rebuilt: Starter Base → loading gate → stop on the Supply Station's delivery pad, carrying a supply box. `database/migrations/0006_first_delivery.sql`
  - Levels 2 "Power Station" (waypoints, left and right turns, charging pad) and 3 "Supply Run" (planned detours around storm debris, creek bridge, clinic pad) rebuilt on the framework, with their own scenes (power yard, clinic) and migration 0007
  - Levels 4–24 rebuilt to the curriculum (migration 0008): pushable crates + construction zones, timed traffic lights, ordered rescues, pick up / drop, colour sorting, smart gates, hazard zones, layouts that change on every Reset, mission data (`mission.*`), coordinates and `go to`, functions, `break`, fog of war, patrol carts, bonus objectives; new `@robolab/world-engine`; Python editor (Python ⇄ blocks, Blocks ⇄ Python from 15, Python first from 16)
  - Next: optional challenge 17-A (leaderboard); then the systems in curriculum §7 as levels need them (pushables, timed lights, pickup/place, variants, Python editor)

## Next — curriculum expansion
- More missions per world — fill Sky Lab, Lava Core, more for Jungle Ruins (sensors: line follow, colour zones; variables; functions) — each is one data file + a reference solution in `levels.test.ts`
- New map geometry beyond `trainingCourse()` variants (needs map-engine elevation for ramps/bridge)
- `scoring-engine` wired into stars/XP (currently `features/levels/stars.ts`)
- Event hats beyond “when program starts”

## Later — Teacher tools & backend
- [x] Replace `LocalProgressStore` / program storage with an API-backed `ProgressStore` (Student Phase 4; localStorage stays as offline cache)
- [x] Levels served as JSON from the backend (Student Phase 4 — `/api/catalog` → `from-api.ts`)
- [ ] Visual map editor in the admin console (uses Map Engine validation; today map data is edited as JSON)
- [x] PostgreSQL backend: users, roles, submissions, progress (Backend Phase 2 — Fastify, see above)
- [x] Server-side replay of submissions (headless `simulation` package) for fully trusted scores (G0 — core)
- [ ] Classes and assignments for teachers
- [ ] WebSocket live classroom features
