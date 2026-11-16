import type { WorldTheme } from '../../../content/worlds/types';
import type { LightingProfileId } from './lighting';

/*
 * Environment catalog — pure data (no three.js), so levels, tests and 2D UI
 * can reason about environments. The 3D component for each id lives in
 * `EnvironmentRegistry.ts` (a `Record<EnvironmentId, …>`, so TypeScript
 * guarantees every catalog entry has a scene).
 */

export type EnvironmentId =
  | 'starter-courtyard'
  | 'starter-campus-crossing'
  | 'starter-creek-bridge'
  | 'starter-meadow-lanes'
  | 'starter-beacon-field'
  | 'starter-boulder-woods'
  | 'starter-log-bridge'
  | 'starter-ranger-hut'
  | 'starter-ferry-landing'
  | 'starter-river-docks'
  | 'starter-stepping-stones'
  | 'starter-harbour-spiral'
  | 'starter-boat-dock'
  | 'starter-sensor-lab'
  | 'starter-facility-yard'
  | 'starter-signal-crossing'
  | 'starter-rescue-depot'
  | 'starter-energy-spiral'
  | 'starter-canyon-switchbacks'
  | 'starter-gorge-run'
  | 'starter-supply-outpost'
  | 'starter-fallen-trees'
  | 'starter-guide-line'
  | 'starter-rescue-city'
  /** Legacy id of mission 24 (databases before migration 0005) — rendered as Rescue City. */
  | 'starter-rescue-arena'
  | 'canyon-passage'
  | 'canyon-warehouse'
  | 'canyon-bridge'
  | 'frost-depot'
  | 'jungle-trail';

/** Chase-camera framing (metres behind / above / to the right of the robot). */
export interface ChaseFraming {
  readonly back: number;
  readonly height: number;
  readonly side: number;
}

export const DEFAULT_CHASE: ChaseFraming = { back: 2.7, height: 2.1, side: 1.5 };

export interface EnvironmentInfo {
  readonly id: EnvironmentId;
  readonly name: string;
  /** One line describing the place (mission briefing, previews). */
  readonly summary: string;
  readonly theme: WorldTheme;
  readonly lighting: LightingProfileId;
  /** Steeper framing where tall walls (cliffs, racks) would hide the robot. */
  readonly chase?: ChaseFraming;
  /**
   * Rendering look. `natural` = filmic tone mapping, sky-lit reflections,
   * textured ground and roads, real grass (Starter Island missions 1–3).
   */
  readonly look?: 'natural';
}

