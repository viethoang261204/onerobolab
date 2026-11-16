import { cn } from '../../utils/cn';

export type StatusTone = 'success' | 'danger' | 'warning' | 'info' | 'idle';

const DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-cyan',
  idle: 'bg-faint',
};

interface StatusIndicatorProps {
  tone: StatusTone;
  label?: string;
  pulse?: boolean;
  className?: string;
}

export function StatusIndicator({ tone, label, pulse, className }: StatusIndicatorProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium text-muted', className)}>
      <span className="relative flex h-2 w-2">
        {pulse && <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', DOT[tone])} />}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', DOT[tone])} />
      </span>
      {label}
    </span>
  );
}
