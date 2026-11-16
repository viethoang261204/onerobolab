import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

/**
 * Game UI buttons — five looks, no more:
 *   go       solid green: the one "start / run / next mission" action of an area
 *   primary  solid blue: the main action when it isn't "go"
 *   outline  quiet default: everything else
 *   ghost    inline / low-priority actions
 *   danger   soft red: stops or throws away something running
 * Flat fills, no gradients, no glow, no grow-on-hover; hover only changes the
 * fill. `run` / `stop` / `reset` are kept as names for the simulator controls.
 */
export type ButtonVariant = 'go' | 'primary' | 'outline' | 'ghost' | 'danger' | 'run' | 'stop' | 'reset';

const LOOK: Record<ButtonVariant, string> = {
  go: 'bg-[#16a34a] text-white hover:bg-[#15913f]',
  primary: 'bg-primary-strong text-white hover:bg-[#1f57d6]',
  outline: 'border border-white/12 bg-white/[0.04] text-text hover:bg-white/[0.09]',
  ghost: 'text-muted hover:bg-white/[0.06] hover:text-text',
  danger: 'bg-danger/15 text-[#fca5a5] hover:bg-danger/25',
  run: '',
  stop: '',
  reset: '',
};
LOOK.run = LOOK.go;
LOOK.stop = LOOK.danger;
LOOK.reset = LOOK.outline;

/**
 * Class string for a game button (use it on `<button>` / `<a>` that can't be a
 * `<Button>`). Size: 40 px tall; pass `min-h-*` / padding in `className` to change it.
 */
export const buttonClass = (variant: ButtonVariant = 'outline', className?: string) =>
  cn(
    'inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 font-display text-center text-[15px] font-bold leading-tight transition-colors duration-[var(--dur-fast)] disabled:pointer-events-none disabled:opacity-45',
    LOOK[variant],
    className,
  );

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: LucideIcon | undefined;
  /** Filled icon (e.g. play / stop squares). */
  iconFilled?: boolean;
}

/** Game UI button (see `buttonClass` for the looks). */
export function Button({ variant = 'outline', icon: Icon, iconFilled, children, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, className)} {...rest}>
      {Icon && <Icon size={17} strokeWidth={2.4} className="shrink-0" fill={iconFilled ? 'currentColor' : 'none'} aria-hidden="true" />}
      {children}
    </button>
  );
}
