import { Check, Lock, Hourglass } from 'lucide-react';
import { memo } from 'react';
import { cn } from '../../../utils/cn';
import { LABEL_Y } from '../scene/label-layout';
import { registerAnchor } from '../scene/screen-anchors';
import type { IslandView } from '../world-map.types';
import { WORLD_STATUS_LABEL } from '../world-progress';

/** Absolutely positioned at (0,0); the canvas `AnchorProjector` moves it over its 3D point. */
const anchored = 'pointer-events-auto absolute left-0 top-0 invisible will-change-transform';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * World marker. Quiet by default (number + name on dark glass); the selected
 * world gets the larger treatment with its mission count and progress.
 */
const IslandTag = memo(function IslandTag({ island, onSelect, onHover }: { island: IslandView; onSelect: (id: string) => void; onHover: (id: string | null) => void }) {
  const { summary, selected, hovered, placement } = island;
  const { world, status } = summary;
  const open = status !== 'locked' && status !== 'coming_soon';
  const done = status === 'completed';
  const label = `World ${world.order}: ${world.name}. ${summary.lockedReason ?? `${summary.completed} of ${summary.total} missions complete`}`;

  return (
    <button
      ref={(el) => registerAnchor(`world:${world.id}`, el, { x: placement.x, y: placement.y + LABEL_Y * placement.scale, z: placement.z, bobWith: world.order })}
      type="button"
      onClick={() => onSelect(world.id)}
      onPointerEnter={() => onHover(world.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(world.id)}
      onBlur={() => onHover(null)}
      aria-pressed={selected}
      aria-label={label}
      style={{ ['--world' as string]: world.color }}
      className={cn(anchored, 'select-none whitespace-nowrap text-left transition-opacity duration-[var(--dur-base)]', !open && !selected && 'opacity-70')}
    >
      {selected ? (
        <span className="flex flex-col gap-1 rounded-[12px] border border-[var(--world)]/55 bg-[#0a1428]/88 px-3 py-2 shadow-[0_12px_28px_-14px_rgb(0_0_0/0.9)] backdrop-blur-md">
          <span className="flex items-center gap-2">
            <span className={cn('font-display text-[13px] font-black tabular', open ? 'text-[var(--world)]' : 'text-[#8b98b3]')}>{pad(world.order)}</span>
            <span className="font-display text-[16px] font-black leading-none text-white">{world.name}</span>
            {done && <Check size={14} strokeWidth={3} className="text-success" />}
          </span>
          {open ? (
            <span className="flex items-center gap-2 text-[11.5px] font-semibold text-[#b6c3da]">
              <span className="tabular">
                {summary.completed} / {summary.total} missions
              </span>
              <span className="h-1 w-14 overflow-hidden rounded-full bg-white/12">
                <span className="block h-full rounded-full bg-[var(--world)]" style={{ width: `${Math.max(summary.fraction * 100, 4)}%` }} />
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11.5px] font-semibold text-[#9fb0cc]">
              {status === 'coming_soon' ? <Hourglass size={11} /> : <Lock size={11} />} {WORLD_STATUS_LABEL[status]}
            </span>
          )}
        </span>
      ) : (
        <span className={cn('flex items-center gap-1.5 rounded-[9px] border bg-[#0a1428]/55 px-2 py-1 backdrop-blur-sm', hovered ? 'border-white/25' : 'border-white/8')}>
          <span className={cn('font-display text-[11.5px] font-black tabular', open ? 'text-[var(--world)]' : 'text-[#7c8aa5]')}>{pad(world.order)}</span>
          <span className={cn('text-[12.5px] font-semibold leading-none', open ? 'text-white/90' : 'text-[#aab5ca]')}>{world.name}</span>
          {done ? <Check size={12} strokeWidth={3} className="text-success" /> : !open && <Lock size={10} className="text-[#7c8aa5]" />}
        </span>
      )}
    </button>
  );
});

interface MapLabelsProps {
  islands: readonly IslandView[];
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

/**
 * HTML layer over the map: world markers. Real buttons in the page's tab
 * order (keyboard: Tab to a world, Enter to select).
 */
export function MapLabels({ islands, onSelect, onHover }: MapLabelsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-label="World labels">
      {islands.map((island) => (
        <IslandTag key={island.summary.world.id} island={island} onSelect={onSelect} onHover={onHover} />
      ))}
    </div>
  );
}
