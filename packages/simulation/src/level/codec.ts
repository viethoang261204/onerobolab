import { entityId, mapId, missionId, robotId, type MapDefinition, type MapEntity, type MissionDefinition, type Objective, type ScoringRules, type Vec2 } from '@robolab/shared';
import type { LevelLayout } from './layout.ts';

/*
 * Stored level content ⇄ what the simulation runs. The database keeps a
 * level as `map_definition` (jsonb), `mission_settings` (jsonb) and
 * `level_objectives` rows; the web app's catalog adapter and the API's run
 * judge both decode them with these functions, so a level plays the same in
 * the browser and on the server. Every decoder takes `unknown` and returns
 * null (or drops the entry) for anything malformed.
 */

/** `level_objectives.objective_type`. */
export type ObjectiveRowType = 'START_PROGRAM' | 'REACH_CHECKPOINT' | 'REACH_ALL_CHECKPOINTS' | 'REACH_GOAL' | 'AVOID_COLLISIONS' | 'FINISH_WITHIN' | 'USE_MAX_BLOCKS' | 'CUSTOM';

/** How an objective is stored (without its code / title / order). */
export interface ObjectiveRow {
  readonly type: ObjectiveRowType;
  readonly config: Record<string, unknown>;
  readonly required: boolean;
  readonly checkpointCode: string | null;
}

