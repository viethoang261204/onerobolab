import type { AccessMode, PrerequisiteGroup, Requirement, RequirementType } from '../api/types';

/*
 * Unlock rules in plain words, and conversion between the API's
 * prerequisite groups and the editor's draft. Groups are OR-ed; the
 * requirements inside one group are AND-ed.
 */

export const REQUIREMENT_TYPES: Record<RequirementType, string> = {
  LEVEL_COMPLETED: 'Complete a level',
  LEVEL_STARS: 'Earn stars on a level',
  WORLD_COMPLETED: 'Complete a world',
  TOTAL_STARS: 'Total stars',
  TOTAL_XP: 'Total XP',
  ACHIEVEMENT: 'Unlock an achievement',
};

/** "Complete First Steps", "3★ on First Steps", "15★ in total", … */
export function describeRequirement(r: Requirement): string {
  switch (r.type) {
    case 'LEVEL_COMPLETED':
      return `Complete ${r.levelTitle ?? r.levelSlug ?? 'a level'}`;
    case 'LEVEL_STARS':
      return `${r.stars ?? 0}★ on ${r.levelTitle ?? r.levelSlug ?? 'a level'}`;
    case 'WORLD_COMPLETED':
      return `Complete world ${r.worldName ?? ''}`.trim();
    case 'TOTAL_STARS':
      return `${r.stars ?? 0}★ in total`;
    case 'TOTAL_XP':
      return `${r.xp ?? 0} XP in total`;
    case 'ACHIEVEMENT':
      return `Achievement ${r.achievementName ?? ''}`.trim();
  }
}

/** Short form used after "After …": "First Steps", "all of Starter Island", "15★ in total". */
function shortRequirement(r: Requirement): string {
  switch (r.type) {
    case 'LEVEL_COMPLETED':
      return r.levelTitle ?? r.levelSlug ?? 'a level';
    case 'WORLD_COMPLETED':
      return `all of ${r.worldName ?? 'a world'}`;
    case 'ACHIEVEMENT':
      return `the “${r.achievementName ?? '?'}” achievement`;
    default:
      return describeRequirement(r);
  }
}

/** One line for tables: "After First Steps", "After A + B, or 15★ in total", "Unlocked for everyone". */
export function describeUnlock(accessMode: AccessMode, groups: readonly PrerequisiteGroup[]): string {
  if (accessMode === 'UNLOCKED') return 'Unlocked for everyone';
  if (accessMode === 'LOCKED') return 'Locked for everyone';
  const nonEmpty = groups.filter((g) => g.requirements.length > 0);
  if (!nonEmpty.length) return 'Always available';
  return `After ${nonEmpty.map((g) => g.requirements.map(shortRequirement).join(' + ')).join(', or ')}`;
}

// ── editor draft ────────────────────────────────────────────────────────

/** Editable requirement: every field present so form controls stay controlled. */
export interface RequirementDraft {
  type: RequirementType;
  levelId: string;
  worldId: string;
  achievementId: string;
  stars: number;
  xp: number;
}

export interface GroupDraft {
  key: string;
  requirements: RequirementDraft[];
}

let keySeq = 0;
const nextKey = () => `g${++keySeq}`;

export const emptyRequirement = (type: RequirementType = 'LEVEL_COMPLETED'): RequirementDraft => ({ type, levelId: '', worldId: '', achievementId: '', stars: 3, xp: 100 });

export const emptyGroup = (): GroupDraft => ({ key: nextKey(), requirements: [emptyRequirement()] });

export function toDraft(groups: readonly PrerequisiteGroup[]): GroupDraft[] {
  return groups.map((g) => ({
    key: nextKey(),
    requirements: g.requirements.map((r) => ({
      type: r.type,
      levelId: r.levelId ?? '',
      worldId: r.worldId ?? '',
      achievementId: r.achievementId ?? '',
      stars: r.stars ?? 3,
      xp: r.xp ?? 100,
    })),
  }));
}

/** Problems that would make the API reject the draft (shown before saving). */
export function draftProblems(groups: readonly GroupDraft[], selfId: string): string[] {
  const problems: string[] = [];
  groups.forEach((g, gi) => {
    if (!g.requirements.length) problems.push(`Rule group ${gi + 1} has no requirements.`);
    g.requirements.forEach((r, ri) => {
      const where = `Group ${gi + 1}, requirement ${ri + 1}`;
      if ((r.type === 'LEVEL_COMPLETED' || r.type === 'LEVEL_STARS') && !r.levelId) problems.push(`${where}: choose a level.`);
      if ((r.type === 'LEVEL_COMPLETED' || r.type === 'LEVEL_STARS') && r.levelId === selfId) problems.push(`${where}: a level cannot require itself.`);
      if (r.type === 'WORLD_COMPLETED' && !r.worldId) problems.push(`${where}: choose a world.`);
      if (r.type === 'ACHIEVEMENT' && !r.achievementId) problems.push(`${where}: choose an achievement.`);
    });
  });
  return problems;
}

/** Draft → API body (`PUT /api/admin/levels/:id/prerequisites`). */
export function fromDraft(groups: readonly GroupDraft[]): { requirements: Record<string, unknown>[] }[] {
  return groups
    .filter((g) => g.requirements.length)
    .map((g) => ({
      requirements: g.requirements.map((r) => {
        switch (r.type) {
          case 'LEVEL_COMPLETED':
            return { type: r.type, levelId: r.levelId };
          case 'LEVEL_STARS':
            return { type: r.type, levelId: r.levelId, stars: r.stars };
          case 'WORLD_COMPLETED':
            return { type: r.type, worldId: r.worldId };
          case 'TOTAL_STARS':
            return { type: r.type, stars: r.stars };
          case 'TOTAL_XP':
            return { type: r.type, xp: r.xp };
          case 'ACHIEVEMENT':
            return { type: r.type, achievementId: r.achievementId };
        }
      }),
    }));
}
