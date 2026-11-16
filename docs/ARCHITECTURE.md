# RoboLab Architecture

RoboLab is a browser-based 3D educational robotics simulator. This document
describes how the system is divided, how data flows through it, and the rules
that keep it modular, deterministic and fast.

## 1. Goals that shape the design

| Goal | Consequence |
|---|---|
| Students' programs must behave the same every run | Fixed-timestep simulation; pure engines; no wall-clock or randomness in core logic |
| Core logic must be testable | Engines are plain TypeScript with no DOM/React/Three.js, tested with Vitest in Node |
| 60 FPS on ordinary laptops | Renderer pulls state per frame (no React re-render per tick), instancing, no shadow maps, lazy-loaded 3D chunk |
| Teachers will author maps and missions | Maps, missions and programs are plain serializable JSON types |
| Backend comes later | All content goes through a registry / contracts that a backend can replace without touching engines |

## 2. Monorepo layout

```
robo3d/
├─ apps/
│  └─ web/                     React + Vite app
│     └─ src/
│        ├─ layout/            workspace regions (TopBar, ToolboxPanel, InspectorPanel, ConsolePanel)
│        ├─ ui/                design-system components (Panel, Button, Select, SegmentedControl, Icon)
│        ├─ render/            3D only: SimulatorCanvas, scene/, robot/, camera/
│        ├─ simulation/        bridge UI ↔ Simulation Controller (use-simulation-view, SimulatorViewport)
│        ├─ state/             Zustand store — UI state only
│        └─ content/           built-in maps/robots registry (backend later)
├─ packages/
│  ├─ shared/                  types, engine contracts, deterministic math — depends on nothing
│  ├─ map-engine/              map validation + geometric queries, built-in maps
│  ├─ robot-engine/            robot state, IR interpreter, differential-drive controller, robot catalogue
│  ├─ physics-engine/          Rapier world behind the PhysicsEngine contract
│  ├─ sensor-engine/           distance / line / color / touch sampling
│  ├─ blockly-engine/          block definitions, toolbox, Blockly JSON → IR compiler
│  ├─ mission-engine/          objectives, collisions, timer, success/failure
│  ├─ scoring-engine/          pure score calculation
│  └─ simulation/              Simulation Controller: fixed-step loop wiring all engines
└─ docs/
```

Packages are consumed as TypeScript source (`"exports": "./src/index.ts"`);
Vite and Vitest compile them directly, so there is no package build step.

### Dependency rules

```
                 ┌──────────────┐
                 │   shared     │  types · contracts · math
                 └──────▲───────┘
      ┌────────┬────────┼────────┬─────────┬─────────┬─────────┐
   map-eng  robot-eng physics  sensor  blockly  mission  scoring
      ▲         ▲        ▲        ▲                 ▲        ▲
      └─────────┴────────┴────────┴──── simulation ─┴────────┘
                                            ▲
                                      apps/web (UI + renderer)
```

- Every engine depends **only** on `@robolab/shared`.
- Only `@robolab/simulation` composes engines.
- `apps/web` talks to the simulation through `SimulationController` and reads
  static content (maps, robots) for rendering. It never calls the physics or
  robot engine directly.
- `blockly-engine` is used by the web app (editor) and produces `Program` IR,
  which is handed to `SimulationController.run()`.

## 3. Engines and their responsibilities

| Engine | Owns | Input | Output | Contract |
|---|---|---|---|---|
| **Map** | nothing mutable | `MapDefinition` | `MapQuery` (surface, checkpoints, finish, bounds) | `contracts/map-engine.ts` |
| **Physics** | rigid bodies, colliders | wheel targets, `dt` | pose, velocity, contacts, dynamic entity poses; raycast/overlap queries | `contracts/physics-engine.ts` |
| **Sensor** | nothing (stateless per tick) | robot pose, `PhysicsQuery`, `MapQuery` | `SensorSnapshot` | `contracts/sensor-engine.ts` |
| **Robot** | `RobotState`, program execution | `Program`, sensor snapshot, physics result | wheel targets, `ProgramStatus` | `contracts/robot-engine.ts` |
| **Blockly** | nothing | Blockly workspace JSON | `CompileResult` (IR + diagnostics + block count) | `contracts/compiler.ts` |
| **Mission** | `MissionState` | `SimulationSnapshot` | `MissionState` | `contracts/mission-engine.ts` |
| **Scoring** | nothing (pure) | rules, mission state, run stats | `ScoreBreakdown` | `contracts/scoring-engine.ts` |
| **Simulation** | tick counter, phase, time accumulator | setup, run requests, real frame time | snapshots, low-frequency events | `contracts/simulation.ts` |

