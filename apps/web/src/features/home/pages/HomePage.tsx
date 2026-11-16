import { useMemo } from 'react';
import { useStudentSession } from '../../account/session-store';
import { useLevelStore } from '../../levels/level-store';
import { continueTarget, playerStats, summarizeWorlds } from '../../world-map/world-progress';
import { ContinueLearningCard } from '../components/ContinueLearningCard';
import { HeroSection } from '../components/HeroSection';
import { ProgressStats } from '../components/ProgressStats';
import { QuickActions } from '../components/QuickActions';
import { WorldPreviewGrid } from '../components/WorldPreviewGrid';

/**
 * `/` — the entry point: what OneRoboLab is (hero), where the student is
 * (continue + stats), what there is to learn (worlds) and how to start.
 * Numbers come from the level progress store — the student's server
 * progress and totals once signed in (Student Phase 4).
 */
export function HomePage() {
  const progress = useLevelStore((s) => s.progress);
  const name = useStudentSession((s) => s.user?.displayName ?? null);
  const summaries = useMemo(() => summarizeWorlds(progress), [progress]);
  const target = useMemo(() => continueTarget(progress), [progress]);
  const stats = useMemo(() => playerStats(progress, new Date()), [progress]);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto" aria-label="Home">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-7 px-8 pb-12 pt-7 animate-page-in max-[1100px]:px-5">
        <HeroSection name={name} />
        <div className="grid grid-cols-[1.55fr_1fr] gap-5 max-[1180px]:grid-cols-1">
          <ContinueLearningCard target={target} />
          <ProgressStats stats={stats} />
        </div>
        <WorldPreviewGrid summaries={summaries} />
        <QuickActions />
      </div>
    </main>
  );
}
