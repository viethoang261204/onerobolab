import { Code2, PanelLeftOpen, X } from 'lucide-react';
import { useMemo } from 'react';
import { LevelRegistry } from '../../../content/levels/registry';
import { missionDataKeys } from '../../../content/levels/variants';
import { useLocale, useMessages } from '../../i18n/i18n';
import { useLevelStore } from '../../levels/level-store';
import { programmingMessages } from '../programming.messages';
import type { ToolboxLayoutMode } from '../toolbox/BlockToolbox';
import { pythonCommands, type PythonCommand } from './python-api';
import { insertPython } from './PythonEditor';

export interface PythonReferenceProps {
  layoutMode?: ToolboxLayoutMode;
  drawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
}

/**
 * Left rail in Python mode: the commands this mission allows (the same
 * toolbox rules as the blocks), click/tap to insert at the cursor, plus the
 * mission values the program can read.
 */
export function PythonReference({ layoutMode = 'desktop', drawerOpen = false, onDrawerOpenChange }: PythonReferenceProps) {
  const locale = useLocale();
  const m = useMessages(programmingMessages);
  const levelId = useLevelStore((s) => s.levelId);
  const level = LevelRegistry.get(levelId);
  const commands = useMemo(() => pythonCommands(level?.allowedBlocks ?? 'all', locale), [level, locale]);
  const data = level ? missionDataKeys(level) : [];

  const groups: readonly { kind: PythonCommand['kind']; label: string }[] = [
    { kind: 'action', label: m.pythonGroupAction },
    { kind: 'value', label: m.pythonGroupValue },
    { kind: 'structure', label: m.pythonGroupStructure },
  ];

  const isOverlay = layoutMode !== 'desktop';
  const closeOverlay = () => onDrawerOpenChange?.(false);
  const pick = (code: string) => {
    insertPython(code);
    if (layoutMode === 'phone') closeOverlay();
  };

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#93c5fd]">
          <Code2 size={15} aria-hidden="true" /> {m.pythonCommandsTitle}
        </div>
        {isOverlay && (
          <button
            type="button"
            onClick={closeOverlay}
            aria-label={m.closePanel}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:bg-white/8 hover:text-text"
          >
            <X size={18} />
          </button>
        )}
      </div>
      {groups.map((g) => {
        const list = commands.filter((c) => c.kind === g.kind);
        if (!list.length) return null;
        return (
          <section key={g.kind} className="flex flex-col gap-1.5">
            <h3 className="px-1 text-[11.5px] font-semibold text-muted">{g.label}</h3>
            {list.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pick(c.insert)}
                title={m.pythonInsertTitle({ code: c.insert.trim() })}
                className="min-h-[44px] rounded-[10px] border border-white/6 bg-white/[0.03] px-2.5 py-2 text-left transition-colors duration-150 hover:border-white/12 hover:bg-white/[0.07]"
              >
                <code className="block font-mono text-[12.5px] text-[#e2e8f0]">{c.code}</code>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{c.help}</span>
              </button>
            ))}
          </section>
        );
      })}
      {data.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="px-1 text-[11.5px] font-semibold text-muted">{m.pythonMissionValues}</h3>
          {data.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pick(`mission.${k}`)}
              className="min-h-[44px] rounded-[10px] border border-white/6 bg-white/[0.03] px-2.5 py-2 text-left font-mono text-[12.5px] text-[#fbbf24] hover:bg-white/[0.07]"
            >
              mission.{k}
            </button>
          ))}
        </section>
      )}
    </>
  );

  if (isOverlay) {
    return (
      <>
        {layoutMode === 'tablet' && (
          <aside aria-label={m.pythonCommandsTitle} className="flex w-[60px] shrink-0 flex-col items-center border-r border-white/[0.07] bg-[#0b1628] p-2">
            <button
              type="button"
              onClick={() => onDrawerOpenChange?.(true)}
              title={m.pythonCommandsTitle}
              aria-label={m.pythonCommandsTitle}
              className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[#93c5fd] hover:bg-white/8 hover:text-white"
            >
              <PanelLeftOpen size={18} />
            </button>
          </aside>
        )}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 flex">
            <div aria-hidden="true" onClick={closeOverlay} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
            <aside
              aria-label={m.pythonCommandsTitle}
              className="relative z-10 flex h-full w-[280px] max-w-[85vw] flex-col gap-3 overflow-y-auto border-r border-white/10 bg-[#0b1628] p-3 shadow-[0_18px_40px_-10px_rgb(0_0_0/0.85)]"
            >
              {body}
            </aside>
          </div>
        )}
      </>
    );
  }

  return (
    <aside aria-label={m.pythonCommandsTitle} className="flex w-[268px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-white/[0.07] bg-[#0b1628] p-3">
      {body}
    </aside>
  );
}
