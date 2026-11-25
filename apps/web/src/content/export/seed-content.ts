import { objectiveToRow } from '@robolab/simulation';
import type { MapEntity, Objective } from '@robolab/shared';
import { missionSettingsOf } from '../../features/catalog/mission-settings';
import { ENVIRONMENTS, type EnvironmentInfo } from '../../features/simulator/environments/catalog';
import { LEVELS } from '../levels/registry';
import type { LevelDefinition } from '../levels/types';
import { WORLDS } from '../worlds/registry';
import type { WorldDefinition } from '../worlds/types';

/*
 * Pure exporter: bundled worlds, environments and levels → deterministic
 * PostgreSQL INSERT statements for `database/seed.sql`.
 *
 * The generated block sits between `BEGIN_GENERATED_MARKER` and
 * `END_GENERATED_MARKER` in `database/seed.sql`. Hand-written seed data
 * (roles, permissions, accounts, achievements, curricula, planned draft
 * levels, lessons and sample activity) stays outside the markers.
 */

export const BEGIN_GENERATED_MARKER = '-- BEGIN GENERATED CONTENT';
export const END_GENERATED_MARKER = '-- END GENERATED CONTENT';

const DIFFICULTY = ['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const;
const DEFAULT_ESTIMATED_MINUTES = [8, 12, 15, 20, 25] as const;

type PrerequisiteType = 'LEVEL_COMPLETED' | 'LEVEL_STARS' | 'WORLD_COMPLETED' | 'TOTAL_STARS' | 'TOTAL_XP' | 'ACHIEVEMENT';

interface PrerequisiteRequirement {
  readonly requirementType: PrerequisiteType;
  readonly prereqLevel?: string;
  readonly prereqWorld?: string;
  readonly achievement?: string;
  readonly requiredStars?: number;
  readonly requiredXp?: number;
}

interface PrerequisiteGroupSpec {
  readonly name: string;
  readonly requirements: readonly PrerequisiteRequirement[];
}

/**
 * Hand-designed cross-world unlock rules for the first level of a world.
 * Worlds without an explicit override default to completing the previous world.
 */
const WORLD_ENTRY_RULES: Readonly<Record<string, readonly PrerequisiteGroupSpec[]>> = {
  'canyon-01': [
    { name: 'Graduate from Starter Island', requirements: [{ requirementType: 'WORLD_COMPLETED', prereqWorld: 'starter-island' }] },
  ],
  'frost-01': [
    { name: 'Complete Canyon Circuit', requirements: [{ requirementType: 'WORLD_COMPLETED', prereqWorld: 'canyon-circuit' }] },
    {
      name: 'Or: a strong start in the canyon',
      requirements: [
        { requirementType: 'LEVEL_COMPLETED', prereqLevel: 'canyon-01' },
        { requirementType: 'TOTAL_STARS', requiredStars: 15 },
      ],
    },
  ],
  'jungle-01': [
    {
      name: 'Rescue the supplies with 2+ stars',
      requirements: [{ requirementType: 'LEVEL_COMPLETED', prereqLevel: 'frost-01', requiredStars: 2 }],
    },
    {
      name: 'Or: bridge builder with 800 XP',
      requirements: [
        { requirementType: 'ACHIEVEMENT', achievement: 'bridge-builder' },
        { requirementType: 'TOTAL_XP', requiredXp: 800 },
      ],
    },
  ],
};

export interface SeedContentInput {
  readonly worlds?: readonly WorldDefinition[];
  readonly levels?: readonly LevelDefinition[];
  readonly environments?: readonly EnvironmentInfo[];
}

const compareStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Deterministic JSON.stringify with recursively sorted object keys. */
export function stableJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(Object.is(value, -0) ? 0 : value) : 'null';
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableJson(v))).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(compareStr);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`;
  }
  return 'null';
}

const sqlStr = (value: string): string => `'${value.replace(/\r\n/g, '\n').replace(/'/g, "''")}'`;
const sqlNullableNum = (value: number | undefined | null): string => (value === undefined || value === null ? 'NULL' : String(value));
const sqlJsonb = (value: unknown): string => `${sqlStr(stableJson(value))}::jsonb`;
const sqlTextArray = (values: readonly string[]): string => (values.length === 0 ? `'{}'::text[]` : `ARRAY[${values.map(sqlStr).join(', ')}]::text[]`);

