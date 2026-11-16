import { AlertTriangle, Inbox, Loader2, RefreshCw, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { errorMessage } from '../api/client';
import type { Tone } from '../lib/labels';

/*
 * Admin console primitives: light, neutral, dense. Nothing here is shared
 * with the game UI on purpose.
 */

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-adm-accent text-white hover:bg-adm-accent-strong shadow-adm border border-adm-accent-strong/40',
  secondary: 'bg-adm-surface text-adm-ink border border-adm-line-strong hover:bg-adm-subtle shadow-adm',
  ghost: 'text-adm-body hover:bg-adm-line/60',
  danger: 'bg-adm-bad text-white hover:bg-[#912018] shadow-adm',
  'danger-ghost': 'text-adm-bad hover:bg-adm-bad-soft',
};
const SIZES: Record<Size, string> = { sm: 'h-8 px-2.5 text-[13px] gap-1.5', md: 'h-9 px-3.5 text-sm gap-2' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  busy?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, busy = false, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

/** Square icon-only button; `label` is required for screen readers. */
export function IconButton({ icon: Icon, label, variant = 'ghost', size = 'sm', className, ...rest }: Omit<ButtonProps, 'icon' | 'children'> & { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
        className,
      )}
      {...rest}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-adm-line/70 text-adm-body ring-adm-line-strong/60',
  info: 'bg-adm-accent-soft text-adm-accent-strong ring-adm-accent/20',
  success: 'bg-adm-ok-soft text-adm-ok ring-adm-ok/20',
  warning: 'bg-adm-warn-soft text-adm-warn ring-adm-warn/20',
  danger: 'bg-adm-bad-soft text-adm-bad ring-adm-bad/20',
  review: 'bg-adm-review-soft text-adm-review ring-adm-review/20',
};
const DOT: Record<Tone, string> = {
  neutral: 'bg-adm-faint',
  info: 'bg-adm-accent',
  success: 'bg-adm-ok',
  warning: 'bg-adm-warn',
  danger: 'bg-adm-bad',
  review: 'bg-adm-review',
};

export function Badge({ tone = 'neutral', dot = false, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', TONE_CLASSES[tone], className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', DOT[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export function Card({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx('rounded-xl border border-adm-line bg-adm-surface shadow-adm', className)}>
      {(title || actions) && (
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-adm-line px-4 py-2.5">
          {typeof title === 'string' ? <h2 className="text-sm font-semibold text-adm-ink">{title}</h2> : title}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-4' : undefined}>{children}</div>
    </section>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-adm-muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}…
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-adm-subtle text-adm-faint ring-1 ring-adm-line">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-adm-ink">{title}</p>
      {children && <p className="max-w-sm text-sm text-adm-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-adm-bad/25 bg-adm-bad-soft px-4 py-3 text-sm text-adm-bad">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">{errorMessage(error)}</div>
      {onRetry && (
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Inline notice (info / warning / success) inside forms and panels. */
export function Notice({ tone = 'info', title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-lg px-3.5 py-2.5 text-sm ring-1 ring-inset', TONE_CLASSES[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-0.5 opacity-90' : undefined}>{children}</div>}
    </div>
  );
}

/** "Label: value" pairs in a compact grid. */
export function DescriptionList({ items, columns = 2 }: { items: readonly (readonly [string, ReactNode])[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cx('grid gap-x-6 gap-y-3', columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium text-adm-muted">{label}</dt>
          <dd className="mt-0.5 truncate text-sm text-adm-ink">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** ★★☆ */
export function Stars({ value, max = 3 }: { value: number | null | undefined; max?: number }) {
  const v = value ?? 0;
  return (
    <span className="tabular text-sm tracking-tight whitespace-nowrap" aria-label={`${v} of ${max} stars`}>
      <span className="text-[#f5a524]">{'★'.repeat(Math.min(v, max))}</span>
      <span className="text-adm-line-strong">{'★'.repeat(Math.max(0, max - v))}</span>
    </span>
  );
}

/** Initials avatar. */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ width: size, height: size, background: `hsl(${hue} 45% 45%)` }}
    >
      {initials || '?'}
    </span>
  );
}
