import { ArrowLeft, Check, Circle, Clock, Play, RotateCcw, Star, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DifficultyMeter } from '../../../components/common/DifficultyMeter';
import { LevelRegistry } from '../../../content/levels/registry';
import type { LevelDefinition } from '../../../content/levels/types';
import type { WorldDefinition } from '../../../content/worlds/types';
import { cn } from '../../../utils/cn';
import { StarRow } from '../../levels/components/StarRow';
import type { LevelProgress, LevelStatus } from '../../levels/progress';
import { useSettingsStore } from '../../settings/settings-store';
import { StatusBadge } from '../../world-map/components/StatusBadge';
import { levelObjectives, levelTools, starGoals } from '../level-info';
import { environmentInfo } from '../../simulator/environments/catalog';
import { EnvironmentThumbnail } from './EnvironmentThumbnail';
import { LevelPreview } from './LevelPreview';
import { buttonClass } from '../../../components/common/Button';

interface LevelDetailPanelProps {
  level: LevelDefinition;
  world: WorldDefinition;
  status: LevelStatus;
  progress: LevelProgress | undefined;
  /** What the mission practises (from the world's adventure map). */
  skills?: readonly string[] | undefined;
  onStart: (levelId: string) => void;
  onBack: () => void;
}

/**
 * Mission briefing before play: objectives, tools, star goals, reward.
 * Start Mission fades out briefly, then opens this level's 3D simulator (Edit Program leads to Code Studio).
 */
export function LevelDetailPanel({ level, world, status, progress, skills, onStart, onBack }: LevelDetailPanelProps) {
  const [launching, setLaunching] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const done = status === 'completed';
  const objectives = levelObjectives(level);
  const tools = levelTools(level);
  const env = environmentInfo(level.environmentId);

  useEffect(() => startRef.current?.focus(), [level.id]);

  const start = () => {
    if (launching) return;
    setLaunching(true);
    setTimeout(() => onStart(level.id), useSettingsStore.getState().reduceMotion ? 0 : 260);
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#040a18]/55 p-6 backdrop-blur-[3px] animate-fade-in" onClick={onBack}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-title"
        onClick={(e) => e.stopPropagation()}
        style={{ ['--world' as string]: world.color }}
        className={cn(
          'glass flex max-h-[min(640px,calc(100vh-48px))] w-[min(720px,100%)] overflow-hidden rounded-[var(--radius-dialog)] animate-pop-in transition-[opacity,transform] duration-[var(--dur-base)]',
          launching && 'scale-[0.98] opacity-0',
        )}
      >
        <div className="flex w-[260px] shrink-0 flex-col items-center gap-3 border-r border-white/8 bg-[#0a1428]/70 p-4 max-[900px]:hidden">
          <EnvironmentThumbnail level={level} className="h-[140px] w-full rounded-[var(--radius-control)]" />
          <div className="w-full">
            <div className="text-[12.5px] font-bold text-white">{env.name}</div>
            <p className="text-[11.5px] leading-snug text-muted">{env.summary}</p>
          </div>
          <LevelPreview level={level} size={120} />
          <dl className="w-full space-y-2 text-[12.5px]">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Difficulty</dt>
              <dd>
                <DifficultyMeter value={level.difficulty} />
              </dd>
            </div>
            {progress?.completed && (
              <div className="flex items-center justify-between">
                <dt className="text-muted">Best</dt>
                <dd className="flex items-center gap-2">
                  <StarRow stars={progress.bestStars} size={13} />
                  {progress.bestTime !== null && (
                    <span className="tabular flex items-center gap-1 text-[#cbd5e1]">
                      <Clock size={12} /> {progress.bestTime.toFixed(1)} s
                    </span>
                  )}
                </dd>
              </div>
            )}
            {progress && progress.attempts > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-muted">Runs</dt>
                <dd className="tabular text-[#cbd5e1]">{progress.attempts}</dd>
              </div>
            )}
          </dl>
          <ul className="mt-auto w-full space-y-1.5 border-t border-white/8 pt-3 text-[11.5px] text-muted" aria-label="Preview legend">
            <li className="flex items-center gap-2">
              <span className="h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-[#8b5cf6]" /> Robot start
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-cyan" /> Checkpoint
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] border-2 border-success bg-success/35" /> Goal
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ec4899]" /> Cone (avoid)
            </li>
          </ul>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] font-bold uppercase tracking-[0.16em]" style={{ color: world.color }}>
                Mission {LevelRegistry.code(level)} · {world.name}
              </span>
              <StatusBadge status={status} kind="level" className="py-0.5" />
            </div>
            <div>
              <h2 id="mission-title" className="font-display text-[30px] font-black leading-none text-white">
                {level.title}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-[#cbd5e1]">{level.description}</p>
            </div>

            <section aria-labelledby="obj-h">
              <h3 id="obj-h" className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
                Objectives
              </h3>
              <ul className="mt-2 space-y-1.5">
                {objectives.map((o) => (
                  <li key={o} className="flex items-center gap-2.5 text-[13.5px] text-[#e2e8f0]">
                    {done ? <Check size={16} strokeWidth={3} className="text-success" aria-label="done" /> : <Circle size={15} className="text-white/30" aria-hidden="true" />}
                    {o}
                  </li>
                ))}
              </ul>
            </section>

            {skills && skills.length > 0 && (
              <section aria-labelledby="skills-h">
                <h3 id="skills-h" className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
                  Skills
                </h3>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <li key={s} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] font-semibold text-[#e2e8f0]">
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="tools-h">
              <h3 id="tools-h" className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
                Available tools
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {tools.map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1.5 pr-2.5 text-[12px] font-semibold text-[#e2e8f0]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: c.color }}>
                      <c.icon size={12} className="text-white" strokeWidth={2.6} />
                    </span>
                    {c.label}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="rew-h" className="rounded-[var(--radius-panel)] border border-white/8 bg-white/[0.03] p-3.5">
              <h3 id="rew-h" className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
                Reward
              </h3>
              <div className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-2">
                <ul className="space-y-1">
                  {starGoals(level).map((g, i) => (
                    <li key={g} className="flex items-center gap-2 text-[12.5px] text-[#cbd5e1]">
                      <Star size={13} className={cn(i < (progress?.bestStars ?? 0) ? 'fill-[#fbbf24] text-[#fbbf24]' : 'text-white/35')} />
                      {g}
                    </li>
                  ))}
                </ul>
                <span className="ml-auto flex items-center gap-1.5 rounded-full bg-cyan/10 px-3 py-1 text-[13px] font-bold text-cyan">
                  <Zap size={14} /> +{level.rewards.xp} XP
                </span>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/8 px-6 py-4">
            <button type="button" onClick={onBack} className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] px-4 text-[14px] font-semibold text-[#cbd5e1] hover:bg-white/8 hover:text-white">
              <ArrowLeft size={16} /> Back
            </button>
            <button
              ref={startRef}
              type="button"
              onClick={start}
              className={buttonClass('go', 'min-h-12 px-7 text-[16px]')}
            >
              {done ? (
                <>
                  <RotateCcw size={17} /> Replay mission
                </>
              ) : (
                <>
                  <Play size={17} className="fill-white" /> Start Mission
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
