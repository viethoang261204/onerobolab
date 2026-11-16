/**
 * @robolab/simulation — the only orchestrator. Runs the fixed-timestep loop
 * and wires the engines together in a fixed order each tick.
 *
 * Status: contract only. Implementation lands in Phase 3 (see docs/ROADMAP.md).
 */
export type { RunRequest, SimulationController, SimulationListener, SimulationSetup } from '@robolab/shared';
export { DEFAULT_SIMULATION_CONFIG } from '@robolab/shared';
