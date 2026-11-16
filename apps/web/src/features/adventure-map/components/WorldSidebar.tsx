import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Diamond, Lock, PartyPopper, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import type { WorldDefinition } from '../../../content/worlds/types';
import { cn } from '../../../utils/cn';
import type { AdventureView, StopView } from '../adventure.types';
import { buttonClass } from '../../../components/common/Button';

interface WorldSidebarProps {
  world: WorldDefinition;
  intro: string;
  view: AdventureView;
  stars: number;
  maxStars: number;
  collapsed: boolean;
  onToggle: () => void;
  onContinue: (stop: StopView) => void;
  onBack: () => void;
}

/** HUD panel look: light glass so the world stays the hero. */
const HUD = 'pointer-events-auto rounded-[18px] border border-white/10 bg-[#0a1428]/62 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.9)] backdrop-blur-md';

export const HUD_WIDTH = { open: 272, collapsed: 60 } as const;

function LegendItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-[11.5px] text-[#b6c3da]">
      {icon}
      {children}
    </li>
  );
}

function Legend() {
  const dot = 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2';
  return (
    <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5" aria-label="Map legend">
      <LegendItem icon={<span className={cn(dot, 'border-[#4ade80] bg-[#0f2a1f] text-[#86efac]')}><Check size={10} strokeWidth={3.4} /></span>}>Completed</LegendItem>
      <LegendItem icon={<span className={cn(dot, 'border-[#67e8f9] bg-[#0b3550] shadow-[0_0_8px_rgb(34_211_238/0.8)]')} />}>Current</LegendItem>
      <LegendItem icon={<span className={cn(dot, 'border-[#475569] bg-[#131d33] text-[#94a3b8]')}><Lock size={9} strokeWidth={3} /></span>}>Locked</LegendItem>
      <LegendItem icon={<span className={cn(dot, 'border-[#fde68a] bg-[#d97706] text-white')}><Star size={9} className="fill-white" /></span>}>Challenge</LegendItem>
      <LegendItem icon={<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-[#f59e0b]/80 bg-[#2a1d06] text-[#fde68a]"><Diamond size={9} /></span>}>Checkpoint</LegendItem>
      <LegendItem icon={<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border border-white/20 bg-[#0b1630] text-white"><Lock size={9} /></span>}>Gate</LegendItem>
    </ul>
  );
}

/**
 * The world HUD (left): breadcrumb, world, progress, the current mission
 * (Continue) and a compact legend. Collapses to a slim rail.
 */
export function WorldSidebar({ world, intro, view, stars, maxStars, collapsed, onToggle, onContinue, onBack }: WorldSidebarProps) {
  const pct = view.missionsTotal ? Math.round((view.missionsCompleted / view.missionsTotal) * 100) : 0;
  const current = view.current;

  if (collapsed) {
    return (
      <aside aria-label={`${world.name} overview`} className={cn(HUD, 'flex flex-col items-center gap-3 py-3')} style={{ width: HUD_WIDTH.collapsed }}>
        <button type="button" onClick={onBack} aria-label="Back to Worlds" title="Back to Worlds" className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[#cbd5e1] hover:bg-white/10 hover:text-white">
          <ArrowLeft size={16} />
        </button>
        <button type="button" onClick={onToggle} aria-label="Show world details" title="Show world details" className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[#cbd5e1] hover:bg-white/10 hover:text-white">
          <ChevronRight size={17} />
        </button>
        <span className="flex h-10 w-10 items-center justify-center rounded-[11px] font-display text-[18px] font-black text-[#07111f]" style={{ background: world.color }} title={world.name}>
          {world.order}
        </span>
        <span className="tabular text-center text-[11px] font-bold leading-tight text-white">
          {view.missionsCompleted}
          <span className="block text-muted">/ {view.missionsTotal}</span>
        </span>
        {current && (
          <button type="button" onClick={() => onContinue(current)} aria-label={`Continue mission ${current.label}: ${current.title}`} title={`Continue: ${current.title}`} className={buttonClass('primary', 'h-9 min-h-9 w-9 px-0')}>
            <ArrowRight size={17} />
          </button>
        )}
      </aside>
    );
  }

  return (
    <aside aria-label={`${world.name} overview`} className={cn(HUD, 'flex max-h-full flex-col overflow-hidden animate-slide-in')} style={{ width: HUD_WIDTH.open }}>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <nav aria-label="Breadcrumb" className="-mx-1 -mt-1 flex items-center justify-between">
          <button type="button" onClick={onBack} className="flex items-center gap-1 rounded-[8px] px-1.5 py-1 text-[12px] font-semibold text-[#9fb0cc] hover:bg-white/10 hover:text-white">
            <ArrowLeft size={13} /> Explore
            <span className="text-faint">/</span>
            <span aria-current="page" className="text-white">
              {world.name}
            </span>
          </button>
          <button type="button" onClick={onToggle} aria-label="Collapse the panel" title="Collapse the panel" className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted hover:bg-white/10 hover:text-white">
            <ChevronLeft size={16} />
          </button>
        </nav>

        <header>
          <span className="text-[10.5px] font-black uppercase tracking-[0.2em]" style={{ color: world.color }}>
            World {world.order}
          </span>
          <h1 className="font-display text-[22px] font-black leading-tight text-white">{world.name}</h1>
          <p className="mt-1 text-[12.5px] leading-snug text-[#b6c3da]">{intro || world.description}</p>
        </header>

        <section aria-labelledby="adv-progress">
          <h2 id="adv-progress" className="sr-only">
            Progress
          </h2>
          <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="World progress">
            <div className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#4ade80] transition-[width] duration-[var(--dur-slow)]" style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[12px]">
            <span className="tabular font-bold text-[#86efac]">
              {view.missionsCompleted} / {view.missionsTotal} <span className="font-semibold text-[#b6c3da]">missions</span>
            </span>
            <span className="tabular flex items-center gap-1 text-[#cbd5e1]">
              <Star size={11} className="fill-[#fbbf24] text-[#fbbf24]" /> {stars} / {maxStars}
            </span>
          </div>
          {view.playable < view.missionsTotal && <p className="mt-1 text-[11px] text-muted">{view.playable} ready to play · more coming soon</p>}
        </section>

        <section aria-labelledby="adv-current" className="border-t border-white/8 pt-3">
          <h2 id="adv-current" className="text-[12px] font-bold text-cyan">
            Current Mission
          </h2>
          {current ? (
            <>
              <div className="mt-2 flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#67e8f9] bg-[#0b3550] font-display text-[15px] font-black text-white shadow-[0_0_12px_rgb(34_211_238/0.6)]">{Number(current.label)}</span>
                <div className="min-w-0">
                  <p className="font-display text-[15.5px] font-black leading-tight text-white">{current.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[#b6c3da]">{current.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onContinue(current)}
                className={buttonClass('primary', 'mt-3 w-full text-[14px]')}
              >
                Continue Mission <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <p className="mt-2 flex items-start gap-2 text-[12.5px] text-[#cbd5e1]">
              <PartyPopper size={16} className="mt-0.5 shrink-0 text-[#fbbf24]" />
              {view.missionsCompleted > 0 ? 'You’ve finished every mission that’s ready here. New missions are on the way!' : 'No missions are open here yet.'}
            </p>
          )}
        </section>

        <section aria-label="Legend" className="border-t border-white/8 pt-3">
          <Legend />
        </section>
      </div>
    </aside>
  );
}