## 4. The simulation tick

The Simulation Controller runs a **fixed-timestep** loop (default 60 Hz). The
render loop calls `advance(realDelta)`; the controller accumulates time and
executes whole ticks, capped at `maxTicksPerFrame` to avoid a spiral of death.

Each tick executes in this exact order:

```
1. sensors  = sensorEngine.sample(robot.pose, { physics, map })
2. wheels   = robotEngine.update({ dt, sensors })        // interpreter + drive controller
3. result   = physicsEngine.step({ dt, wheelTargets: wheels })
4.            robotEngine.applyPhysics(result)            // pose, velocity, odometry
5. snapshot = { tick, time, robot, sensors, program, contacts, dynamicEntities }
6. mission  = missionEngine.observe(snapshot)
7. if mission is terminal → phase = 'ended', score = scoringEngine.score(...)
```

Because every engine is deterministic and the order is fixed, the same
program on the same map produces the same trajectory, the same mission result
and the same score — which also makes whole runs testable headlessly.

## 5. Program pipeline (blocks → IR → execution)

As built (UI 4–5; the custom block editor replaced the planned Blockly dependency):

```
program-store ──validate──▶ compiler ──▶ Program (IR) ──▶ CommandQueue ──wheel speeds──▶ RobotRuntime (kinematics)
 (block graph)   (issues)   (SI units,    (shared type)    (robot-engine)                        │
                            blockIds)                           ▲  sensors                        ▼
                                                  SensorSuite ◀─┘  (sensor-engine)   CollisionWorld (physics-engine)
                                                                                     MissionTracker (mission-engine)
                                                                                                  │
                                           SimulationRuntime events ──▶ console · runtime-store · mission card
```

Original plan (kept for reference):

```
Blockly workspace ──serialize──▶ workspace JSON ──compile──▶ Program (IR) ──run──▶ Robot Engine
                                       (blockly-engine)         (shared type)        (interpreter)
```

- The **IR** (`shared/src/types/program.ts`) is a small typed AST: motion
  statements (`move`, `turn`, `drive`, `stop`), `wait`, control flow (`repeat`,
  `while`, `if`/`else`), variables (`setVar`, `changeVar`) and expressions
  including sensor reads.
- Units are normalised at compile time (degrees → rad, cm → m, % → 0–1).
- Each statement carries `source.blockId` so the editor can highlight the
  running block from `ProgramStatus.activeBlockId`.
- The interpreter is **tick-driven**: blocking statements (`move`, `turn`,
  `wait`) span many ticks; everything else runs instantly, with a per-tick
  statement budget so infinite loops without waits can't freeze the page.
- Other front-ends (text coding, AI tutor) can implement
  `ProgramCompiler<TSource>` without touching the Robot Engine.

## 6. Rendering

- `render/` is presentational. It reads static content (`MapQuery`,
  `RobotDefinition`) as props and **pulls** dynamic state each frame via
  callbacks (`getRobotPose`, later `controller.getSnapshot()`) inside
  `useFrame`. No per-tick React re-renders.
- The environment (`features/simulator/environment/`) has two layers:
  - **Course** (`RobotCourse`) — generated entirely from the `MapDefinition`:
    tiled platform sized to the map, painted lines as mitred ribbons,
    colour zones, checkpoints, goal, start pad, barriers (walls), cones
    (obstacles), blocks and crates (boxes). A new map JSON is a new course.
  - **Decoration** (`MainIsland`, `FloatingIsland`, `Building`, `Clouds`,
    `Sky`, `world-layout.ts`) — purely visual, never simulated.
