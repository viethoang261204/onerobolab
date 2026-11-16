import { ArrowRight, Lock, Star, X, Zap } from 'lucide-react';
import { DifficultyMeter } from '../../../components/common/DifficultyMeter';
import { LevelRegistry } from '../../../content/levels/registry';
import { EnvironmentThumbnail } from '../../level-selection/components/EnvironmentThumbnail';
import { isWorldOpen, type WorldSummary } from '../world-progress';
import { StatusBadge } from './StatusBadge';
import { WorldGlyph } from './WorldGlyph';
import { buttonClass } from '../../../components/common/Button';

interface WorldDetailPanelProps {
  summary: WorldSummary;
  onEnter: () => void;
  onClose: () => void;
}

const label = 'text-[10.5px] font-black uppercase tracking-[0.16em] text-[#8fa0bd]';

/**
 * Selected-world HUD (right): a real preview of the world, progress,
 * difficulty, rewards, skills, the next mission and Enter World. Dense
 * but calm — one card, dividers instead of boxes.
 */
export function WorldDetailPanel({ summary, onEnter, onClose }: WorldDetailPanelProps) {
  const { world, status } = summary;
  const open = isWorldOpen(status);
  const previewLevel = summary.nextLevel ?? summary.levels[0];

  return (
    <aside
      key={world.id}
      aria-label={`${world.name} details`}
      className="pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#0a1428]/80 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.9)] backdrop-blur-md animate-slide-in"
      style={{ ['--world' as string]: world.color }}
    >
      <div className="flex-1 overflow-y-auto">
        <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-black uppercase tracking-[0.2em]" style={{ color: world.color }}>
                World {world.order}
              </span>
              <StatusBadge status={status} className="py-0.5" />
            </div>
            <h2 className="mt-1 font-display text-[24px] font-black leading-none text-white">{world.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close world details" className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-muted hover:bg-white/10 hover:text-white">
            <X size={17} />
          </button>
        </header>

        <div className="relative mx-4 overflow-hidden rounded-[12px] border border-white/10">
          {previewLevel ? (
            <EnvironmentThumbnail level={previewLevel} locked={!open} className="h-[132px] w-full" />
          ) : (
            <div className="flex h-[132px] items-center justify-center bg-[radial-gradient(ellipse_at_50%_80%,#1c3570_0%,#0b1733_75%)]">
              <WorldGlyph theme={world.theme} locked={!open} className="h-[104px] w-[180px]" />
            </div>
          )}
          <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a1428]/90 to-transparent px-3 pb-2 pt-6 text-[13px] font-bold text-white">{world.tagline}</span>
        </div>

        <div className="space-y-3.5 px-4 pb-4 pt-3.5">
          <p className="line-clamp-2 text-[12.5px] leading-snug text-[#b6c3da]">{world.description}</p>

          <section aria-label="Progress" className="border-t border-white/8 pt-3">
            <div className="flex items-baseline justify-between">
              <h3 className={label}>Progress</h3>
              <span className="tabular text-[12.5px] font-bold text-white">{summary.total ? `${summary.completed} / ${summary.total} missions` : 'No missions yet'}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={`${world.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(summary.fraction * 100)}>
              <div className="h-full rounded-full bg-[var(--world)] transition-[width] duration-[var(--dur-slow)]" style={{ width: `${summary.fraction * 100}%` }} />
            </div>
          </section>

          <dl className="grid grid-cols-2 gap-x-4">
            <div>
              <dt className={label}>Difficulty</dt>
              <dd className="mt-1">
                <DifficultyMeter value={world.difficulty} variant="stars" />
              </dd>
            </div>
            <div>
              <dt className={label}>Rewards</dt>
              <dd className="mt-1 flex items-center gap-3 text-[12.5px] font-bold text-white">
                <span className="flex items-center gap-1">
                  <Zap size={13} className="text-cyan" /> +{summary.xpTotal} XP
                </span>
                <span className="flex items-center gap-1">
                  <Star size={13} className="fill-[#fbbf24] text-[#fbbf24]" /> {summary.maxStars}
                </span>
              </dd>
            </div>
          </dl>

          <section aria-label="Skills">
            <h3 className={label}>Skills</h3>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {world.skills.map((s) => (
                <li key={s} className="rounded-[7px] bg-white/[0.06] px-2 py-1 text-[11.5px] font-semibold text-[#dbe4f3]">
                  {s}
                </li>
              ))}
            </ul>
          </section>

          {summary.nextLevel && open && (
            <section aria-label="Next mission" className="border-t border-white/8 pt-3">
              <h3 className={label}>Next mission</h3>
              <p className="mt-1 text-[13.5px] font-bold text-white">
                <span className="tabular text-[var(--world)]">{LevelRegistry.code(summary.nextLevel)}</span> · {summary.nextLevel.title}
              </p>
            </section>
          )}
        </div>
      </div>

      <div className="border-t border-white/8 p-3.5">
        {open ? (
          <button
            type="button"
            onClick={onEnter}
            className={buttonClass('primary', 'group min-h-11 w-full')}
          >
            Enter World <ArrowRight size={17} className="transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5" />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 rounded-[11px] bg-white/[0.04] px-3 py-2.5 text-[12.5px] text-[#b6c3da]" role="note">
            <Lock size={15} className="shrink-0 text-[#8b98b3]" />
            {summary.lockedReason}
          </div>
        )}
      </div>
    </aside>
  );
}
