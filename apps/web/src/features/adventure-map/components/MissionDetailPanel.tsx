import { Check, Diamond, Lock, ShieldCheck, Hourglass, Star, X, Zap } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DifficultyMeter } from '../../../components/common/DifficultyMeter';
import { cn } from '../../../utils/cn';
import { formatNumber, useLocale, useMessages } from '../../i18n/i18n';
import { StarRow } from '../../levels/components/StarRow';
import { adventureMapMessages } from '../adventure-map.messages';
import type { StopView } from '../adventure.types';
import { statusText } from './nodes';

interface MissionDetailPanelProps {
  stop: StopView;
  worldColor: string;
  onClose: () => void;
}

/**
 * Details of a stop that can't be played right now — locked missions,
 * missions still being built, checkpoints and gates. (Open missions use the
 * full mission briefing, `LevelDetailPanel`.) Bottom sheet on phone/tablet.
 */
export function MissionDetailPanel({ stop, worldColor, onClose }: MissionDetailPanelProps) {
  const m = useMessages(adventureMapMessages);
  const locale = useLocale();
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

  const heading =
    stop.kind === 'challenge'
      ? m.optionalChallenge({ label: stop.label })
      : stop.kind === 'checkpoint' || stop.kind === 'gate'
        ? stop.label
        : stop.kind === 'final'
          ? m.finalMission({ label: stop.label })
          : m.missionLabel({ label: stop.label });

  const marker = stop.kind === 'checkpoint' || stop.kind === 'gate';
  const locked = stop.status === 'locked';

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-[#040a18]/50 p-0 backdrop-blur-[2px] animate-fade-in lg:items-center lg:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-title"
        onClick={(e) => e.stopPropagation()}
        className="glass flex max-h-[82dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-[var(--radius-dialog)] rounded-b-none animate-pop-in lg:max-h-[min(600px,calc(100vh-48px))] lg:w-[min(440px,100%)] lg:rounded-[var(--radius-dialog)]"
      >
        <div className="flex justify-center pt-2 lg:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-5 pb-3.5 pt-3.5 sm:px-6 sm:pb-4 sm:pt-5">
          <div className="min-w-0">
            <span className="text-[11.5px] font-black uppercase tracking-[0.18em]" style={{ color: stop.kind === 'challenge' ? '#fbbf24' : worldColor }}>
              {heading}
            </span>
            <h2 id="stop-title" className="font-display text-[22px] font-black leading-tight text-white sm:text-[26px]">
              {stop.title}
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={m.close} className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] text-muted hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 pb-[max(20px,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
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
              <p className="font-bold">{statusText(stop, locale)}</p>
              {stop.lockReason && <p className="mt-0.5 text-[13px] opacity-90">{stop.lockReason}</p>}
            </div>
          </div>

          {stop.description && <p className="text-[14px] leading-relaxed text-[#cbd5e1]">{stop.description}</p>}

          {!marker && (
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">{m.difficulty}</dt>
                <dd className="mt-1">
                  <DifficultyMeter value={stop.difficulty} variant="stars" />
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">{m.reward}</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  {stop.reward.xp > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-cyan/10 px-2.5 py-0.5 font-bold text-cyan">
                      <Zap size={12} /> {m.xpShort({ xp: formatNumber(stop.reward.xp, locale) })}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-bold text-[#fde68a]">
                    <Star size={12} className="fill-[#fbbf24] text-[#fbbf24]" /> +{stop.reward.stars}
                  </span>
                </dd>
              </div>
              {stop.skills.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">{m.skills}</dt>
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
                  <dt className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">{m.best}</dt>
                  <dd>
                    <StarRow stars={stop.bestStars} size={15} />
                  </dd>
                </div>
              )}
            </dl>
          )}
          {stop.optional && <p className="text-[12.5px] text-muted">{m.optionalNote}</p>}
        </div>
      </div>
    </div>
  );
}