export const ENVIRONMENTS: readonly EnvironmentInfo[] = [
  { id: 'starter-courtyard', name: 'Starter Courtyard', summary: 'A robotics training campus with a paved practice path and a charging dock.', theme: 'starter', lighting: 'naturalDay', look: 'natural' },
  { id: 'starter-campus-crossing', name: 'Power Station', summary: 'The island power yard: hedge-lined service lanes, transformers, pylons and the charging pad.', theme: 'starter', lighting: 'naturalDay', look: 'natural' },
  { id: 'starter-creek-bridge', name: 'Supply Trail', summary: 'A storm-hit meadow trail over the creek bridge to the riverside clinic.', theme: 'starter', lighting: 'naturalDay', look: 'natural' },
  { id: 'starter-meadow-lanes', name: 'Bridge Site', summary: 'A meadow lane beside the washed-out stream, with three bridge blocks and the construction site.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-beacon-field', name: 'Traffic Crossing', summary: 'Hedge-lined roads with two zebra crossings and their traffic lights on the way to the depot.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-boulder-woods', name: 'Rescue Woods', summary: 'A boulder-strewn forest clearing where three hikers wait, and the ranger station.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-log-bridge', name: 'Broken Bridge', summary: 'A ring road round the river island with two log bridges, one of them blocked.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-ranger-hut', name: 'Cargo Station', summary: 'The cargo hall: a crate shelf, the loading dock and a charging bay.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-ferry-landing', name: 'Colour Warehouse', summary: 'A sorting hall with a colour-coded crate shelf and the red and blue warehouses.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-river-docks', name: 'Smart Gate', summary: 'The river dock lane with a smart security gate, its scanner pad and the dock pad.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-stepping-stones', name: 'Signal Avenue', summary: 'A straight avenue with three traffic lights, each on its own timetable.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-harbour-spiral', name: 'Line Rescue', summary: 'Quays of the storm-hit harbour with a painted rescue line to the stranded fisher.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-boat-dock', name: 'Sensor Gate', summary: 'Gate 2’s test course: a guide line, fallen crates and two signalled exits.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-sensor-lab', name: 'Flooded Village', summary: 'A village high street with flood water, fallen trees and the village square.', theme: 'starter', lighting: 'daylight', chase: { back: 2.0, height: 2.8, side: 0.9 } },
  { id: 'starter-facility-yard', name: 'Bridge Engineer', summary: 'A long steel bridge over a ravine with a repair crane gate and the tower.', theme: 'starter', lighting: 'daylight', chase: { back: 2.0, height: 2.8, side: 0.9 } },
  { id: 'starter-signal-crossing', name: 'Dispatch Street', summary: 'A street of four rescue stations and the dispatch pad.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-rescue-depot', name: 'Rescue Depot', summary: 'The rescue depot lane with survivor pods in its bays and the base drop zone.', theme: 'starter', lighting: 'daylight' },
  { id: 'starter-energy-spiral', name: 'Charging Car Park', summary: 'A car park with five charging bays, some of them taken.', theme: 'starter', lighting: 'warmAfternoon' },
  { id: 'starter-canyon-switchbacks', name: 'Delivery Plaza', summary: 'An open canyon plaza where parcel points arrive as coordinates.', theme: 'starter', lighting: 'warmAfternoon' },
  { id: 'starter-gorge-run', name: 'Gorge Villages', summary: 'The gorge road with three villages and the storm shelter.', theme: 'starter', lighting: 'warmAfternoon' },
  { id: 'starter-supply-outpost', name: 'Robot Factory', summary: 'The outpost factory: a parts feeder and the motor and sensor lines.', theme: 'starter', lighting: 'coolDaylight' },
  { id: 'starter-fallen-trees', name: 'Foggy Tunnels', summary: 'The old research tunnels, full of fog and shifting walls.', theme: 'starter', lighting: 'coolDaylight' },
  { id: 'starter-guide-line', name: 'Recovery Hub', summary: 'The island hub: bridge site, power depot, a traffic light and the control tower.', theme: 'starter', lighting: 'coolDaylight' },
  { id: 'starter-rescue-arena', name: 'Rescue City', summary: 'A whole city district: junction signals, roadworks, survivors to rescue and Rescue HQ.', theme: 'starter', lighting: 'warmAfternoon', chase: { back: 2.3, height: 2.8, side: 0.8 } },
  { id: 'starter-rescue-city', name: 'Rescue City Arena', summary: 'Rescue City at rush hour: patrol carts, Hospital Street and the hospital.', theme: 'starter', lighting: 'warmAfternoon', chase: { back: 2.3, height: 2.8, side: 0.8 } },
  { id: 'canyon-passage', name: 'Canyon Passage', summary: 'A narrow switchback road cut between orange rock cliffs.', theme: 'canyon', lighting: 'warmAfternoon', chase: { back: 1.9, height: 3.1, side: 0.9 } },
  { id: 'canyon-warehouse', name: 'Canyon Warehouse', summary: 'A robotics warehouse: racks, conveyors and a loading dock.', theme: 'canyon', lighting: 'warehouse', chase: { back: 1.8, height: 2.9, side: 0.7 } },
  { id: 'canyon-bridge', name: 'Canyon Bridge', summary: 'A steel suspension bridge high above the canyon river.', theme: 'canyon', lighting: 'goldenGorge' },
  { id: 'frost-depot', name: 'Frost Depot', summary: 'A frozen supply route past a radar station, pipelines and energy gates.', theme: 'frost', lighting: 'coolDaylight' },
  { id: 'jungle-trail', name: 'Jungle Trail', summary: 'A forest trail over streams and bridges to the temple ruins.', theme: 'jungle', lighting: 'humidCanopy' },
];

/** Does this environment use the natural (filmic, textured) look? */
export const isNaturalLook = (id: string): boolean => ENVIRONMENTS.find((e) => e.id === id)?.look === 'natural';

export const isEnvironmentId = (id: string): id is EnvironmentId => ENVIRONMENTS.some((e) => e.id === id);

/** Chase-camera framing for an environment. */
export const chaseFraming = (id: string): ChaseFraming => environmentInfo(id).chase ?? DEFAULT_CHASE;

/** Catalog entry for an id. Throws for unknown ids — levels must never silently fall back to a generic arena. */
export function environmentInfo(id: string): EnvironmentInfo {
  const info = ENVIRONMENTS.find((e) => e.id === id);
  if (!info) throw new Error(`Unknown environment "${id}"`);
  return info;
}