const curriculumSlugFor = (world: WorldDefinition): string => (world.order <= 3 ? 'robotics-foundations' : 'robotics-explorers');

function objectiveTitle(o: Objective): string {
  if (o.label) return o.label;
  switch (o.type) {
    case 'avoidCollisions':
      return 'Don’t hit any obstacles';
    case 'reachFinish':
      return 'Reach the goal';
    case 'reachCheckpoint':
      return `Reach checkpoint ${String(o.checkpointId)}`;
    case 'reachAllCheckpoints':
      return 'Reach all checkpoints';
    case 'finishWithin':
      return `Finish within ${o.seconds} s`;
    case 'pushToZone':
      return `Push ${o.count} blocks into zone`;
    case 'deliverCargo':
      return `Deliver ${o.count} crates`;
  }
}

type CheckpointEntity = Extract<MapEntity, { type: 'checkpoint' }>;

function checkpointRadius(cp: CheckpointEntity): number {
  return cp.area.shape === 'circle' ? cp.area.radius : Math.min(cp.area.size.x, cp.area.size.z) / 2;
}

function buildEnvironmentsSql(environments: readonly EnvironmentInfo[], worlds: readonly WorldDefinition[]): string {
  const rows: string[] = [];
  for (const env of environments) {
    const config = env.chase ? { lighting: env.lighting, chase: env.chase } : { lighting: env.lighting };
    rows.push(
      `  (${sqlStr(env.id)}, ${sqlStr(env.name)}, 'LEVEL', ${sqlStr(env.theme)}, ${sqlStr(env.summary)}, ${sqlJsonb(config)}, 'PUBLISHED')`,
    );
  }
  for (const world of worlds) {
    rows.push(
      `  (${sqlStr(`world-${world.id}`)}, ${sqlStr(`${world.name} diorama`)}, 'WORLD_PREVIEW', ${sqlStr(world.theme)}, ${sqlStr(`World-map miniature of ${world.name}.`)}, '{}'::jsonb, 'PUBLISHED')`,
    );
  }
  return [
    '-- -----------------------------------------------------------------------------',
    '-- Environments (ids = the frontend EnvironmentRegistry keys)',
    '-- -----------------------------------------------------------------------------',
    'INSERT INTO environments (id, name, kind, theme, description, config, status) VALUES',
    `${rows.join(',\n')};`,
  ].join('\n');
}

function buildWorldsSql(worlds: readonly WorldDefinition[]): string {
  const rows = worlds.map(
    (w) =>
      `  ((SELECT id FROM curricula WHERE slug = ${sqlStr(curriculumSlugFor(w))}), ${sqlStr(w.name)}, ${sqlStr(w.id)}, ${sqlStr(w.tagline)}, ${sqlStr(w.description)}, ${sqlStr(w.theme)}, ${sqlStr(w.color)}, ${sqlTextArray(w.skills)}, ${sqlStr(DIFFICULTY[w.difficulty - 1]!)}, ${sqlStr(`world-${w.id}`)}, ${sqlJsonb(w.mapPosition)}, ${w.order}, 'PUBLISHED', TRUE)`,
  );
  return [
    '-- -----------------------------------------------------------------------------',
    '-- Worlds',
    '-- -----------------------------------------------------------------------------',
    'INSERT INTO worlds (curriculum_id, name, slug, short_description, description, theme, accent_color, skills, difficulty, environment_id, map_position, sort_order, status, is_visible) VALUES',
    `${rows.join(',\n')};`,
  ].join('\n');
}