- Repeated props (trees, rocks, cones, crates, barrier modules, clouds)
  render through `<Instanced>`: one draw call per set. Materials and unit
  geometries are shared module singletons.
- Lighting: hemisphere fill + one warm sun (the only shadow caster, 2048²
  PCF, frustum fitted to the course) + a cool rim light. Emissive materials
  for checkpoints/energy; no post-processing. Fog blends distant islands
  into the gradient sky dome.
- Default view budget: ≈200 draw calls (incl. shadow pass), ≈46k triangles.
- Labels are canvas-texture sprites (no DOM overlays, no font downloads).
- Every texture created in code is disposed on unmount; R3F disposes JSX
  geometries/materials automatically.
- The whole 3D stack (`three`, R3F, Drei) is a lazy chunk, so the UI shell
  paints before three.js is parsed.
- The robot is currently a procedural placeholder built from
  `RobotDefinition` dimensions; `modelUrl` will switch it to a GLB.

## 7. UI state vs simulation state

| Kind | Lives in | Update rate | Examples |
|---|---|---|---|
| UI state | Zustand (`stores/ui-store.ts`) | on user action | selected map/robot, camera view, active tab |
| Sampled telemetry | Zustand, throttled | ≤ 10 Hz | FPS, pose/sensor readouts in the inspector |
| Simulation state | Simulation Controller | 60 Hz | robot pose, sensors, contacts |
| Mission/score | Simulation events → Zustand | on change | objective progress, final score |

## 8. Conventions

- **Units:** metres, seconds, radians (SI) everywhere in code.
- **Axes:** right-handed, Y up, ground = XZ plane. Heading 0 = +X; positive
  heading turns counter-clockwise viewed from above (+X toward −Z), which is
  a positive rotation about +Y — so `object.rotation.y = heading` in Three.js.
- **Robot-local frame:** +X forward, +Y up, +Z right.
- **Ids:** branded strings (`RobotId`, `MapId`, `EntityId`, …) so they can't be mixed up.
- **Coordinates helpers:** `Vec2Math.headingToVector`, `rotate`, `localToWorld`,
  `isPointInArea` in `@robolab/shared` — use them rather than re-deriving trig.

## 9. Key decisions

| Decision | Why |
|---|---|
| pnpm workspaces, source-only packages | Real module boundaries with zero build tooling overhead |
| Contracts live in `shared`, not in each engine | Star-shaped dependency graph; engines can be implemented, mocked or replaced independently |
| Separate `simulation` orchestrator package | Keeps tick ordering in one place and out of the UI |
| No DOM lib for packages | The compiler enforces that core logic stays headless and testable |
| AST-style IR instead of a flat command list | Needs `if`/`repeat`/variables/sensor expressions; still JSON-serializable |
| Rapier behind an interface | WASM physics can be swapped for a kinematic model in unit tests |
| Blockly and Rapier not installed yet | Not needed until their phases; avoids unused weight |
| Canvas sprites instead of drei `<Html>` for labels | Cheaper (no per-frame DOM layout) and avoids a StrictMode portal bug |
| Fastify + zod + raw parameterised SQL for the API (not NestJS/Prisma) | NestJS DI needs `emitDecoratorMetadata` (not emitted by the TS 7 toolchain); `database/schema.sql` with its triggers and functions is the source of truth, not an ORM schema |
| Opaque bearer sessions (HMAC-hashed in the DB) instead of JWT | Instant revocation on logout / reset / disable; no cookies means no CSRF surface |
| Server computes stars / score / XP | Clients only report what happened; the server re-derives the result from the stored program and the level's rules |

## 10. Product flow and navigation (UI 7)

```
/            Home ──────────── Explore World ──▶ /world                  World Map (overview)
                                                   │ select island (UI state)
                                                   ▼ Enter World
                                                 /world/:worldId          missions of that world
                                                   │ open mission
                                                   ▼
                                                 /world/:worldId/level/:levelId   mission detail
                                                   │ Start Mission → startMission(levelId)
                                                   ▼
             Continue / Open Simulator ───────▶ /simulator/:levelId       UI 1–6 workspace
```

