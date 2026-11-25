import { useMemo } from 'react';
import { useMessages } from '../../i18n/i18n';
import { homeMessages } from '../home.messages';
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
  const m = useMessages(homeMessages);
  const progress = useLevelStore((s) => s.progress);
  const name = useStudentSession((s) => s.user?.displayName ?? null);
  const summaries = useMemo(() => summarizeWorlds(progress), [progress]);
  const target = useMemo(() => continueTarget(progress), [progress]);
  const stats = useMemo(() => playerStats(progress, new Date()), [progress]);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto" aria-label={m.homeLabel}>
      <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 pb-10 pt-4 animate-page-in sm:gap-7 sm:px-5 sm:pt-7 lg:px-8 lg:pb-12">
        <HeroSection name={name} />
        <div className="grid grid-cols-1 gap-4 sm:gap-5 min-[1180px]:grid-cols-[1.55fr_1fr]">
          <ContinueLearningCard target={target} />
          <ProgressStats stats={stats} />
        </div>
        <WorldPreviewGrid summaries={summaries} />
        <QuickActions />
      </div>
    </main>
  );
}
