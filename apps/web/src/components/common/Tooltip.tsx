import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

const POS: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

interface TooltipProps {
  /** Short text ("Run your robot program"). */
  label: string;
  /** Keyboard shortcut shown as a key cap. */
  shortcut?: string;
  side?: TooltipSide;
  children: ReactNode;
  className?: string;
}

/**
 * Small hover/focus tooltip (CSS only, no timers or state). Wrap any
 * control; the child keeps its own accessible name.
 */
export function Tooltip({ label, shortcut, side = 'bottom', children, className }: TooltipProps) {
  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-[80] flex w-max max-w-[220px] items-center gap-2 rounded-[8px] border border-white/10 bg-[#0a1322]/95 px-2.5 py-1.5 text-[12px] font-medium leading-snug text-[#e2e8f0] opacity-0 shadow-[0_8px_20px_-8px_rgb(0_0_0/0.8)] backdrop-blur transition-opacity duration-[var(--dur-fast)] group-hover/tip:opacity-100 group-hover/tip:delay-300 group-focus-within/tip:opacity-100',
          POS[side],
        )}
      >
        {label}
        {shortcut && <kbd className="rounded border border-white/15 bg-white/5 px-1.5 font-mono text-[10.5px] text-muted">{shortcut}</kbd>}
      </span>
    </span>
  );
}
