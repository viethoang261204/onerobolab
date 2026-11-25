import { Gem, Target, Timer } from 'lucide-react';
import { useMemo } from 'react';
import { rankOf, scoreRun } from '@robolab/scoring-engine';
import type { LevelDefinition } from '../../content/levels/types';
import { useRuntimeStore } from '../../features/simulator/runtime/runtime-store';
import { cn } from '../../utils/cn';
import { useMessages } from '../../features/i18n/i18n';
import { RANK_STYLE, rankLabel } from './rank';
import { simulatorMessages } from './simulator.messages';

/** mm:ss.s */
const clock = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/**
 * Live mission bar (top centre, under Run / Stop / Reset): objective
 * progress, run timer and points. Points are the scoring engine's preview of
 * this run — the server's verdict (stars, XP) arrives on the result screen.
 */
export function MissionStatusBar({ level }: { level: LevelDefinition }) {
  const m = useMessages(simulatorMessages);
  const mission = useRuntimeStore((s) => s.mission);
  const time = useRuntimeStore((s) => s.time);
  const blockCount = useRuntimeStore((s) => s.blockCount);
  const live = mission?.missionId === level.mission.id ? mission : null;
  const total = level.mission.objectives.length;
  const done = live ? live.objectives.filter((o) => o.completed).length : 0;
  const score = useMemo(
    () => (live ? scoreRun({ rules: level.mission.scoring, mission: live, stats: { elapsed: live.elapsed, collisions: live.collisionCount, blockCount, distanceTravelled: 0 } }) : null),
    [live, level, blockCount],
  );
  const success = live?.status === 'success';
  const rank = score ? rankOf(score.total, score.max, success) : 'none';

  return (
    <div role="status" aria-label={m.progressAria} className="glass flex items-center gap-1 rounded-[var(--radius-control)] px-1.5 py-1 text-[13px]">
      <span className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[#e2e8f0]">
        <Target size={14} className={done === total && total > 0 ? 'text-success' : 'text-cyan'} aria-hidden="true" />
        <span className="tabular font-semibold text-white">
          {done}/{total}
        </span>
        <span className="text-muted max-sm:hidden">{m.objectivesWord}</span>
      </span>
      <span className="h-4 w-px bg-white/10" />
      <span className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1">
        <Timer size={14} className="text-muted" aria-hidden="true" />
        <span className="tabular font-semibold text-white">{clock(live?.elapsed ?? time)}</span>
      </span>
      <span className="h-4 w-px bg-white/10" />
      <span className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1">
        <Gem size={14} className="text-[#fbbf24]" aria-hidden="true" />
        <span className="tabular font-semibold text-white">{score?.total ?? 0}</span>
        <span className="text-muted max-sm:hidden">{m.ptsWord}</span>
        {rank !== 'none' && <span className={cn('ml-1 rounded-full px-2 py-px text-[11px] font-bold', RANK_STYLE[rank].chip)}>{rankLabel(rank)}</span>}
      </span>
    </div>
  );
}
