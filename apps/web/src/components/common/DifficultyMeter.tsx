import { Star } from 'lucide-react';
import { useMessages } from '../../features/i18n/i18n';
import { cn } from '../../utils/cn';
import { commonMessages } from './common.messages';

interface DifficultyMeterProps {
  /** 1–5 */
  value: number;
  /** `bars` = compact pills (cards), `stars` = ★★☆☆☆ (detail panels). */
  variant?: 'bars' | 'stars';
  className?: string;
}

/** Difficulty 1–5, readable without colour (count of filled marks + label). */
export function DifficultyMeter({ value, variant = 'bars', className }: DifficultyMeterProps) {
  const m = useMessages(commonMessages);
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={m.difficulty({ n: value })}>
      {[1, 2, 3, 4, 5].map((i) =>
        variant === 'stars' ? (
          <Star key={i} size={14} className={i <= value ? 'fill-cyan text-cyan' : 'fill-transparent text-white/20'} />
        ) : (
          <span key={i} className={cn('h-1.5 w-3 rounded-full', i <= value ? 'bg-cyan/80' : 'bg-white/10')} />
        ),
      )}
    </span>
  );
}