function buildLevelsSql(levels: readonly LevelDefinition[], envById: ReadonlyMap<string, EnvironmentInfo>): string {
  const statements: string[] = [
    '-- -----------------------------------------------------------------------------',
    '-- Levels (each with its own environment, map and scene)',
    '-- -----------------------------------------------------------------------------',
  ];

  for (const level of levels) {
    const env = envById.get(level.environmentId);
    if (!env) throw new Error(`Level "${level.id}" references unknown environment "${level.environmentId}".`);
    const fullDescription = `${level.description} Environment: ${env.name} — ${env.summary}`;
    const estimatedMinutes = level.briefing?.minutes ?? DEFAULT_ESTIMATED_MINUTES[level.difficulty - 1]!;
    const allowedBlocksSql = level.allowedBlocks === 'all' ? 'NULL' : sqlTextArray(level.allowedBlocks);
    const introSql = sqlTextArray(level.intro);

    statements.push(
      [
        'INSERT INTO levels (world_id, slug, title, brief_description, description, difficulty, sort_order, status, visibility, access_mode, environment_id,',
        '                    estimated_minutes, xp_reward, max_stars, par_blocks, par_seconds, allowed_blocks, intro_steps, map_definition, scene_config, mission_settings, created_by)',
        `VALUES ((SELECT id FROM worlds WHERE slug = ${sqlStr(level.world)}), ${sqlStr(level.id)}, ${sqlStr(level.title)}, ${sqlStr(level.description)},`,
        `        ${sqlStr(fullDescription)},`,
        `        ${sqlStr(DIFFICULTY[level.difficulty - 1]!)}, ${level.number}, 'PUBLISHED', 'VISIBLE', 'AUTO', ${sqlStr(level.environmentId)},`,
        `        ${estimatedMinutes}, ${level.rewards.xp}, 3, ${sqlNullableNum(level.stars.parBlocks)}, ${sqlNullableNum(level.stars.parSeconds)}, ${allowedBlocksSql}, ${introSql},`,
        `        ${sqlJsonb(level.map)},`,
        `        ${sqlJsonb(level.scene)},`,
        `        ${sqlJsonb(missionSettingsOf(level))}, (SELECT id FROM users WHERE username_normalized = 'admin'));`,
      ].join('\n'),
    );
  }

  return statements.join('\n\n');
}

function buildLevelDetailsSql(levels: readonly LevelDefinition[]): string {
  const blocks: string[] = [
    '-- -----------------------------------------------------------------------------',
    '-- Checkpoints, objectives, hints',
    '-- -----------------------------------------------------------------------------',
  ];

  for (const level of levels) {
    const parts: string[] = [];

    const checkpoints = level.map.entities
      .filter((e): e is CheckpointEntity => e.type === 'checkpoint')
      .sort((a, b) => a.order - b.order || compareStr(String(a.id), String(b.id)));

    if (checkpoints.length > 0) {
      const cpRows = checkpoints.map((cp) => {
        const code = String(cp.id);
        const matchingObj = level.mission.objectives.find((o) => o.type === 'reachCheckpoint' && String(o.checkpointId) === code);
        const name = matchingObj?.label ?? `Checkpoint ${cp.order}`;
        const pos = { x: cp.area.center.x, y: 0, z: cp.area.center.z };
        return `  ((SELECT id FROM levels WHERE slug = ${sqlStr(level.id)}), ${sqlStr(code)}, ${sqlStr(name)}, ${cp.order}, ${sqlJsonb(pos)}, ${checkpointRadius(cp)})`;
      });
      parts.push(`INSERT INTO level_checkpoints (level_id, code, name, sort_order, position, radius) VALUES\n${cpRows.join(',\n')};`);
    }

    if (level.mission.objectives.length > 0) {
      const objRows = level.mission.objectives.map((o, idx) => {
        const row = objectiveToRow(o);
        const checkpointIdSql = row.checkpointCode
          ? `(SELECT id FROM level_checkpoints WHERE level_id = (SELECT id FROM levels WHERE slug = ${sqlStr(level.id)}) AND code = ${sqlStr(row.checkpointCode)})`
          : 'NULL';
        return `  ((SELECT id FROM levels WHERE slug = ${sqlStr(level.id)}), ${sqlStr(o.id)}, ${sqlStr(objectiveTitle(o))}, ${sqlStr(row.type)}, ${checkpointIdSql}, ${sqlJsonb(row.config)}, ${idx + 1}, ${row.required ? 'TRUE' : 'FALSE'})`;
      });
      parts.push(
        `INSERT INTO level_objectives (level_id, code, title, objective_type, checkpoint_id, config, sort_order, required) VALUES\n${objRows.join(',\n')};`,
      );
    }

    if (level.hints.length > 0) {
      const hintRows = level.hints.map((h, idx) => {
        const cost = idx === level.hints.length - 1 ? 10 : 0;
        return `  ((SELECT id FROM levels WHERE slug = ${sqlStr(level.id)}), ${sqlStr(`Hint ${idx + 1}`)}, ${sqlStr(h)}, ${cost}, ${idx + 1})`;
      });
      parts.push(`INSERT INTO level_hints (level_id, title, content, cost, sort_order) VALUES\n${hintRows.join(',\n')};`);
    }

    if (parts.length > 0) blocks.push(parts.join('\n'));
  }

  return blocks.join('\n\n');
}

