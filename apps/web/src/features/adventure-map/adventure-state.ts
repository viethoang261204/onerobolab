import type { LevelDefinition } from '../../content/levels/types';
import { lockMessage } from '../levels/lock-reason';
import type { LevelStatus, ProgressData } from '../levels/progress';
import type { AdventureLayout, AdventureStopDef, AdventureView, PlacedStop, SegmentState, StopStatus, StopView } from './adventure.types';

/*
 * The student's view of a world map, derived (never stored) from:
 *   – the world's real levels (LevelRegistry / API catalog), bound to stops;
 *   – the level progress (server states when signed in).
 * Planned stops (no level yet) are locked with a "coming soon" reason.
 * Checkpoints and gates are passed when every mission before them is done.
 */

const PLANNED_REASON = 'This mission is still being built. It will appear here soon.';

/** Real levels → stops: explicit `levelId` first, then missions and the final in order (never challenges implicitly). */
export function bindLevels(stops: readonly AdventureStopDef[], levels: readonly LevelDefinition[]): Map<string, LevelDefinition> {
  const out = new Map<string, LevelDefinition>();
  const byId = new Map(levels.map((l) => [l.id, l]));
  const used = new Set<string>();
  for (const s of stops) {
    const l = s.levelId ? byId.get(s.levelId) : undefined;
    if (l) {
      out.set(s.id, l);
      used.add(l.id);
    }
  }
  const rest = levels.filter((l) => !used.has(l.id));
  let k = 0;
  for (const s of stops) {
    if ((s.kind !== 'mission' && s.kind !== 'final') || out.has(s.id) || s.levelId) continue;
    const l = rest[k++];
    if (!l) break;
    out.set(s.id, l);
  }
  return out;
}

