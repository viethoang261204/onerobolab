import { CATEGORIES, categoryOf, type BlockCategoryId, type CategoryDef } from '@robolab/blocks';
import { createMapEngine } from '@robolab/map-engine';
import type { MapQuery } from '@robolab/shared';
import type { LucideIcon } from 'lucide-react';
import type { LevelDefinition } from '../../content/levels/types';
import { buildMissionView } from '../../data/mission';
import { messagesFor, type Locale } from '../i18n/i18n';
import { CATEGORY_ICONS } from '../programming/toolbox/category-icons';
import { levelSelectionMessages } from './level-selection.messages';

/*
 * Read-only views of level data for the mission cards / detail panel.
 * Everything comes from the level definition — nothing is authored twice.
 */

function categoryLabel(id: BlockCategoryId, fallback: string, locale?: Locale): string {
  const m = messagesFor(levelSelectionMessages, locale);
  switch (id) {
    case 'events':
      return m.catEvents;
    case 'movement':
      return m.catMovement;
    case 'control':
      return m.catControl;
    case 'sensors':
      return m.catSensors;
    case 'logic':
      return m.catLogic;
    case 'math':
      return m.catMath;
    case 'variables':
      return m.catVariables;
    case 'functions':
      return m.catFunctions;
    default:
      return fallback;
  }
}

/** Objective labels, exactly as the in-simulator mission card words them. */
export const levelObjectives = (level: LevelDefinition): string[] => buildMissionView(level.mission, level.map, null).objectives.map((o) => o.label);

/** Block categories the student can use in this level ("Available tools"), minus Events (always there). */
export function levelTools(level: LevelDefinition, locale?: Locale): (CategoryDef & { readonly icon: LucideIcon })[] {
  const ids = level.allowedBlocks === 'all' ? null : new Set(level.allowedBlocks.map((t) => categoryOf(t).id));
  return CATEGORIES.filter((c) => c.id !== 'events' && (!ids || ids.has(c.id))).map((c) => ({
    ...c,
    label: categoryLabel(c.id, c.label, locale),
    icon: CATEGORY_ICONS[c.id],
  }));
}

/** Star criteria in words (same rules as `stars.ts`). */
export function starGoals(level: LevelDefinition, locale?: Locale): string[] {
  const m = messagesFor(levelSelectionMessages, locale);
  const goals = [m.starComplete];
  if (level.stars.parBlocks !== undefined) goals.push(m.starBlocks({ n: level.stars.parBlocks }));
  if (level.stars.parSeconds !== undefined) goals.push(m.starTime({ n: level.stars.parSeconds }));
  return goals;
}

const engine = createMapEngine();
const queries = new Map<string, MapQuery>();
/** Cached map query for previews (maps are static data). */
export function levelMapQuery(level: LevelDefinition): MapQuery {
  let q = queries.get(level.map.id);
  if (!q) queries.set(level.map.id, (q = engine.load(level.map)));
  return q;
}