function buildPrerequisitesSql(worlds: readonly WorldDefinition[], levels: readonly LevelDefinition[]): string {
  const levelsByWorld = new Map<string, LevelDefinition[]>();
  for (const level of levels) {
    const list = levelsByWorld.get(level.world) ?? [];
    list.push(level);
    levelsByWorld.set(level.world, list);
  }
  const levelSlugs = new Set(levels.map((l) => l.id));
  const worldSlugs = new Set(worlds.map((w) => w.id));

  const groupRows: string[] = [];
  const reqRows: {
    levelSlug: string;
    groupOrder: number;
    req: PrerequisiteRequirement;
  }[] = [];

  for (let wi = 0; wi < worlds.length; wi++) {
    const world = worlds[wi]!;
    const worldLevels = levelsByWorld.get(world.id) ?? [];
    for (let li = 0; li < worldLevels.length; li++) {
      const level = worldLevels[li]!;
      let groups: readonly PrerequisiteGroupSpec[] = [];

      const override = WORLD_ENTRY_RULES[level.id];
      if (
        override &&
        override.every((g) =>
          g.requirements.every(
            (r) => (!r.prereqLevel || levelSlugs.has(r.prereqLevel)) && (!r.prereqWorld || worldSlugs.has(r.prereqWorld)),
          ),
        )
      ) {
        groups = override;
      } else if (li > 0) {
        const prev = worldLevels[li - 1]!;
        groups = [{ name: `Finish ${prev.title}`, requirements: [{ requirementType: 'LEVEL_COMPLETED', prereqLevel: prev.id }] }];
      } else if (wi > 0) {
        const prevWorld = worlds[wi - 1]!;
        groups = [{ name: `Complete ${prevWorld.name}`, requirements: [{ requirementType: 'WORLD_COMPLETED', prereqWorld: prevWorld.id }] }];
      }

      groups.forEach((group, gi) => {
        const sortOrder = gi + 1;
        groupRows.push(`    (${sqlStr(level.id)}, ${sqlStr(group.name)}, ${sortOrder})`);
        for (const req of group.requirements) {
          reqRows.push({ levelSlug: level.id, groupOrder: sortOrder, req });
        }
      });
    }
  }

  if (groupRows.length === 0) return '';

  const formattedReqs = reqRows.map(({ levelSlug, groupOrder, req }, i) => {
    const first = i === 0;
    const strVal = (v: string | undefined) => (v !== undefined ? sqlStr(v) : first ? 'NULL::text' : 'NULL');
    const intVal = (v: number | undefined) => (v !== undefined ? String(v) : first ? 'NULL::int' : 'NULL');
    return `    (${sqlStr(levelSlug)}, ${groupOrder}, ${sqlStr(req.requirementType)}, ${strVal(req.prereqLevel)}, ${strVal(req.prereqWorld)}, ${strVal(req.achievement)}, ${intVal(req.requiredStars)}, ${intVal(req.requiredXp)})`;
  });

  return [
    '-- -----------------------------------------------------------------------------',
    '-- Unlock rules: a level unlocks when ANY group has ALL its requirements met',
    '-- -----------------------------------------------------------------------------',
    'INSERT INTO level_prerequisite_groups (level_id, name, sort_order)',
    'SELECT l.id, g.name, g.sort_order',
    '  FROM (VALUES',
    groupRows.join(',\n'),
    '  ) AS g(level_slug, name, sort_order)',
    '  JOIN levels l ON l.slug = g.level_slug;',
    '',
    'INSERT INTO level_prerequisites (group_id, level_id, requirement_type, prerequisite_level_id, prerequisite_world_id, achievement_id, required_stars, required_xp)',
    'SELECT g.id, g.level_id, r.requirement_type::prerequisite_type,',
    '       (SELECT id FROM levels WHERE slug = r.prereq_level),',
    '       (SELECT id FROM worlds WHERE slug = r.prereq_world),',
    '       (SELECT id FROM achievements WHERE slug = r.achievement),',
    '       r.required_stars, r.required_xp',
    '  FROM (VALUES',
    formattedReqs.join(',\n'),
    '  ) AS r(level_slug, group_order, requirement_type, prereq_level, prereq_world, achievement, required_stars, required_xp)',
    '  JOIN levels l ON l.slug = r.level_slug',
    '  JOIN level_prerequisite_groups g ON g.level_id = l.id AND g.sort_order = r.group_order;',
  ].join('\n');
}