/** Missions (and the final) numbered along the main path: "01"…"24". */
function numbering(main: readonly PlacedStop[]): Map<string, number> {
  const out = new Map<string, number>();
  let n = 0;
  for (const m of main) if (m.def.kind === 'mission' || m.def.kind === 'final') out.set(m.def.id, ++n);
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

export interface StateInput {
  readonly layout: AdventureLayout;
  readonly levels: readonly LevelDefinition[];
  readonly progress: ProgressData;
  readonly statusOf: (levelId: string) => LevelStatus;
  /** The level "Continue" would open (preferred as the current stop when it's in this world). */
  readonly continueLevelId: string | null;
}

export function adventureView({ layout, levels, progress, statusOf, continueLevelId }: StateInput): AdventureView {
  const defs = [...layout.main.map((m) => m.def), ...layout.challenges.map((c) => c.def)];
  const bound = bindLevels(defs, levels);
  const numbers = numbering(layout.main);
  const levelStatus = (stopId: string): LevelStatus | 'planned' => {
    const l = bound.get(stopId);
    return l ? statusOf(l.id) : 'planned';
  };

  // Current = the continue level if it's here and open, else the first open main mission.
  const open = (s: LevelStatus | 'planned') => s === 'available' || s === 'in_progress';
  const continueStop = continueLevelId ? [...bound].find(([id, l]) => l.id === continueLevelId && open(levelStatus(id)))?.[0] : undefined;
  const currentId = continueStop ?? layout.main.find((m) => open(levelStatus(m.def.id)))?.def.id ?? null;

  // Main path: missions done so far decide checkpoints / gates.
  const mainStatus = new Map<string, StopStatus>();
  const reasons = new Map<string, string | null>();
  let pendingSinceMarker: string[] = [];
  let allBeforeDone = true;
  for (const m of layout.main) {
    const { def } = m;
    if (def.kind === 'checkpoint' || def.kind === 'gate') {
      mainStatus.set(def.id, allBeforeDone ? 'completed' : 'locked');
      const first = pendingSinceMarker[0];
      const last = pendingSinceMarker.at(-1);
      reasons.set(
        def.id,
        allBeforeDone
          ? null
          : pendingSinceMarker.length === 0
            ? 'Complete the earlier missions to reach it.'
            : `Complete mission${first === last ? ` ${first}` : `s ${first}–${last}`} to ${def.kind === 'gate' ? 'open this gate' : 'reach this checkpoint'}.`,
      );
      pendingSinceMarker = [];
      continue;
    }
    const s = levelStatus(def.id);
    const status: StopStatus = s === 'completed' ? 'completed' : def.id === currentId ? 'current' : open(s) ? 'available' : 'locked';
    mainStatus.set(def.id, status);
    const level = bound.get(def.id);
    reasons.set(def.id, status !== 'locked' ? null : level ? (lockMessage(level.id, progress) ?? 'Complete the missions before this one to unlock it.') : PLANNED_REASON);
    if (s !== 'completed') {
      allBeforeDone = false;
      pendingSinceMarker.push(pad(numbers.get(def.id) ?? 0));
    }
  }

  const view = (p: PlacedStop, status: StopStatus, lockReason: string | null): StopView => {
    const { def } = p;
    const level = bound.get(def.id) ?? null;
    const number = numbers.get(def.id) ?? null;
    const branchNo = def.branchOf ? numbers.get(def.branchOf) : undefined;
    const label =
      def.kind === 'challenge'
        ? `${pad(branchNo ?? 0)}-A`
        : def.kind === 'checkpoint'
          ? `CHECKPOINT ${def.id.replace(/\D/g, '')}`
          : def.kind === 'gate'
            ? `GATE ${def.id.replace(/\D/g, '')}`
            : pad(number ?? 0);
    return {
      id: def.id,
      kind: def.kind,
      label,
      number,
      title: level?.title ?? def.title,
      description: level?.description ?? def.description,
      skills: def.skills,
      difficulty: level?.difficulty ?? def.difficulty,
      reward: { xp: level?.rewards.xp ?? def.reward.xp, stars: def.reward.stars },
      status,
      levelId: level?.id ?? null,
      planned: !level && def.kind !== 'checkpoint' && def.kind !== 'gate',
      bestStars: level ? (progress.levels[level.id]?.bestStars ?? 0) : 0,
      lockReason,
      optional: def.kind === 'challenge',
      pos: p.pos,
    };
  };

  const mainViews = layout.main.map((m) => view(m, mainStatus.get(m.def.id) ?? 'locked', reasons.get(m.def.id) ?? null));
  const challengeViews = layout.challenges.map((c) => {
    const s = levelStatus(c.def.id);
    const level = bound.get(c.def.id);
    const status: StopStatus = s === 'completed' ? 'completed' : open(s) ? 'available' : 'locked';
    return view(c, status, status !== 'locked' ? null : level ? lockMessage(level.id, progress) : PLANNED_REASON);
  });

  const segState = (v: StopView): SegmentState => (v.status === 'completed' ? 'done' : v.status === 'current' || v.status === 'available' ? 'open' : 'locked');
  const segments = mainViews.map((v, i) => ({ from: i === 0 ? 0 : layout.routeIndex[i - 1]!, to: layout.routeIndex[i]!, state: segState(v) }));
  const branches = layout.challenges.map((c, i) => {
    const from = mainViews[c.index]!;
    const to = challengeViews[i]!;
    return { from: from.pos, to: to.pos, state: from.status === 'completed' ? segState(to) : ('locked' as SegmentState) };
  });

  const missions = mainViews.filter((v) => v.kind === 'mission' || v.kind === 'final');
  const current = mainViews.find((v) => v.id === currentId) ?? null;
  const lastDone = [...mainViews].reverse().find((v) => v.status === 'completed');
  return {
    stops: [...mainViews, ...challengeViews],
    segments,
    branches,
    current,
    focus: current?.pos ?? lastDone?.pos ?? layout.start,
    missionsCompleted: missions.filter((v) => v.status === 'completed').length,
    missionsTotal: missions.length,
    playable: missions.filter((v) => !v.planned).length,
  };
}
