import { DEMO_ARENA } from '@robolab/map-engine';
import { ROVER } from '@robolab/robot-engine';
import type { MapDefinition, MapId, MissionDefinition, RobotDefinition, RobotId } from '@robolab/shared';
import { LevelRegistry } from '../content/levels/registry';

/**
 * Content lookup by id. Maps and missions come from the levels in play
 * (`LevelRegistry`: the API catalog after sign-in, bundled content otherwise),
 * so they are looked up on every call, never captured at import time.
 */
export const ROBOTS: readonly RobotDefinition[] = [ROVER];

export const DEFAULT_ROBOT_ID = ROVER.id;
/** Initial map before any level loads (the first bundled level). */
export const DEFAULT_MAP_ID = LevelRegistry.first().map.id;

export const getMap = (id: MapId): MapDefinition =>
  LevelRegistry.byMap(id)?.map ?? (id === DEMO_ARENA.id ? DEMO_ARENA : LevelRegistry.first().map);
export const getRobot = (id: RobotId): RobotDefinition => ROBOTS.find((r) => r.id === id) ?? ROVER;

/** The mission played on a map (null = free play). */
export const getMissionForMap = (id: MapId): MissionDefinition | null => LevelRegistry.byMap(id)?.mission ?? null;
