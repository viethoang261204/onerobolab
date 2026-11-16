import { Circle, PanelRightClose, PanelRightOpen, Star, Zap } from 'lucide-react';
import { useState } from 'react';
import { LevelRegistry } from '../../../content/levels/registry';
import type { LevelDefinition } from '../../../content/levels/types';
import { WorldRegistry } from '../../../content/worlds/registry';
import { EnvironmentThumbnail } from '../../level-selection/components/EnvironmentThumbnail';
import { levelObjectives, levelTools, starGoals } from '../../level-selection/level-info';
import { useLevelStore } from '../../levels/level-store';
import { useSettingsStore } from '../../settings/settings-store';
import { environmentInfo } from '../../simulator/environments/catalog';
import { HintButton } from '../../levels/components/HintButton';

/**
 * Right-hand mission brief in Code Studio: where the mission takes place,
 * what to achieve, which tools, star goals and progressive hints. Text only —
 * the 3D world lives in the simulator.
 */
export function MissionBrief({ level }: { level: LevelDefinition }) {
  const [open, setOpen] = useState(true);
  const hintsShown = useLevelStore((s) => s.hintsShown);
  const showHints = useSettingsStore((s) => s.showHints);
  const world = WorldRegistry.get(level.world);
  const env = environmentInfo(level.environmentId);

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Show mission brief" className="glass flex w-11 shrink-0 flex-col items-center gap-2 rounded-[var(--radius-panel)] py-3 text-muted hover:text-white" data-tour="brief">
        <PanelRightOpen size={18} />
        <span className="text-[11px] font-semibold [writing-mode:vertical-rl]">Mission brief</span>
      </button>
    );

  return (
    <aside data-tour="brief" aria-label="Mission brief" className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-white/6 bg-panel-2 max-[1280px]:w-[260px]">
      <div className="relative">
        <EnvironmentThumbnail level={level} className="h-[128px] w-full" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b1426] to-transparent px-3 pb-2 pt-6">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: world?.color }}>
            {env.name}
          </div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide mission brief" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-[var(--radius-chip)] bg-black/40 text-white/80 hover:text-white">
          <PanelRightClose size={16} />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Mission {LevelRegistry.code(level)} · {world?.name}
          </div>
          <h2 className="mt-0.5 font-display text-[21px] font-black leading-tight text-white">{level.title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#cbd5e1]">{level.description}</p>
        </div>
        <section>
          <h3 className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">Objectives</h3>
          <ul className="mt-1.5 space-y-1.5">
            {levelObjectives(level).map((o) => (
              <li key={o} className="flex items-center gap-2 text-[13px] text-[#e2e8f0]">
                <Circle size={13} className="shrink-0 text-cyan/70" /> {o}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">Plan</h3>
          <ol className="mt-1.5 space-y-1">
            {level.intro.map((s, i) => (
              <li key={s} className="flex gap-2 text-[12.5px] text-[#cbd5e1]">
                <span className="font-display font-black text-cyan">{i + 1}</span> {s}
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3 className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">Tools</h3>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {levelTools(level).map((c) => (
              <li key={c.id} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-0.5 pl-1 pr-2 text-[11.5px] font-semibold text-[#e2e8f0]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: c.color }}>
                  <c.icon size={10} className="text-white" strokeWidth={2.6} />
                </span>
                {c.label}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-[var(--radius-control)] border border-white/8 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">Stars</h3>
            <span className="flex items-center gap-1 text-[12px] font-bold text-cyan">
              <Zap size={12} /> +{level.rewards.xp} XP
            </span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {starGoals(level).map((g) => (
              <li key={g} className="flex items-center gap-2 text-[12.5px] text-[#cbd5e1]">
                <Star size={12} className="text-[#fbbf24]" /> {g}
              </li>
            ))}
          </ul>
        </section>
        {showHints && (
          <section>
            <h3 className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted">Hints</h3>
            <ul className="mt-1.5 space-y-1.5">
              {level.hints.slice(0, hintsShown).map((h, i) => (
                <li key={h} className="flex gap-2 rounded-[var(--radius-chip)] bg-[#fbbf24]/8 px-2.5 py-1.5 text-[12.5px] text-[#fde68a] animate-fade-in">
                  <span className="font-bold">{i + 1}.</span> <span className={h.includes('\n') ? 'min-w-0 whitespace-pre-wrap font-mono text-[11.5px]' : ''}>{h}</span>
                </li>
              ))}
            </ul>
            <HintButton level={level} first="Need a hint?" next="Another hint" className="mt-2 rounded-[var(--radius-chip)] px-2 py-1 hover:bg-[#fbbf24]/10" />
          </section>
        )}
      </div>
    </aside>
  );
}
