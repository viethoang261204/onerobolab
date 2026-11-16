import { Check, Diamond, Lock, ShieldCheck, Hourglass, Star, X, Zap } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DifficultyMeter } from '../../../components/common/DifficultyMeter';
import { cn } from '../../../utils/cn';
import { StarRow } from '../../levels/components/StarRow';
import type { StopView } from '../adventure.types';
import { statusText } from './nodes';

interface MissionDetailPanelProps {
  stop: StopView;
  worldColor: string;
  onClose: () => void;
}

function heading(stop: StopView): string {
  if (stop.kind === 'challenge') return `Optional challenge ${stop.label}`;
  if (stop.kind === 'checkpoint' || stop.kind === 'gate') return stop.label;
  if (stop.kind === 'final') return `Final mission · ${stop.label}`;
  return `Mission ${stop.label}`;
}

/**
 * Details of a stop that can't be played right now — locked missions,
 * missions still being built, checkpoints and gates. (Open missions use the
 * full mission briefing, `LevelDetailPanel`.) Bottom sheet on small screens.
 */
export function MissionDetailPanel({ stop, worldColor, onClose }: MissionDetailPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), [stop.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const marker = stop.kind === 'checkpoint' || stop.kind === 'gate';
  const locked = stop.status === 'locked';

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#040a18]/50 p-6 backdrop-blur-[2px] animate-fade-in max-[640px]:items-end max-[640px]:p-0" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-title"
        onClick={(e) => e.stopPropagation()}
        className="glass w-[min(440px,100%)] overflow-hidden rounded-[var(--radius-dialog)] animate-pop-in max-[640px]:rounded-b-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-6 pb-4 pt-5">
          <div>
            <span className="text-[11.5px] font-black uppercase tracking-[0.18em]" style={{ color: stop.kind === 'challenge' ? '#fbbf24' : worldColor }}>
              {heading(stop)}
            </span>
            <h2 id="stop-title" className="font-display text-[26px] font-black leading-tight text-white">
              {stop.title}
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div
            className={cn(
              'flex items-start gap-2.5 rounded-[var(--radius-control)] border px-3.5 py-3 text-[13.5px]',
              stop.status === 'completed' ? 'border-success/40 bg-success/10 text-[#bbf7d0]' : locked ? 'border-white/10 bg-white/[0.04] text-[#cbd5e1]' : 'border-cyan/30 bg-cyan/10 text-[#cffafe]',
            )}
          >
            {stop.status === 'completed' ? (
              marker ? <ShieldCheck size={17} className="mt-px shrink-0" /> : <Check size={17} strokeWidth={3} className="mt-px shrink-0" />
            ) : stop.planned ? (
              <Hourglass size={17} className="mt-px shrink-0 text-[#fbbf24]" />
            ) : marker && !locked ? (
              <Diamond size={16} className="mt-px shrink-0" />
            ) : (
              <Lock size={16} className="mt-px shrink-0 text-muted" />
            )}
            <div>
              <p className="font-bold">{statusText(stop)}</p>
              {stop.lockReason && <p className="mt-0.5 text-[13px] opacity-90">{stop.lockReason}</p>}
            </div>
          </div>

          {stop.description && <p className="text-[14px] leading-relaxed text-[#cbd5e1]">{stop.description}</p>}

          {!marker && (
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">Difficulty</dt>
                <dd className="mt-1">
                  <DifficultyMeter value={stop.difficulty} variant="stars" />
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">Reward</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  {stop.reward.xp > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-cyan/10 px-2.5 py-0.5 font-bold text-cyan">
                      <Zap size={12} /> +{stop.reward.xp} XP
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-bold text-[#fde68a]">
                    <Star size={12} className="fill-[#fbbf24] text-[#fbbf24]" /> +{stop.reward.stars}
                  </span>
                </dd>
              </div>
              {stop.skills.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">Skills</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {stop.skills.map((s) => (
                      <span key={s} className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[12px] font-semibold text-[#e2e8f0]">
                        {s}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {stop.bestStars > 0 && (
                <div className="col-span-2 flex items-center gap-2">
                  <dt className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">Best</dt>
                  <dd>
                    <StarRow stars={stop.bestStars} size={15} />
                  </dd>
                </div>
              )}
            </dl>
          )}
          {stop.optional && <p className="text-[12.5px] text-muted">Optional — it doesn’t block the main path, but it’s worth bonus rewards.</p>}
        </div>
      </div>
    </div>
  );
}