/**
 * Pure exporter: generates the SQL block for all bundled environments, worlds,
 * levels, checkpoints, objectives, hints and unlock rules.
 */
export function exportSeedContent(input: SeedContentInput = {}): string {
  const worlds = [...(input.worlds ?? WORLDS)].sort((a, b) => a.order - b.order || compareStr(a.id, b.id));
  const worldOrder = new Map(worlds.map((w, idx) => [w.id, idx]));
  const levels = [...(input.levels ?? LEVELS)].sort(
    (a, b) =>
      (worldOrder.get(a.world) ?? Number.MAX_SAFE_INTEGER) - (worldOrder.get(b.world) ?? Number.MAX_SAFE_INTEGER) ||
      a.number - b.number ||
      compareStr(a.id, b.id),
  );
  const environments = input.environments ?? ENVIRONMENTS;
  const envById = new Map(environments.map((e) => [e.id, e]));

  const sections = [
    buildEnvironmentsSql(environments, worlds),
    buildWorldsSql(worlds),
    buildLevelsSql(levels, envById),
    buildLevelDetailsSql(levels),
    buildPrerequisitesSql(worlds, levels),
  ].filter(Boolean);

  return sections.join('\n\n');
}

/** Extracts the block between `BEGIN_GENERATED_MARKER` and `END_GENERATED_MARKER`. */
export function extractGeneratedContent(seedSql: string): string {
  const normalized = seedSql.replace(/\r\n/g, '\n');
  const beginIdx = normalized.indexOf(BEGIN_GENERATED_MARKER);
  const endIdx = normalized.indexOf(END_GENERATED_MARKER);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`database/seed.sql must contain ${BEGIN_GENERATED_MARKER} followed by ${END_GENERATED_MARKER}.`);
  }
  const contentStart = normalized.indexOf('\n', beginIdx);
  if (contentStart === -1 || contentStart > endIdx) {
    throw new Error(`Malformed ${BEGIN_GENERATED_MARKER} marker in database/seed.sql.`);
  }
  return normalized.slice(contentStart + 1, endIdx).replace(/\n$/, '');
}

/** Replaces the block between `BEGIN_GENERATED_MARKER` and `END_GENERATED_MARKER`, preserving everything outside. */
export function replaceGeneratedContent(seedSql: string, generatedContent: string): string {
  const normalized = seedSql.replace(/\r\n/g, '\n');
  const beginIdx = normalized.indexOf(BEGIN_GENERATED_MARKER);
  const endIdx = normalized.indexOf(END_GENERATED_MARKER);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`database/seed.sql must contain ${BEGIN_GENERATED_MARKER} followed by ${END_GENERATED_MARKER}.`);
  }
  if (normalized.indexOf(BEGIN_GENERATED_MARKER, beginIdx + 1) !== -1 || normalized.indexOf(END_GENERATED_MARKER, endIdx + 1) !== -1) {
    throw new Error(`database/seed.sql must contain exactly one pair of generated content markers.`);
  }
  const before = normalized.slice(0, beginIdx);
  const after = normalized.slice(endIdx + END_GENERATED_MARKER.length);
  return `${before}${BEGIN_GENERATED_MARKER}\n${generatedContent.trimEnd()}\n${END_GENERATED_MARKER}${after}`;
}