- **Router**: `features/router` — `parseRoute`/`paths` (pure, tested) + a Zustand store over the History API. The URL owns *where* the student is (entered world, open mission, simulator level); ephemeral UI (selected / hovered island) lives in `world-map.store`.
- **One progression system**: world status, continue target, stars, XP level and streak are derived in `world-map/world-progress.ts` from the UI 6 `ProgressStore` data plus content (`WorldRegistry`, `LevelRegistry`). Nothing about worlds is persisted separately.
- **Entering the simulator**: `startMission()` loads the level through the existing level session (`useLevelStore.loadLevel`) and navigates; the simulator page's `enter(levelId)` then keeps it (no second load). Direct `/simulator/:id` links load that level if unlocked, else fall back to the last playable one.
- **3D map**: one R3F canvas, hybrid with HTML — islands, paths and the robot are WebGL; every label, panel and button is normal DOM (tab order, screen readers). Labels follow 3D points through `screen-anchors` (transform writes per frame, no React re-render).

## 11. Code Studio, Simulator and per-level environments (UI 8)

```
/world/:w/level/:id ──Open Code Studio──▶ /studio/:id ──Test in Simulator──▶ /simulator/:id
                                               ▲                                   │
                                               └────────────── Edit Program ───────┘
        one level session (level-store) + one program store (per-level save) — never copied
```

Environment pipeline (`features/simulator/environments`):

```
LevelDefinition ── environmentId ──▶ catalog (pure) ──▶ EnvironmentRegistry ──▶ Scene component
      │  map (physics: walls, obstacles, checkpoints, goal)          │
      │  scene (road path, bridges, water)                            ▼
      └──────────────────────────────────────────────▶ EnvironmentScene
                                                         SkyDome + LightingRig (profile)
                                                         Scene: Terrain(fields) · Road · Water · BatchMesh(props) · set pieces
                                                         GameplayLayer: map entities → styled pieces
                                                         Atmosphere particles
```

- Physics stays 2D and deterministic: the map is the only source of colliders; scenes are visual and are shaped around the map/scene data (tests check that the road only crosses water on bridges).
- Prop primitives are pure builders that append instances to a `PropBatch`; one instanced mesh per geometry × material keeps each environment near 200 draw calls however dense it is.
- The world map uses lightweight preview dioramas (`world-map/scene/island-terrain.ts` + `island-decor.ts`), never the full mission environments; mission cards show images rendered once from the real environment by an off-screen canvas.

## 12. Backend API (Backend Phase 2)

```
browser (apps/web) ──HTTPS, Authorization: Bearer──▶ apps/api (Fastify, Render)
                                                        │  zod validation · RBAC · audit
                                                        ▼
                                              PostgreSQL (Neon) — database/schema.sql
```

- `apps/api` is a separate deployable. It doesn't import the web app. It uses the same block
  format (`roboverse.blocks` v1) and the same block-count rule as the frontend compiler.
- **Layers:** `routes/` (HTTP + zod) → `domain/` (program validation, scoring, level access,
  rewards; pure where possible) → `db/` (`Db` interface: `query` / `tx`). Tests swap the pg pool for
  PGlite, so SQL, triggers and functions are exercised for real.
- **Trust boundary:** identity, role, student id, progress, stars, score and XP never come from
  the request. The session decides who, the `role_permissions` table decides what, and
  `get_student_level_states` decides which levels. A submission carries only
  `{objectivesCompleted, timeSeconds, collisions}`.
- **Consistency:** every write that spans tables (submission → attempt → progress → ledgers →
  achievements; admin change → audit row) runs in one transaction.
- Details, endpoints and deployment: `apps/api/README.md`.

## 13. Admin console (Admin Phase 3)

```
/admin/** ──▶ AdminApp (lazy chunk) ──▶ AdminView(session, path)
                 │                         ├─ sign-in / No access / change password
                 │                         └─ AdminShell (sidebar) ─▶ page (per admin-routes.ts)
                 ▼
          api/client.ts ──HTTPS, Bearer──▶ apps/api (Phase 2) ──▶ PostgreSQL
```