/** A stored objective as read back (the row plus its identity). */
export interface StoredObjective extends ObjectiveRow {
  readonly code: string;
  readonly title: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isPoint = (v: unknown): v is Vec2 => isObj(v) && isNum(v.x) && isNum(v.z);
const strings = (v: unknown): string[] | null => (Array.isArray(v) && v.every(isStr) ? v : null);

/**
 * Objectives the simulator tracks that have no database type of their own
 * (crates pushed into a zone, crates delivered) are stored as CUSTOM with
 * `config.tracked = true`; the server then requires them like any other
 * objective. Bonus objectives are rows with `required = false`.
 */
export function objectiveToRow(o: Objective): ObjectiveRow {
  const required = !o.optional;
  switch (o.type) {
    case 'reachCheckpoint':
      return { type: 'REACH_CHECKPOINT', config: {}, required, checkpointCode: String(o.checkpointId) };
    case 'reachAllCheckpoints':
      return { type: 'REACH_ALL_CHECKPOINTS', config: o.ordered ? { ordered: true } : {}, required, checkpointCode: null };
    case 'reachFinish':
      return { type: 'REACH_GOAL', config: {}, required, checkpointCode: null };
    case 'avoidCollisions':
      return { type: 'AVOID_COLLISIONS', config: { maxCollisions: o.maxCollisions }, required, checkpointCode: null };
    case 'finishWithin':
      return { type: 'FINISH_WITHIN', config: { seconds: o.seconds }, required, checkpointCode: null };
    case 'pushToZone':
      return { type: 'CUSTOM', config: { tracked: true, kind: 'pushToZone', zoneId: String(o.zoneId), count: o.count }, required, checkpointCode: null };
    case 'deliverCargo':
      return { type: 'CUSTOM', config: { tracked: true, kind: 'deliverCargo', count: o.count, ...(o.zoneId && { zoneId: String(o.zoneId) }) }, required, checkpointCode: null };
  }
}

/** A stored objective as the mission engine's objective, or null when the simulator can't track it. */
export function objectiveFromRow(o: Pick<StoredObjective, 'code' | 'title' | 'type' | 'config' | 'required' | 'checkpointCode'>): Objective | null {
  const base = { id: o.code, label: o.title, ...(!o.required && { optional: true }) };
  const c = o.config;
  switch (o.type) {
    case 'REACH_CHECKPOINT':
      return o.checkpointCode ? { ...base, type: 'reachCheckpoint', checkpointId: entityId(o.checkpointCode) } : null;
    case 'REACH_ALL_CHECKPOINTS':
      return { ...base, type: 'reachAllCheckpoints', ordered: c.ordered === true };
    case 'REACH_GOAL':
      return { ...base, type: 'reachFinish' };
    case 'AVOID_COLLISIONS':
      return { ...base, type: 'avoidCollisions', maxCollisions: isNum(c.maxCollisions) ? c.maxCollisions : 0 };
    case 'FINISH_WITHIN':
      return isNum(c.seconds) ? { ...base, type: 'finishWithin', seconds: c.seconds } : null;
    case 'CUSTOM':
      if (c.tracked !== true || !isNum(c.count)) return null;
      if (c.kind === 'pushToZone' && isStr(c.zoneId)) return { ...base, type: 'pushToZone', zoneId: entityId(c.zoneId), count: c.count };
      if (c.kind === 'deliverCargo') return { ...base, type: 'deliverCargo', count: c.count, ...(isStr(c.zoneId) && { zoneId: entityId(c.zoneId) }) };
      return null;
    default:
      // START_PROGRAM, USE_MAX_BLOCKS: judged by the server from the program itself.
      return null;
  }
}

/** Stored objectives → the mission engine's objectives (the kinds the simulator can track). */
export const objectivesFromRows = (rows: readonly Pick<StoredObjective, 'code' | 'title' | 'type' | 'config' | 'required' | 'checkpointCode'>[]): Objective[] =>
  rows.map(objectiveFromRow).filter((o): o is Objective => o !== null);

/** The map JSON as a MapDefinition, or null when it isn't a complete map (e.g. a draft level). */
export function mapFromJson(raw: unknown, slug: string): MapDefinition | null {
  if (!isObj(raw) || !isObj(raw.size) || !isNum(raw.size.x) || !isNum(raw.size.z)) return null;
  if (!isPoint(raw.start) || !isObj(raw.finish) || !isPoint(raw.finish.center) || !Array.isArray(raw.entities)) return null;
  const heading = (raw.start as unknown as Record<string, unknown>).heading;
  return {
    ...(raw as unknown as MapDefinition),
    id: mapId(isStr(raw.id) && raw.id ? raw.id : `level-${slug}`),
    name: isStr(raw.name) ? raw.name : slug,
    schemaVersion: 1,
    gridSize: isNum(raw.gridSize) ? raw.gridSize : 0.5,
    floorColor: (isStr(raw.floorColor) ? raw.floorColor : 'white') as MapDefinition['floorColor'],
    start: { x: raw.start.x, z: raw.start.z, heading: isNum(heading) ? heading : 0 },
  };
}

export const DEFAULT_SCORING: ScoringRules = { completionPoints: 500, checkpointPoints: 100, timeBonus: null, efficiencyBonus: null, collisionPenalty: 100 };

/** Scoring rules from settings, or null when absent / malformed. */
export function scoringFromJson(raw: unknown): ScoringRules | null {
  if (!isObj(raw) || !isNum(raw.completionPoints) || !isNum(raw.checkpointPoints) || !isNum(raw.collisionPenalty)) return null;
  const bonus = <K extends string>(v: unknown, key: K): ({ [P in K]: number } & { maxPoints: number }) | null =>
    isObj(v) && isNum(v[key]) && isNum(v.maxPoints) ? ({ [key]: v[key], maxPoints: v.maxPoints } as { [P in K]: number } & { maxPoints: number }) : null;
  return {
    completionPoints: raw.completionPoints,
    checkpointPoints: raw.checkpointPoints,
    collisionPenalty: raw.collisionPenalty,
    timeBonus: bonus(raw.timeBonus, 'parSeconds'),
    efficiencyBonus: bonus(raw.efficiencyBonus, 'parBlocks'),
    ...(isNum(raw.bonusPoints) && { bonusPoints: raw.bonusPoints }),
  };
}

/** Numbers only (`mission.target` …), or null. */
export function numbersFromJson(v: unknown): Record<string, number> | null {
  if (!isObj(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) if (/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(k) && isNum(n)) out[k] = n;
  return out;
}

const isEntity = (v: unknown): v is MapEntity => isObj(v) && isStr(v.id) && isStr(v.type);

/** Layouts from settings: well-formed ones only (the map engine validates them when one is played). */
export function layoutsFromJson(v: unknown): LevelLayout[] | null {
  if (!Array.isArray(v)) return null;
  const out: LevelLayout[] = [];
  for (const raw of v) {
    if (!isObj(raw) || !isStr(raw.id)) continue;
    const add = Array.isArray(raw.add) ? raw.add.filter(isEntity) : null;
    const remove = strings(raw.remove);
    const data = numbersFromJson(raw.data);
    out.push({
      id: raw.id,
      ...(add && { add }),
      ...(remove && { remove }),
      ...(isObj(raw.start) && isNum(raw.start.x) && isNum(raw.start.z) && isNum(raw.start.heading) && { start: { x: raw.start.x, z: raw.start.z, heading: raw.start.heading } }),
      ...(isObj(raw.finish) && isObj(raw.finish.center) && { finish: raw.finish as unknown as NonNullable<LevelLayout['finish']> }),
      ...(data && { data }),
    });
  }
  return out.length ? out : null;
}

/** What the simulation needs to play a stored level. */
export interface PlayableLevel {
  readonly map: MapDefinition;
  readonly mission: MissionDefinition;
  readonly data?: Readonly<Record<string, number>>;
  readonly variants?: readonly LevelLayout[];
}

/** The stored parts of a level the simulation reads. */
export interface StoredLevel {
  readonly slug: string;
  readonly title: string;
  readonly briefDescription: string | null;
  readonly mapDefinition: unknown;
  readonly missionSettings: unknown;
  readonly objectives: readonly StoredObjective[];
}

/** The mission a stored level runs (same rules in the browser and on the server). */
export function missionFromStored(level: Omit<StoredLevel, 'mapDefinition'>, map: MapDefinition): MissionDefinition {
  const s = isObj(level.missionSettings) ? level.missionSettings : {};
  return {
    id: missionId(`mission-${level.slug}`),
    title: isStr(s.missionTitle) ? s.missionTitle : level.title,
    description: isStr(s.missionDescription) ? s.missionDescription : (level.briefDescription ?? ''),
    mapId: map.id,
    robotId: robotId('rover'),
    objectives: objectivesFromRows(level.objectives),
    timeLimit: isNum(s.timeLimit) ? s.timeLimit : null,
    failOnCollision: s.failOnCollision !== false,
    scoring: scoringFromJson(s.scoring) ?? DEFAULT_SCORING,
    ...(s.stopInFinish === true && { stopInFinish: true }),
    ...(s.orderedCheckpoints === true && { orderedCheckpoints: true }),
  };
}

/** A stored level as the simulation plays it, or null when it has no usable map. */
export function playableFromStored(level: StoredLevel): PlayableLevel | null {
  const map = mapFromJson(level.mapDefinition, level.slug);
  if (!map) return null;
  const s = isObj(level.missionSettings) ? level.missionSettings : {};
  const data = numbersFromJson(s.data);
  const variants = layoutsFromJson(s.variants);
  return {
    map,
    mission: missionFromStored(level, map),
    ...(data && Object.keys(data).length > 0 && { data }),
    ...(variants && { variants }),
  };
}
