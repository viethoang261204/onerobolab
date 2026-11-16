import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { Tooltip, type TooltipSide } from './Tooltip';

interface ControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Accessible name. */
  label: string;
  /** Tooltip text (defaults to the label). */
  hint?: string;
  shortcut?: string;
  tooltipSide?: TooltipSide;
  /** Show the label under the icon (vertical camera rail style). */
  showLabel?: boolean;
  active?: boolean;
  size?: 'sm' | 'md';
}

/** Square floating game-style control used over the 3D view. */
export function ControlButton({ icon: Icon, label, hint, shortcut, tooltipSide = 'bottom', showLabel, active, size = 'md', className, type = 'button', ...rest }: ControlButtonProps) {
  return (
    <Tooltip label={hint ?? label} side={tooltipSide} {...(shortcut && { shortcut })}>
      <button
        type={type}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'group flex flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border transition-colors duration-[var(--dur-fast)]',
          size === 'md' ? (showLabel ? 'h-[58px] w-[58px]' : 'h-10 w-10') : 'h-8 w-8',
          active
            ? 'border-cyan/45 bg-cyan/12 text-cyan'
            : 'border-white/10 bg-panel-2/80 text-muted hover:bg-panel-3 hover:text-text',
          className,
        )}
        {...rest}
      >
        <Icon size={size === 'md' ? 19 : 16} strokeWidth={2} />
        {showLabel && <span className="text-[11px] font-medium leading-none">{label}</span>}
      </button>
    </Tooltip>
  );
}
