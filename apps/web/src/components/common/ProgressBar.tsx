import { cn } from '../../utils/cn';

interface ProgressBarProps {
  /** 0–1 */
  value: number;
  label: string;
  className?: string;
}

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn('h-[5px] overflow-hidden rounded-full bg-white/12', className)}
    >
      <div
        className="h-full rounded-full bg-pink transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
