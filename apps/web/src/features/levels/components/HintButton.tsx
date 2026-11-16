import { ChevronRight, Lightbulb, Loader2 } from 'lucide-react';
import type { LevelDefinition } from '../../../content/levels/types';
import { cn } from '../../../utils/cn';
import { useLevelStore } from '../level-store';

/**
 * "Need a hint?" — reveals the next hint. A paid hint says what it costs;
 * unlocking it charges the XP on the server (once) and brings its text.
 */
export function HintButton({ level, first, next, className }: { level: LevelDefinition; first: string; next: string; className?: string }) {
  const hintsShown = useLevelStore((s) => s.hintsShown);
  const busy = useLevelStore((s) => s.hintBusy);
  const error = useLevelStore((s) => s.hintError);
  const reveal = useLevelStore((s) => s.revealHint);
  if (hintsShown >= level.hints.length) return null;
  const info = level.server?.hints[hintsShown];
  const cost = info && !info.revealed && info.cost > 0 ? info.cost : 0;
  return (
    <div>
      <button type="button" onClick={reveal} disabled={busy} className={cn('flex items-center gap-1.5 text-[12.5px] font-semibold text-[#fbbf24] disabled:opacity-60', className)}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
        {cost ? `Unlock hint ${hintsShown + 1} · ${cost} XP` : hintsShown === 0 ? first : next}
        <ChevronRight size={14} />
      </button>
      {error && (
        <p role="status" className="mt-1 text-[12px] text-[#fca5a5]">
          {error}
        </p>
      )}
    </div>
  );
}
