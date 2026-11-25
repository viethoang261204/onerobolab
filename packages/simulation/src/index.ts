/**
 * @robolab/simulation — the only orchestrator. Wires the engines together in
 * a fixed order each tick (sense → decide → move → collide → mission).
 *
 * - `SimulationRuntime`: the fixed-timestep runtime (rendered by the web
 *   simulator, run headless by the API judge).
 * - `RobotBody`: kinematic robot state the renderer reads per frame.
 * - `runHeadless`: plays a compiled program on a level and returns `RunFacts`.
 * - `level/`: layouts and the stored-content codec (map / mission settings /
 *   objective rows → `PlayableLevel`), shared by the browser and the server.
 */
export type { RunRequest, SimulationController, SimulationListener, SimulationSetup } from '@robolab/shared';
export { DEFAULT_SIMULATION_CONFIG } from '@robolab/shared';

export { DEFAULT_RUN_SEED, SimulationRuntime, demoPath, type SimulationRuntimeOptions } from './runtime.ts';
export { RuntimeEvents, type ExecutionMode, type RuntimeEvent, type RuntimeListener } from './runtime-events.ts';
export { EMPTY_SENSORS, type RunState, type RuntimeSnapshot, type SensorSummary } from './runtime-state.ts';
export { RobotBody, type RobotActivity, type RobotBodyState } from './robot-body.ts';
export { runHeadless, type HeadlessOutcome, type HeadlessRun, type RunFacts } from './headless.ts';
export { applyLayout, layoutCount, layoutIndex, type LayoutSource, type LevelLayout } from './level/layout.ts';
export {
  DEFAULT_SCORING,
  layoutsFromJson,
  mapFromJson,
  missionFromStored,
  numbersFromJson,
  objectiveFromRow,
  objectiveToRow,
  objectivesFromRows,
  playableFromStored,
  scoringFromJson,
  type ObjectiveRow,
  type ObjectiveRowType,
  type PlayableLevel,
  type StoredLevel,
  type StoredObjective,
} from './level/codec.ts';
