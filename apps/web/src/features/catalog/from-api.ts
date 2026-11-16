import { entityId, mapId, missionId, robotId, type MapDefinition, type MissionDefinition, type Objective, type Vec2 } from '@robolab/shared';
import type { LevelDefinition, LevelScene } from '../../content/levels/types';
import type { WorldDefinition, WorldTheme } from '../../content/worlds/types';
import type { ApiDifficulty, ApiLevel, ApiObjective, ApiWorld, Catalog } from '../account/student-api';
import type { BlockType } from '../programming/blocks/block-types';
import { isBlockType } from '../programming/blocks/block-registry';
import { isEnvironmentId } from '../simulator/environments/catalog';
import type { LevelProgress, LevelStatus, ProgressData, ServerProgress } from '../levels/progress';
import { briefingFrom, levelExtrasFrom, scoringFrom } from './mission-settings';
import { objectiveFromRow } from './objective-codec';

/*
 * API catalog → the app's content model (WorldDefinition / LevelDefinition)
 * and progress. The database content is an export of the same model (see
 * database/seed.sql), so this is its inverse; bundled content only fills
 * purely visual gaps (camera preset, world-map position of a known world).
 * Pure and tested.
 */

const DIFFICULTY: Record<ApiDifficulty, 1 | 2 | 3 | 4 | 5> = { BEGINNER: 1, EASY: 2, MEDIUM: 3, HARD: 4, EXPERT: 5 };
const THEMES: readonly WorldTheme[] = ['starter', 'canyon', 'frost', 'jungle', 'skylab', 'lava'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (v: unknown): v is Vec2 => isObj(v) && isNum(v.x) && isNum(v.z);

/** The map JSON as a MapDefinition, or null when it isn't a complete map (e.g. a draft level). */
export function toMap(raw: unknown, slug: string): MapDefinition | null {
  if (!isObj(raw) || !isObj(raw.size) || !isNum(raw.size.x) || !isNum(raw.size.z)) return null;
  if (!isPoint(raw.start) || !isObj(raw.finish) || !isPoint(raw.finish.center) || !Array.isArray(raw.entities)) return null;
  const heading = (raw.start as unknown as Record<string, unknown>).heading;
  return {
    ...(raw as unknown as MapDefinition),
    id: mapId(typeof raw.id === 'string' && raw.id ? raw.id : `level-${slug}`),
    name: typeof raw.name === 'string' ? raw.name : slug,
    schemaVersion: 1,
    gridSize: isNum(raw.gridSize) ? raw.gridSize : 0.5,
    floorColor: (typeof raw.floorColor === 'string' ? raw.floorColor : 'white') as MapDefinition['floorColor'],
    start: { x: raw.start.x, z: raw.start.z, heading: isNum(heading) ? heading : 0 },
  };
}

/** Scene layout; without one, a straight road from start to goal. */
export function toScene(raw: unknown, map: MapDefinition): LevelScene {
  if (isObj(raw) && Array.isArray(raw.path) && raw.path.length >= 2 && raw.path.every(isPoint) && isNum(raw.pathWidth)) return raw as unknown as LevelScene;
  return { path: [{ x: map.start.x, z: map.start.z }, { x: map.finish.center.x, z: map.finish.center.z }], pathWidth: 0.7 };
}

/** API objectives → mission-engine objectives (the kinds the simulator can track). */
export function toObjectives(objectives: readonly ApiObjective[]): Objective[] {
  return objectives.map(objectiveFromRow).filter((o): o is Objective => o !== null);
}

export function worldFromApi(w: ApiWorld, bundled?: WorldDefinition): WorldDefinition {
  const pos = w.mapPosition;
  const angle = (w.order - 1) * ((Math.PI * 2) / 6);
  return {
    id: w.slug,
    order: w.order,
    name: w.name,
    tagline: w.shortDescription ?? '',
    description: w.description ?? '',
    theme: (THEMES as readonly string[]).includes(w.theme) ? (w.theme as WorldTheme) : (bundled?.theme ?? 'starter'),
    color: w.accentColor ?? bundled?.color ?? '#94a3b8',
    skills: w.skills,
    difficulty: DIFFICULTY[w.difficulty],
    mapPosition:
      pos && isNum(pos.x) && isNum(pos.z)
        ? { x: pos.x, y: isNum(pos.y) ? pos.y : 0, z: pos.z }
        : (bundled?.mapPosition ?? { x: Math.cos(angle) * 5, y: 0, z: Math.sin(angle) * 4 }),
  };
}

/**
 * One level. Returns null when this app build can't show it (unknown 3D
 * environment, or no usable map) — never a half-built level.
 */
export function levelFromApi(l: ApiLevel, number: number, bundled?: LevelDefinition): LevelDefinition | null {
  if (!isEnvironmentId(l.environmentId)) return null;
  const map = toMap(l.mapDefinition, l.slug) ?? bundled?.map ?? null;
  if (!map) return null;
  const c = l.content;
  const settings = c?.missionSettings ?? {};
  const mission: MissionDefinition = c
    ? {
        id: missionId(`mission-${l.slug}`),
        title: typeof settings.missionTitle === 'string' ? settings.missionTitle : l.title,
        description: typeof settings.missionDescription === 'string' ? settings.missionDescription : (l.briefDescription ?? ''),
        mapId: map.id,
        robotId: robotId('rover'),
        objectives: toObjectives(c.objectives),
        timeLimit: isNum(settings.timeLimit) ? settings.timeLimit : null,
        failOnCollision: settings.failOnCollision !== false,
        scoring: scoringFrom(settings.scoring) ?? { completionPoints: 500, checkpointPoints: 100, timeBonus: null, efficiencyBonus: null, collisionPenalty: 100 },
        ...(settings.stopInFinish === true && { stopInFinish: true }),
        ...(settings.orderedCheckpoints === true && { orderedCheckpoints: true }),
      }
    : (bundled?.mission ?? {
        // Locked level: shown on cards only, never run.
        id: missionId(`mission-${l.slug}`),
        title: l.title,
        description: l.briefDescription ?? '',
        mapId: map.id,
        robotId: robotId('rover'),
        objectives: [],
        timeLimit: null,
        failOnCollision: true,
        scoring: { completionPoints: 500, checkpointPoints: 100, timeBonus: null, efficiencyBonus: null, collisionPenalty: 100 },
      });
  const allowed = c ? c.allowedBlocks : null;
  const briefing = c ? briefingFrom(settings.briefing) : (bundled?.briefing ?? null);
  return {
    id: l.slug,
    world: l.worldSlug,
    number,
    title: l.title,
    description: l.briefDescription ?? l.description ?? '',
    difficulty: DIFFICULTY[l.difficulty],
    map,
    environmentId: l.environmentId,
    scene: toScene(l.sceneConfig, map),
    mission,
    allowedBlocks: allowed === null ? (c ? 'all' : (bundled?.allowedBlocks ?? 'all')) : allowed.filter((b): b is BlockType => isBlockType(b)),
    intro: c?.introSteps ?? [],
    hints: (c?.hints ?? []).map((h) => h.content ?? ''),
    stars: { ...(l.parBlocks !== null && { parBlocks: l.parBlocks }), ...(l.parSeconds !== null && { parSeconds: l.parSeconds }) },
    rewards: { xp: l.xpReward },
    ...(bundled?.camera && { camera: bundled.camera }),
    ...(briefing && { briefing }),
    ...(c ? levelExtrasFrom(settings) : bundledExtras(bundled)),
    server: {
      id: l.id,
      contentVersion: l.contentVersion,
      playable: c !== null,
      hints: (c?.hints ?? []).map((h) => ({ id: h.id, title: h.title, cost: h.cost, revealed: h.content !== null })),
      objectives: (c?.objectives ?? []).map((o) => ({ code: o.code, title: o.title, type: o.type, required: o.required })),
      maxStars: l.maxStars,
      estimatedMinutes: l.estimatedMinutes,
    },
  };
}

const STATUS: Record<ApiLevel['state'], LevelStatus> = { LOCKED: 'locked', DISABLED: 'locked', AVAILABLE: 'available', IN_PROGRESS: 'in_progress', COMPLETED: 'completed' };

export interface BuiltCatalog {
  readonly worlds: readonly WorldDefinition[];
  readonly levels: readonly LevelDefinition[];
  readonly progress: ProgressData;
  /** Levels this app build can't show (reported, not rendered). */
  readonly skipped: readonly string[];
}

/** The whole student journey from one `GET /api/catalog` answer. */
export function buildCatalog(c: Catalog, bundled: { levels: readonly LevelDefinition[]; worlds: readonly WorldDefinition[] }): BuiltCatalog {
  const worlds = [...c.worlds].sort((a, b) => a.order - b.order).map((w) => worldFromApi(w, bundled.worlds.find((b) => b.id === w.slug)));
  const worldOrder = new Map(worlds.map((w) => [w.id, w.order]));
  const apiLevels = c.levels.filter((l) => worldOrder.has(l.worldSlug)).sort((a, b) => worldOrder.get(a.worldSlug)! - worldOrder.get(b.worldSlug)! || a.sortOrder - b.sortOrder);

  const levels: LevelDefinition[] = [];
  const skipped: string[] = [];
  const numbers = new Map<string, number>();
  for (const l of apiLevels) {
    const n = (numbers.get(l.worldSlug) ?? 0) + 1;
    const level = levelFromApi(l, n, bundled.levels.find((b) => b.id === l.slug));
    if (!level) {
      skipped.push(l.slug);
      continue;
    }
    numbers.set(l.worldSlug, n);
    levels.push(level);
  }

  const byId = new Map(apiLevels.map((l) => [l.slug, l]));
  const progressLevels: Record<string, LevelProgress> = {};
  const states: Record<string, ServerProgress['states'][string]> = {};
  for (const level of levels) {
    const l = byId.get(level.id)!;
    states[level.id] = { status: STATUS[l.state], lockReason: l.lockReason, unlock: l.unlock ?? [] };
    if (l.progress) {
      progressLevels[level.id] = {
        completed: l.progress.status === 'COMPLETED',
        bestStars: l.progress.bestStars,
        bestTime: l.progress.bestTimeSeconds,
        attempts: l.progress.attemptCount,
        completedAt: l.progress.completedAt,
      };
    }
  }
  const last = c.lastLevelSlug && levels.some((l) => l.id === c.lastLevelSlug) ? c.lastLevelSlug : null;
  return {
    worlds,
    levels,
    skipped,
    progress: {
      version: 1,
      levels: progressLevels,
      lastLevelId: last,
      server: {
        states,
        stats: { xp: c.stats.totalXp, stars: c.stats.totalStars, levelsCompleted: c.stats.levelsCompleted, streak: c.stats.currentStreak },
      },
    },
  };
}

/** Locked levels show the bundled extras (if any) on their cards. */
function bundledExtras(l: LevelDefinition | undefined): Partial<Pick<LevelDefinition, 'data' | 'variants' | 'editor' | 'fog'>> {
  if (!l) return {};
  return { ...(l.data && { data: l.data }), ...(l.variants && { variants: l.variants }), ...(l.editor && { editor: l.editor }), ...(l.fog && { fog: true }) };
}