- **Separate surface.** The console shares the router and build with the game but nothing
  visual: its own tokens, primitives and layout, and it never loads the 3D stack.
- **Access.** Students are refused at sign-in (their token is revoked before anything is stored)
  and see only “No access” if a student token is present. Staff see the pages their role's
  permissions allow. The API re-checks every request; the console's checks only decide what it
  shows.
- **Data.** `useResource(key, fetcher, tags)` loads data; mutations call `runAction`, which
  invalidates tags so every list showing that data reloads. No client cache beyond that, and no
  query library.
- **Publishing.** One `WorkflowControl` drives DRAFT → REVIEW → PUBLISHED → ARCHIVED for every
  content type. The allowed moves mirror `apps/api/src/domain/workflow.ts`, and publishing a
  level is blocked in the UI and the API until the level is playable.
- **Unlock rules** are edited as OR-ed groups of AND-ed requirements, previewed as a sentence,
  and shown as a dependency graph (`lib/dependency-graph.ts`: columns by prerequisite depth).
- **Programs** are shown with the editor's own block registry (`lib/program-outline.ts`), so staff
  read the same labels the student used, plus the Python preview.

## 14. Student app on the API (Student Phase 4)

```
/login ─▶ session (bearer) ─▶ GET /api/catalog ─▶ from-api.ts ─▶ LevelRegistry / WorldRegistry (dynamic)
                                                               └▶ ServerProgressStore (states, lock rules, totals)
Code Studio ─ edits ─▶ program-store (local, per student) ─ debounced ─▶ PUT /api/levels/:id/program
Simulator ─ Run ─▶ POST /levels/:id/runs (snapshot) … run … ─▶ POST /runs/:id/finish ─▶ verdict ─▶ result screen
```

- **One content model.** The database was seeded from the bundled level files, and
  `from-api.ts` is the exact inverse, so a level from the API renders in the same environment,
  with the same map, scene, mission and toolbox. A test proves the round trip for every bundled
  level. Bundled content stays as the offline/test fallback and fills visual gaps (camera preset).
- **Authority.** The server decides level states, unlocks, pass/fail, stars, score and XP. The
  browser reports only what the simulator observed. Local copies (programs, optimistic progress)
  make the UI instant and survive outages, and the next catalog refresh is the truth.
- **Offline.** Programs are saved locally first, marked dirty, and pushed when the API answers
  again (the connection store probes `/health` while offline). A run finished during an outage
  is retried with its attempt id (a run can be finished once). A run that could not be
  registered at Run time is shown as "not saved".
- **Isolation.** Local programs and sync state are namespaced by student id. Every API call uses
  the session's student, and runs and programs of other students are indistinguishable from
  missing ones (404).

## 15. World adventure map

```
content/adventures/<world>.ts ─▶ layout.ts (road, terraces, stops, river, challenges)
                                  ├▶ island-terrain / island-landmarks / island-props (pure)
LevelRegistry.byWorld + progress ─▶ adventure-state.ts (status, lock reasons, trail, focus)
                                  └▶ scene3d/AdventureCanvas (lazy) + HTML markers (AnchorProjector)
```

- **Content vs. geometry.** An adventure file lists what the journey is; the layout decides where
  things stand. Both are deterministic, so the island looks the same on every visit and in tests.
- **Real levels first.** Mission stops are filled by the world's real levels in order (an explicit
  `levelId` pins one). A world with more levels than stops falls back to a plain journey, so no
  level is ever hidden.
- **Derived state.** Status, lock reasons (from the server's unlock rules), gate/checkpoint state
  and the lit trail come from the same `ProgressData` as the rest of the app — nothing is stored.
- **Rendering.** One terrain mesh, a road strip, three instanced prop batches, a few animated
  pieces (gate fields, arena core, current ring, waterfalls); ~80 draw calls, 120–170k triangles.
  Markers are DOM buttons in the page (tab order, labels), moved by the canvas every frame.

