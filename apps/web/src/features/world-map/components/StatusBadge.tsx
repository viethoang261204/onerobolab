import { CheckCircle2, CircleDot, Lock, PlayCircle, Hourglass, type LucideIcon } from 'lucide-react';
import type { LevelStatus } from '../../levels/progress';
import { cn } from '../../../utils/cn';
import { LEVEL_STATUS_LABEL, WORLD_STATUS_LABEL, type WorldStatus } from '../world-progress';

type AnyStatus = WorldStatus | LevelStatus;

const LOOK: Record<AnyStatus, { icon: LucideIcon; cls: string }> = {
  completed: { icon: CheckCircle2, cls: 'bg-success/15 text-[#4ade80] border-success/30' },
  in_progress: { icon: CircleDot, cls: 'bg-cyan/12 text-cyan border-cyan/30' },
  available: { icon: PlayCircle, cls: 'bg-primary/15 text-[#93c5fd] border-primary/35' },
  locked: { icon: Lock, cls: 'bg-white/5 text-[#8b98b3] border-white/10' },
  coming_soon: { icon: Hourglass, cls: 'bg-purple/12 text-[#c4b5fd] border-purple/30' },
};

/** Status pill: icon + words (never colour alone). */
export function StatusBadge({ status, kind = 'world', className }: { status: AnyStatus; kind?: 'world' | 'level'; className?: string }) {
  const { icon: Icon, cls } = LOOK[status];
  const label = kind === 'level' && status !== 'coming_soon' ? LEVEL_STATUS_LABEL[status] : WORLD_STATUS_LABEL[status as WorldStatus];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold', cls, className)}>
      <Icon size={13} strokeWidth={2.4} />
      {label}
    </span>
  );
}
