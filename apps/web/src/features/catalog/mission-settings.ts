import type { ScoringRules } from '@robolab/shared';
import type { MapEntity } from '@robolab/shared';
import { MISSION_MECHANICS, type EditorMode, type LevelDefinition, type LevelVariant, type MissionBriefing, type MissionMechanic, type MissionTier } from '../../content/levels/types';

/*
 * `levels.mission_settings` (jsonb) ⇄ the mission framework fields of a
 * level: mission wording, collision / time rules, "stop in the finish",
 * scoring rules and the briefing. One place builds it (seed export, tests)
 * and one place reads it back (`from-api.ts`).
 */

export interface MissionSettings {
  readonly failOnCollision: boolean;
  readonly timeLimit: number | null;
  readonly missionTitle: string;
  readonly missionDescription: string;
  readonly stopInFinish?: boolean;
  readonly scoring?: ScoringRules;
  readonly briefing?: MissionBriefing;
  readonly orderedCheckpoints?: boolean;
  /** Mission data, layouts, editor stage and fog (`LevelDefinition` extras). */
  readonly data?: Readonly<Record<string, number>>;
  readonly variants?: readonly LevelVariant[];
  readonly editor?: EditorMode;
  readonly fog?: boolean;
}

/** What a level stores in `mission_settings`. */
export function missionSettingsOf(level: LevelDefinition): MissionSettings {
  const m = level.mission;
  return {
    failOnCollision: m.failOnCollision,
    timeLimit: m.timeLimit,
    missionTitle: m.title,
    missionDescription: m.description,
    ...(m.stopInFinish && { stopInFinish: true }),
    scoring: m.scoring,
    ...(level.briefing && { briefing: level.briefing }),
    ...(m.orderedCheckpoints && { orderedCheckpoints: true }),
    ...(level.data && { data: level.data }),
    ...(level.variants && { variants: level.variants }),
    ...(level.editor && { editor: level.editor }),
    ...(level.fog && { fog: true }),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string';
const strings = (v: unknown): string[] | null => (Array.isArray(v) && v.every(str) ? v : null);

/** Scoring rules from settings, or null when absent / malformed. */
export function scoringFrom(raw: unknown): ScoringRules | null {
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

const TIERS: readonly MissionTier[] = ['easy', 'medium', 'hard', 'boss'];
const MECHANICS: readonly MissionMechanic[] = MISSION_MECHANICS;

/** A briefing from settings, or null when absent / malformed (the level then shows no briefing). */
export function briefingFrom(raw: unknown): MissionBriefing | null {
  if (!isObj(raw) || !isObj(raw.objectives)) return null;
  const o = raw.objectives;
  const concepts = strings(raw.concepts);
  const python = strings(raw.python);
  const pseudocode = strings(raw.pseudocode);
  const mechanics = strings(raw.mechanics);
  if (!str(raw.story) || !str(raw.task) || !str(raw.predict) || !str(o.primary) || !str(o.secondary) || !str(o.optional)) return null;
  if (!concepts || !python || !pseudocode || !mechanics || !isNum(raw.minutes) || !TIERS.includes(raw.tier as MissionTier)) return null;
  return {
    story: raw.story,
    task: raw.task,
    objectives: { primary: o.primary, secondary: o.secondary, optional: o.optional },
    concepts,
    python,
    predict: raw.predict,
    pseudocode,
    minutes: raw.minutes,
    tier: raw.tier as MissionTier,
    // Unknown mechanics (from a newer content version) are ignored.
    mechanics: mechanics.filter((m): m is MissionMechanic => MECHANICS.includes(m as MissionMechanic)),
  };
}

const EDITORS: readonly EditorMode[] = ['blocks', 'split', 'python'];

/** Numbers only (`mission.target` …), or null. */
function numbers(v: unknown): Record<string, number> | null {
  if (!isObj(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) if (/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(k) && isNum(n)) out[k] = n;
  return out;
}

const isEntity = (v: unknown): v is MapEntity => isObj(v) && str(v.id) && str(v.type);

/** Layouts from settings: well-formed ones only (the map engine validates them when one is played). */
function variantsFrom(v: unknown): LevelVariant[] | null {
  if (!Array.isArray(v)) return null;
  const out: LevelVariant[] = [];
  for (const raw of v) {
    if (!isObj(raw) || !str(raw.id)) continue;
    const add = Array.isArray(raw.add) ? raw.add.filter(isEntity) : null;
    const remove = strings(raw.remove);
    const data = numbers(raw.data);
    out.push({
      id: raw.id,
      ...(add && { add }),
      ...(remove && { remove }),
      ...(isObj(raw.start) && isNum(raw.start.x) && isNum(raw.start.z) && isNum(raw.start.heading) && { start: { x: raw.start.x, z: raw.start.z, heading: raw.start.heading } }),
      ...(isObj(raw.finish) && isObj(raw.finish.center) && { finish: raw.finish as unknown as NonNullable<LevelVariant['finish']> }),
      ...(data && { data }),
    });
  }
  return out.length ? out : null;
}

/** The level extras stored in settings (mission data, layouts, editor stage, fog). */
export function levelExtrasFrom(settings: Record<string, unknown>): Partial<Pick<LevelDefinition, 'data' | 'variants' | 'editor' | 'fog'>> {
  const data = numbers(settings.data);
  const variants = variantsFrom(settings.variants);
  return {
    ...(data && Object.keys(data).length > 0 && { data }),
    ...(variants && { variants }),
    ...(EDITORS.includes(settings.editor as EditorMode) && settings.editor !== 'blocks' && { editor: settings.editor as EditorMode }),
    ...(settings.fog === true && { fog: true }),
  };
}
