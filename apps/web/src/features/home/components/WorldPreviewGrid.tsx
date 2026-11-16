import { ArrowRight, Hourglass, Lock } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { navigate } from '../../router/router-store';
import { paths } from '../../router/routes';
import { WorldArtwork } from '../../world-map/art/WorldArtwork';
import { useWorldMapStore } from '../../world-map/world-map.store';
import { currentWorld, isWorldOpen, WORLD_STATUS_LABEL, type WorldSummary } from '../../world-map/world-progress';

/** Opens the world map with this world selected. */
const viewWorld = (id: string) => {
  useWorldMapStore.getState().select(id);
  navigate(paths.worldMap());
};

function WorldPreviewCard({ summary, current }: { summary: WorldSummary; current: boolean }) {
  const { world, status } = summary;
  const open = isWorldOpen(status);
  const soon = status === 'coming_soon';
  return (
    <li>
      <button
        type="button"
        onClick={() => viewWorld(world.id)}
        aria-label={`World ${world.order}: ${world.name}. ${WORLD_STATUS_LABEL[status]}${current ? ', current world' : ''}. View on the world map`}
        style={{ ['--world' as string]: world.color }}
        className={cn(
          'group relative flex h-full w-full flex-col overflow-hidden rounded-[20px] border bg-panel/90 text-left shadow-[var(--shadow-panel)] transition-[transform,border-color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out-soft)]',
          current ? '-translate-y-0.5 border-[var(--world)]/55 shadow-[0_16px_30px_-18px_var(--world)]' : 'border-white/8 hover:border-white/20',
        )}
      >
        {/* The island is the card: large, with a soft ground shadow and a quiet sky behind it. */}
        <div className="relative h-[152px] bg-[radial-gradient(ellipse_at_50%_85%,#1d3464_0%,#101d3a_55%,#0b1426_100%)]">
          <WorldArtwork
            world={world}
            locked={status === 'locked'}
            className="absolute inset-x-0 -bottom-1 top-1"
            imgClassName={cn('transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out-soft)]', soon && 'opacity-75 saturate-[0.7]')}
          />
          <span
            className={cn('absolute left-2.5 top-2.5 rounded-[7px] px-1.5 py-px font-display text-[12.5px] font-black tabular', open ? 'text-[#07111f]' : 'bg-[#0b1426]/80 text-[#94a3b8]')}
            style={open ? { background: world.color } : undefined}
          >
            {String(world.order).padStart(2, '0')}
          </span>
          {current && (
            <span className="absolute right-2.5 top-2.5 rounded-[7px] bg-[#0b1426]/85 px-1.5 py-px text-[10px] font-black uppercase tracking-[0.12em] text-[var(--world)]">Current</span>
          )}
        </div>
        <div className="flex flex-1 flex-col px-3.5 pb-3 pt-2.5">
          <div className={cn('text-[14.5px] font-bold leading-tight', open ? 'text-white' : 'text-[#aab5ca]')}>{world.name}</div>
          <div className="text-[12px] text-muted">{world.tagline}</div>
          <div className="mt-auto pt-2.5">
            {open ? (
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-[var(--world)]" style={{ width: `${summary.fraction * 100}%` }} />
                </div>
                <span className="tabular text-[11.5px] font-semibold text-[#cbd5e1]">
                  {summary.completed}/{summary.total}
                </span>
              </div>
            ) : (
              <span className="flex items-center gap-1 text-[11.5px] font-medium text-[#8b98b3]">
                {soon ? <Hourglass size={11} /> : <Lock size={11} />} {WORLD_STATUS_LABEL[status]}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

/** "Explore OneRoboLab": every world with its miniature, progress and lock state. */
export function WorldPreviewGrid({ summaries }: { summaries: readonly WorldSummary[] }) {
  const currentId = summaries.length ? currentWorld(summaries).world.id : null;
  return (
    <section aria-labelledby="worlds-title">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 id="worlds-title" className="font-display text-[24px] font-black text-white">
            Explore OneRoboLab
          </h2>
          <p className="text-[13.5px] text-muted">Six worlds, each teaching a new robotics skill.</p>
        </div>
        <button type="button" onClick={() => navigate(paths.worldMap())} className="group flex items-center gap-1.5 rounded-[var(--radius-chip)] px-2 py-1 text-[14px] font-semibold text-cyan hover:bg-cyan/10">
          View World Map <ArrowRight size={16} className="transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5" />
        </button>
      </div>
      <ul className="grid grid-cols-6 gap-3 max-[1280px]:grid-cols-3">
        {summaries.map((s) => (
          <WorldPreviewCard key={s.world.id} summary={s} current={s.world.id === currentId} />
        ))}
      </ul>
    </section>
  );
}
