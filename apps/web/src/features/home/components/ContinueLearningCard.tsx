import { ArrowRight, Play } from 'lucide-react';
import { LevelRegistry } from '../../../content/levels/registry';
import { startMission } from '../../level-selection/start-mission';
import { WorldArtwork } from '../../world-map/art/WorldArtwork';
import type { ContinueTarget } from '../../world-map/world-progress';
import { buttonClass } from '../../../components/common/Button';

/** "Continue Learning": the next mission to play, with world progress. */
export function ContinueLearningCard({ target }: { target: ContinueTarget }) {
  const { level, world: summary, fresh, allDone } = target;
  const { world } = summary;
  const pct = Math.round(summary.fraction * 100);
  const activity = fresh
    ? 'Your robot is charged and waiting on the start pad.'
    : allDone
      ? 'Every open mission is complete — replay one to earn all 3 stars.'
      : `Completed ${summary.completed} / ${summary.total} missions in ${world.name}`;

  return (
    <section
      aria-labelledby="continue-title"
      style={{ ['--world' as string]: world.color }}
      className="group relative flex items-center gap-6 overflow-hidden rounded-[24px] border border-white/8 bg-panel/90 p-6 shadow-[var(--shadow-panel)] transition-[transform,border-color] duration-[var(--dur-base)] hover:border-[var(--world)]/40"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ background: world.color }} />
      <WorldArtwork world={world} className="relative -my-3 h-[140px] w-[210px] shrink-0 max-[1180px]:w-[160px]" />
      <div className="relative min-w-0 flex-1">
        <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted">{fresh ? 'Start your first mission' : 'Continue learning'}</span>
        <h2 id="continue-title" className="mt-1 truncate font-display text-[26px] font-black leading-tight text-white">
          {level.title}
        </h2>
        <p className="text-[13px] font-medium" style={{ color: world.color }}>
          Mission {LevelRegistry.code(level)} · {world.name}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-label={`${world.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-[var(--world)] transition-[width] duration-700 ease-[var(--ease-out-soft)]" style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular w-10 text-right text-[13px] font-semibold text-white">{pct}%</span>
        </div>
        <p className="mt-1.5 text-[12.5px] text-[#9fb0cc]">{activity}</p>
      </div>
      <button
        type="button"
        onClick={() => startMission(level.id, 'home')}
        className={buttonClass('go', 'relative min-h-12 shrink-0 px-6 text-[16px]')}
      >
        {fresh ? <Play size={17} fill="currentColor" /> : null}
        {fresh ? 'Start' : 'Continue'}
        {!fresh && <ArrowRight size={17} />}
      </button>
    </section>
  );
}
