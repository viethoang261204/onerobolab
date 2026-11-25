import { ArrowLeft, Check, ChevronDown, Circle, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LevelDefinition } from '../../content/levels/types';
import { LevelRegistry } from '../../content/levels/registry';
import { WorldRegistry } from '../../content/worlds/registry';
import { buildMissionView } from '../../data/mission';
import { navigate } from '../../features/router/router-store';
import { paths } from '../../features/router/routes';
import { StarRow } from '../../features/levels/components/StarRow';
import { useLevelStore } from '../../features/levels/level-store';
import { useSettingsStore } from '../../features/settings/settings-store';
import { environmentInfo } from '../../features/simulator/environments/catalog';
import { useRuntimeStore } from '../../features/simulator/runtime/runtime-store';
import { cn } from '../../utils/cn';
import { HintButton } from '../../features/levels/components/HintButton';
import { hintTier } from '../../features/levels/hint-tiers';
import { useMessages } from '../../features/i18n/i18n';
import { simulatorMessages } from './simulator.messages';

/**
 * Compact mission HUD (top-left): Edit Program, mission title and place,
 * live objectives with progress, and hints on demand.
 */
export function SimMissionHud({ level }: { level: LevelDefinition }) {
  const m = useMessages(simulatorMessages);
  const state = useRuntimeStore((s) => s.mission);
  const best = useLevelStore((s) => s.progress.levels[s.levelId]);
  const hintsShown = useLevelStore((s) => s.hintsShown);
  const showHints = useSettingsStore((s) => s.showHints);
  // Open on desktop; collapsed on phones / tablets so the robot stays visible.
  const [open, setOpen] = useState(() => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(min-width: 1024px)').matches);
  const live = state?.missionId === level.mission.id ? state : null;
  const view = useMemo(() => buildMissionView(level.mission, level.map, live), [level, live]);
  const done = view.objectives.filter((o) => o.state === 'done').length;
  const world = WorldRegistry.get(level.world);
  const env = environmentInfo(level.environmentId);

  return (
    <div className="flex w-[min(300px,calc(100vw-6rem))] flex-col gap-2 lg:w-[300px]">
      <button
        type="button"
        data-tour="edit"
        onClick={() => navigate(paths.world(level.world))}
        aria-label={m.worldMap}
        className="glass flex h-11 w-fit items-center gap-2 rounded-[var(--radius-control)] px-3.5 font-display text-[14.5px] font-extrabold text-white transition-[filter] hover:brightness-125 sm:px-4"
      >
        <ArrowLeft size={17} /> <span className="max-sm:hidden">{m.worldMap}</span>
      </button>
      <section data-tour="mission" aria-label={m.missionAria} className="glass overflow-hidden rounded-[var(--radius-panel)]">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? m.collapseMission : m.expandMission} className="flex min-h-11 w-full items-start gap-2 px-3.5 pb-2 pt-3 text-left">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: world?.color }}>
              {m.missionHeader({ code: LevelRegistry.code(level), env: env.name })}
              {best?.completed && <StarRow stars={best.bestStars} size={11} />}
            </div>
            <h2 className="truncate font-display text-[18px] font-black leading-tight text-white">{level.title}</h2>
          </div>
          <span className="tabular mt-1 rounded-full bg-white/8 px-2 py-0.5 text-[11.5px] font-bold text-white">
            {done}/{view.objectives.length}
          </span>
          <ChevronDown size={16} className={cn('mt-1 text-muted transition-transform', !open && '-rotate-90')} />
        </button>
        <div className="mx-3.5 h-1 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan to-success transition-[width] duration-[var(--dur-slow)]" style={{ width: `${(done / Math.max(1, view.objectives.length)) * 100}%` }} />
        </div>
        {open && (
          <ul className="space-y-1.5 px-3.5 pb-3 pt-2.5">
            {view.objectives.map((o) => (
              <li key={`${o.id}:${o.state}`} className={cn('flex items-center gap-2 text-[13px]', o.state === 'done' ? 'text-[#dcfce7]' : o.state === 'failed' ? 'text-[#fecaca]' : 'text-[#e2e8f0]')}>
                {o.state === 'done' ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-white animate-objective-done">
                    <Check size={11} strokeWidth={3.2} />
                  </span>
                ) : o.state === 'failed' ? (
                  <X size={15} className="text-danger" />
                ) : (
                  <Circle size={15} className={o.state === 'active' ? 'text-cyan' : 'text-white/30'} />
                )}
                <span className="min-w-0 flex-1">{o.label}</span>
                {o.progress && <span className="tabular rounded-full bg-white/10 px-1.5 text-[11.5px] font-bold text-white">{o.progress}</span>}
                {o.bonus && <span className="rounded-full bg-[#fbbf24]/15 px-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[#fbbf24]">{m.bonus}</span>}
              </li>
            ))}
            {view.outcome === 'success' && <li className="pt-1 text-[12.5px] font-semibold text-success">{m.missionDone}</li>}
          </ul>
        )}
        {open && level.data && Object.keys(level.data).length > 0 && (
          <div className="border-t border-white/8 px-3.5 py-2.5" aria-label={m.missionData}>
            <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#fbbf24]">{m.missionData}</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(level.data).map(([k, v]) => (
                <code key={k} className="rounded-md bg-black/25 px-1.5 py-0.5 font-mono text-[12px] text-[#fde68a]">
                  mission.{k} = {v}
                </code>
              ))}
            </div>
          </div>
        )}
        {open && showHints && (
          <div className="border-t border-white/8 px-3.5 py-2.5">
            {level.hints.slice(0, hintsShown).map((h, i) => (
              <p key={h} className="mb-1.5 text-[12px] text-[#fde68a]">
                <span className="font-bold">{hintTier(level, i)}</span> <span className={h.includes('\n') ? 'block whitespace-pre-wrap font-mono text-[11px]' : ''}>{h}</span>
              </p>
            ))}
            <HintButton level={level} first={m.needHelp} next={m.anotherHint} className="hover:underline" />
          </div>
        )}
      </section>
    </div>
  );
}
