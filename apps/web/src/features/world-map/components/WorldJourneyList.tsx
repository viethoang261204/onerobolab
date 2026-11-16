import { Check, Lock, Hourglass } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { EnvironmentThumbnail } from '../../level-selection/components/EnvironmentThumbnail';
import { WORLD_STATUS_LABEL, type WorldSummary } from '../world-progress';
import { WorldGlyph } from './WorldGlyph';

interface WorldJourneyListProps {
  summaries: readonly WorldSummary[];
  selectedId: string | null;
  /** The world the student is progressing through. */
  currentId: string;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Small picture of the world: its first mission's real environment, or the glyph for worlds without missions yet. */
function Thumb({ summary, open }: { summary: WorldSummary; open: boolean }) {
  const level = summary.levels[0];
  return level ? (
    <EnvironmentThumbnail level={level} locked={!open} className="h-10 w-10 shrink-0 rounded-[9px]" />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#0b1733]">
      <WorldGlyph theme={summary.world.theme} locked className="h-9 w-12" />
    </span>
  );
}

/**
 * Left rail: the journey as a progression tracker — a second, fully
 * accessible way to pick a world. The current world stands out (border,
 * CURRENT, progress); locked worlds stay quiet. Collapses to numbers.
 */
export function WorldJourneyList({ summaries, selectedId, currentId, collapsed, onSelect, onHover }: WorldJourneyListProps) {
  return (
    <nav aria-label="Worlds" className={cn('pointer-events-auto flex max-h-full flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#0a1428]/70 backdrop-blur-md', collapsed ? 'w-[64px]' : 'w-[264px]')}>
      {!collapsed && (
        <div className="px-4 pb-2 pt-3.5">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9fb0cc]">Your journey</h2>
        </div>
      )}
      <ol className={cn('flex-1 space-y-1 overflow-y-auto', collapsed ? 'p-2' : 'px-2 pb-2')}>
        {summaries.map((s) => {
          const { world, status } = s;
          const selected = world.id === selectedId;
          const current = world.id === currentId;
          const open = status !== 'locked' && status !== 'coming_soon';
          const statusText = status === 'coming_soon' ? 'Coming soon' : !open ? 'Locked' : `${s.completed} / ${s.total} missions`;
          return (
            <li key={world.id}>
              <button
                type="button"
                onClick={() => onSelect(world.id)}
                onPointerEnter={() => onHover(world.id)}
                onPointerLeave={() => onHover(null)}
                aria-current={selected ? 'true' : undefined}
                aria-label={`World ${world.order}: ${world.name}, ${WORLD_STATUS_LABEL[status]}${s.total ? `, ${s.completed} of ${s.total} missions` : ''}${current ? ', current world' : ''}`}
                title={collapsed ? world.name : undefined}
                style={{ ['--world' as string]: world.color }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[12px] border p-1.5 text-left transition-colors duration-[var(--dur-fast)]',
                  selected ? 'border-[var(--world)]/60 bg-white/[0.07]' : current ? 'border-white/15 bg-white/[0.04]' : 'border-transparent hover:bg-white/[0.05]',
                )}
              >
                {collapsed ? (
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-[10px] font-display text-[14px] font-black', open ? 'text-[#07111f]' : 'bg-white/6 text-[#7c8aa5]')} style={open ? { background: world.color } : undefined}>
                    {status === 'completed' ? <Check size={16} strokeWidth={3.2} /> : world.order}
                  </span>
                ) : (
                  <>
                    <Thumb summary={s} open={open} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={cn('font-display text-[11px] font-black tabular', open ? 'text-[var(--world)]' : 'text-[#64748b]')}>{pad(world.order)}</span>
                        <span className={cn('truncate text-[13.5px] font-bold', open ? 'text-white' : 'text-[#8b98b3]')}>{world.name}</span>
                        {status === 'completed' && <Check size={13} strokeWidth={3} className="shrink-0 text-success" />}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#8fa0bd]">
                        {!open && (status === 'coming_soon' ? <Hourglass size={10} /> : <Lock size={10} />)}
                        <span className="tabular">{statusText}</span>
                        {current && <span className="ml-auto rounded-[5px] bg-[var(--world)]/20 px-1.5 py-px text-[9.5px] font-black uppercase tracking-[0.12em] text-[var(--world)]">Current</span>}
                      </span>
                      {current && open && (
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full rounded-full bg-[var(--world)]" style={{ width: `${Math.max(s.fraction * 100, 3)}%` }} />
                        </span>
                      )}
                    </span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
