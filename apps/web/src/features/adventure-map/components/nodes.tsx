import { Check, Crown, Diamond, Lock, ShieldCheck, Star, Zap } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { formatNumber, messagesFor, useLocale, useMessages, type Locale } from '../../i18n/i18n';
import { adventureMapMessages } from '../adventure-map.messages';
import type { StopView } from '../adventure.types';

/*
 * HTML markers pinned to the 3D island (AnchorProjector moves each one over
 * its beacon every frame). Small and quiet: a numbered badge per mission,
 * names only on hover / selection / for the current mission.
 */

export const STATUS_TEXT: Record<StopView['status'], string> = {
  completed: 'Completed',
  current: 'Current mission',
  available: 'Open',
  locked: 'Locked',
};

export function statusText(stop: StopView, locale?: Locale): string {
  const m = messagesFor(adventureMapMessages, locale);
  if (stop.kind === 'checkpoint') return stop.status === 'completed' ? m.checkpointReached : m.checkpointAhead;
  if (stop.kind === 'gate') return stop.status === 'completed' ? m.gateOpen : m.gateClosed;
  if (stop.planned) return m.statusComingSoon;
  switch (stop.status) {
    case 'completed':
      return m.statusCompleted;
    case 'current':
      return m.statusCurrent;
    case 'available':
      return m.statusAvailable;
    case 'locked':
      return m.statusLocked;
  }
}

export interface MarkerProps {
  stop: StopView;
  selected: boolean;
  onOpen: (stop: StopView) => void;
}

/** Hover / focus card: "09 · River Crossing", status or lock reason, reward. */
function Tooltip({ stop }: { stop: StopView }) {
  const m = useMessages(adventureMapMessages);
  const locale = useLocale();
  const marker = stop.kind === 'checkpoint' || stop.kind === 'gate';
  return (
    <span
      role="presentation"
      className="adv-tip pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-max max-w-[240px] -translate-x-1/2 translate-y-1 rounded-[12px] border border-white/12 bg-[#0b1630]/92 px-3 py-2 text-left opacity-0 shadow-[0_12px_30px_-10px_rgb(0_0_0/0.9)] backdrop-blur-md transition-[opacity,translate] duration-[var(--dur-fast)]"
    >
      <span className="block text-[13.5px] font-bold leading-tight text-white">{marker ? stop.label : `${stop.label} · ${stop.title}`}</span>
      {marker && <span className="block text-[12px] text-[#cbd5e1]">{stop.title}</span>}
      <span className="mt-0.5 block text-[12px] text-[#9fb0cc]">{stop.status === 'locked' && stop.lockReason ? stop.lockReason : (stop.skills[0] ?? statusText(stop, locale))}</span>
      {stop.reward.xp > 0 && (
        <span className="mt-1 flex items-center gap-2 text-[12px] font-bold">
          <span className="flex items-center gap-0.5 text-[#fde68a]">
            <Star size={11} className="fill-[#fbbf24] text-[#fbbf24]" /> {stop.reward.stars}
          </span>
          <span className="flex items-center gap-0.5 text-cyan">
            <Zap size={11} /> {m.xpShort({ xp: formatNumber(stop.reward.xp, locale) })}
          </span>
        </span>
      )}
    </span>
  );
}

function Shell({ stop, selected, onOpen, children }: MarkerProps & { children: ReactNode }) {
  const m = useMessages(adventureMapMessages);
  const locale = useLocale();
  const who = stop.kind === 'challenge' ? m.optionalChallenge({ label: stop.label }) : stop.number ? m.missionLabel({ label: stop.label }) : stop.label;
  const label = m.stopAria({ who, title: stop.title, status: statusText(stop, locale), stars: stop.bestStars });
  return (
    <button
      type="button"
      data-stop={stop.id}
      aria-label={label}
      aria-current={stop.status === 'current' ? 'step' : undefined}
      aria-pressed={selected}
      onClick={() => onOpen(stop)}
      className="adv-node group pointer-events-auto relative flex min-h-11 min-w-11 flex-col items-center justify-center outline-none"
    >
      {children}
      <Tooltip stop={stop} />
    </button>
  );
}

const RING: Record<StopView['status'], string> = {
  completed: 'border-[#4ade80] bg-[#0f2a1f] text-white shadow-[0_0_12px_rgb(74_222_128/0.55)]',
  current: 'border-[#67e8f9] bg-[#0b3550] text-white shadow-[0_0_0_4px_rgb(34_211_238/0.25),0_0_22px_rgb(34_211_238/0.8)]',
  available: 'border-[#22d3ee] bg-[#0f2440] text-[#cffafe] shadow-[0_0_10px_rgb(34_211_238/0.45)]',
  locked: 'border-[#475569] bg-[#131d33] text-[#94a3b8]',
};

