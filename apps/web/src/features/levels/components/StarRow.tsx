import { Star } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useMessages } from '../../i18n/i18n';
import { levelsMessages } from '../levels.messages';

/** 0–3 stars. `animate` staggers them in (success panel). */
export function StarRow({ stars, size = 16, animate = false, className }: { stars: number; size?: number; animate?: boolean; className?: string }) {
  const m = useMessages(levelsMessages);
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={m.starsAria({ stars })}>
      {[0, 1, 2].map((i) => {
        const on = i < stars;
        return (
          <Star
            key={i}
            size={size}
            strokeWidth={2}
            className={cn(on ? 'fill-[#fbbf24] text-[#fbbf24] drop-shadow-[0_0_6px_rgb(251_191_36/0.6)]' : 'fill-transparent text-white/20', animate && on && 'animate-star')}
            style={animate ? { animationDelay: `${250 + i * 180}ms` } : undefined}
          />
        );
      })}
    </span>
  );
}
