import { Flame, Star, Target, Zap, type LucideIcon } from 'lucide-react';
import type { PlayerStats } from '../../world-map/world-progress';

interface Stat {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly icon: LucideIcon;
  readonly color: string;
}

/** Four lightweight progress tiles (the server's totals when signed in) — no leaderboard, no badges wall. */
export function ProgressStats({ stats }: { stats: PlayerStats }) {
  const items: Stat[] = [
    { label: 'Stars earned', value: String(stats.stars), detail: `of ${stats.maxStars}`, icon: Star, color: '#fbbf24' },
    { label: 'Missions', value: String(stats.missionsCompleted), detail: `of ${stats.missionsTotal} done`, icon: Target, color: '#22d3ee' },
    { label: 'XP', value: String(stats.xp), detail: `player level ${stats.level}`, icon: Zap, color: '#a78bfa' },
    { label: 'Streak', value: String(stats.streak), detail: stats.streak === 1 ? 'day' : 'days', icon: Flame, color: '#fb923c' },
  ];
  return (
    <section aria-label="Your progress" className="grid grid-cols-2 gap-3">
      {items.map(({ label, value, detail, icon: Icon, color }) => (
        <div key={label} className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-panel/90 px-4 py-3.5 shadow-[var(--shadow-panel)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]" style={{ background: `${color}1f`, color }}>
            <Icon size={20} strokeWidth={2.2} className={label === 'Stars earned' ? 'fill-current' : undefined} />
          </span>
          <div className="min-w-0">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="tabular font-display text-[24px] font-black leading-none text-white">{value}</span>
              <span className="truncate text-[12px] text-[#9fb0cc]">{detail}</span>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
