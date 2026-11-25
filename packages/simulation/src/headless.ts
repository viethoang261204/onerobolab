import { createMapEngine } from '@robolab/map-engine';
import { ROVER } from '@robolab/robot-engine';
import { DEFAULT_SIMULATION_CONFIG, type MissionFailureReason, type Program, type RobotDefinition } from '@robolab/shared';
import { applyLayout, layoutIndex } from './level/layout.ts';
import type { PlayableLevel } from './level/codec.ts';
import { RobotBody } from './robot-body.ts';
import { SimulationRuntime } from './runtime.ts';

/** How a headless run ended. */
export type HeadlessOutcome =
  /** The mission succeeded. */
  | 'success'
  /** The mission failed (crash, hazard, red light, wrong delivery, time limit…). */
  | 'failure'
  /** The program hit a runtime error. */
  | 'error'
  /** The program ended without completing the mission. */
  | 'finished'
  /** Still running when the simulated-time budget ran out. */
  | 'timeout';

export interface HeadlessRun {
  readonly level: PlayableLevel;
  /** The compiled program (shared IR). */
  readonly program: Program;
  /** Layout index (wrapped onto the level's layouts). */
  readonly layout: number;
  /** Seed for random blocks. */
  readonly seed: number;
  /** Simulated-seconds budget; the run stops as `timeout` when it is used up. */
  readonly maxSeconds: number;
  readonly robot?: RobotDefinition;
}

/** What the simulation observed — the facts a verdict is computed from. */
export interface RunFacts {
  readonly outcome: HeadlessOutcome;
  /** Simulated seconds from Run to the end of the run. */
  readonly timeSeconds: number;
  readonly ticks: number;
  readonly collisions: number;
  /** Mission objective ids completed (= `level_objectives.code`). */
  readonly objectivesCompleted: readonly string[];
  readonly failureReason: MissionFailureReason | null;
  readonly errorMessage: string | null;
  /** The layout actually played (after wrapping). */
  readonly layout: number;
}

/**
 * Plays a program on a level without rendering, on the same fixed-timestep
 * runtime the simulator uses. Same level + layout + program + seed ⇒ same
 * facts, so the server can judge a run instead of trusting the browser.
 * Throws `MapValidationError` when the level's map is invalid.
 */
export function runHeadless(input: HeadlessRun): RunFacts {
  const robotDef = input.robot ?? ROVER;
  const layout = layoutIndex(input.level, input.layout);
  const played = applyLayout(input.level, layout);
  const map = createMapEngine().load(played.map);
  const robot = new RobotBody(robotDef, played.map.start);
  const sim = new SimulationRuntime({ map, robot, mission: input.level.mission, seed: input.seed, ...(played.data && { data: played.data }) });

  let errorMessage: string | null = null;
  sim.events.on((e) => {
    if (e.type === 'runtimeError') errorMessage = e.message;
  });

  sim.runProgram(input.program);
  const maxTicks = Math.max(0, Math.ceil(input.maxSeconds / (sim.config.fixedDt || DEFAULT_SIMULATION_CONFIG.fixedDt)));
  let ticks = 0;
  while (sim.state === 'running' && ticks < maxTicks) {
    sim.step();
    ticks++;
  }

  const snap = sim.snapshot();
  const mission = snap.mission;
  const failed = mission?.status === 'failure';
  const outcome: HeadlessOutcome =
    snap.runState === 'success' ? 'success' : snap.runState === 'running' ? 'timeout' : failed ? 'failure' : snap.runState === 'error' ? 'error' : 'finished';
  return {
    outcome,
    timeSeconds: snap.time,
    ticks,
    collisions: mission?.collisionCount ?? 0,
    objectivesCompleted: (mission?.objectives ?? []).filter((o) => o.completed).map((o) => String(o.objectiveId)),
    failureReason: failed ? (mission?.failureReason ?? null) : null,
    errorMessage,
    layout,
  };
}
