import type { MissionDefinition, MissionState } from '../types/mission.ts';
import type { SimulationSnapshot } from '../types/simulation.ts';
import type { MapQuery } from './map-engine.ts';

/**
 * Mission Engine: observes snapshots and derives mission state. It never
 * mutates the simulation; ending a run is the Simulation Controller's job
 * when it sees a terminal status.
 */
export interface MissionEngine {
  load(mission: MissionDefinition, map: MapQuery): void;
  reset(): void;
  observe(snapshot: SimulationSnapshot): MissionState;
  getState(): MissionState;
}