/** Mission badge — or the larger crowned badge for the final mission. */
export const LevelNode = memo(function LevelNode(props: MarkerProps) {
  const { stop, selected } = props;
  if (stop.kind === 'final') return <FinalNode {...props} />;
  const current = stop.status === 'current';
  return (
    <Shell {...props}>
      {stop.status === 'locked' && (
        <span className="absolute -top-2 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#1e293b] text-[#cbd5e1] ring-2 ring-[#0b1426]" aria-hidden="true">
          <Lock size={10} strokeWidth={3} />
        </span>
      )}
      <span
        className={cn(
          'adv-hex relative flex items-center justify-center rounded-full border-[3px] font-display font-black',
          current ? 'adv-bob h-11 w-11 text-[18px]' : 'h-[34px] w-[34px] text-[14.5px]',
          selected && 'scale-110',
          RING[stop.status],
        )}
      >
        {Number(stop.label)}
        {stop.status === 'completed' && (
          <span className="absolute -bottom-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#22c55e] text-white ring-2 ring-[#0b1426]" aria-hidden="true">
            <Check size={10} strokeWidth={3.6} />
          </span>
        )}
      </span>
      {(current || selected) && (
        <span className="mt-1.5 whitespace-nowrap rounded-full border border-cyan/40 bg-[#0b1630]/90 px-2.5 py-[3px] text-[12px] font-bold text-white shadow-[0_4px_12px_-4px_rgb(0_0_0/0.8)]">{stop.title}</span>
      )}
    </Shell>
  );
});

function FinalNode(props: MarkerProps) {
  const { stop } = props;
  const locked = stop.status === 'locked';
  return (
    <Shell {...props}>
      <Crown size={22} className={cn('-mb-1.5 drop-shadow-[0_2px_4px_rgb(0_0_0/0.7)]', locked ? 'text-[#c4b5fd]' : 'text-[#fbbf24]')} aria-hidden="true" />
      <span
        className={cn(
          'adv-hex flex h-[50px] w-[50px] items-center justify-center rounded-full border-[3px] font-display text-[19px] font-black text-white',
          props.selected && 'scale-110',
          locked ? 'border-[#8b5cf6] bg-[#1e1b4b] shadow-[0_0_16px_rgb(139_92_246/0.6)]' : 'border-[#fde68a] bg-gradient-to-b from-[#f59e0b] to-[#7c3aed] shadow-[0_0_22px_rgb(251_191_36/0.8)]',
        )}
      >
        {Number(stop.label)}
      </span>
      {(props.selected || stop.status === 'current') && <span className="mt-1.5 whitespace-nowrap rounded-full border border-[#fbbf24]/50 bg-[#1e1b4b]/95 px-2.5 py-[3px] text-[12px] font-bold text-[#fde68a]">{stop.title}</span>}
    </Shell>
  );
}

/** Optional challenge: a gold star badge with its code. */
export const ChallengeNode = memo(function ChallengeNode(props: MarkerProps) {
  const { stop } = props;
  const locked = stop.status === 'locked';
  return (
    <Shell {...props}>
      <span
        className={cn(
          'adv-hex flex h-[38px] w-[38px] items-center justify-center rounded-full border-[3px]',
          props.selected && 'scale-110',
          locked ? 'border-[#a16207] bg-[#2a2113] text-[#d6a24a]' : 'border-[#fde68a] bg-gradient-to-b from-[#fbbf24] to-[#d97706] text-white shadow-[0_0_14px_rgb(251_191_36/0.7)]',
        )}
      >
        {stop.status === 'completed' ? <Check size={18} strokeWidth={3.2} /> : <Star size={18} className={locked ? '' : 'fill-white'} />}
      </span>
      <span className="mt-1 whitespace-nowrap rounded-full bg-[#1f1a0e]/85 px-2 py-px text-[11px] font-black text-[#fde68a]">{stop.label}</span>
    </Shell>
  );
});

/** Gate: a sign on the gate towers ("GATE 2 · Sensor Challenges"). */
export const GateNode = memo(function GateNode(props: MarkerProps) {
  const { stop } = props;
  const open = stop.status === 'completed';
  return (
    <Shell {...props}>
      <span
        className={cn(
          'adv-hex flex flex-col items-center rounded-[10px] border px-3 py-1 leading-tight shadow-[0_8px_20px_-8px_rgb(0_0_0/0.9)] backdrop-blur-md',
          props.selected && 'scale-105',
          open ? 'border-cyan/50 bg-[#082f3a]/85' : 'border-white/15 bg-[#0b1630]/85',
        )}
      >
        <span className={cn('flex items-center gap-1 whitespace-nowrap font-display text-[13px] font-black tracking-wide', open ? 'text-[#a5f3fc]' : 'text-white')}>
          {open ? <ShieldCheck size={12} /> : <Lock size={11} />} {stop.label}
        </span>
        <span className="whitespace-nowrap text-[11px] font-semibold text-[#9fb0cc]">{stop.title}</span>
      </span>
    </Shell>
  );
});

/** Checkpoint: a small chip above the robot station. */
export const CheckpointNode = memo(function CheckpointNode(props: MarkerProps) {
  const { stop } = props;
  const passed = stop.status === 'completed';
  return (
    <Shell {...props}>
      <span
        className={cn(
          'adv-hex flex h-7 w-7 items-center justify-center rounded-[9px] border-2',
          props.selected && 'scale-110',
          passed ? 'border-[#4ade80] bg-[#0f2a1f] text-[#86efac]' : 'border-[#f59e0b]/80 bg-[#2a1d06]/90 text-[#fde68a]',
        )}
      >
        {passed ? <ShieldCheck size={14} /> : <Diamond size={13} />}
      </span>
    </Shell>
  );
});
