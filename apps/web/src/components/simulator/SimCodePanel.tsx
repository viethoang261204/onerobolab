import { Blocks, BookOpen, Code2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LevelDefinition } from '../../content/levels/types';
import { missionDataKeys } from '../../content/levels/variants';
import { BlockEditor } from '../../features/programming/editor/BlockEditor';
import { ProgrammingOverlays } from '../../features/programming/editor/ProgrammingOverlays';
import { BlockToolbox } from '../../features/programming/toolbox/BlockToolbox';
import { pythonCommands } from '../../features/programming/python/python-api';
import { insertPython, PythonEditor } from '../../features/programming/python/PythonEditor';
import { useProgramStore } from '../../features/programming/state/program-store';
import { checkProgram } from '../../features/programming/studio/program-check';
import { useSettingsStore } from '../../features/settings/settings-store';
import { cn } from '../../utils/cn';
import { useLocale, useMessages } from '../../features/i18n/i18n';
import { simulatorMessages } from './simulator.messages';

type PanelTab = 'python' | 'blocks';

/**
 * Side-by-side code + API Spellbook panel inside the Simulator (CodeCombat-style),
 * sharing the single `program-store` with Code Studio so edits run immediately.
 */
export function SimCodePanel({ level, onClose }: { level: LevelDefinition; onClose: () => void }) {
  const m = useMessages(simulatorMessages);
  const tab: PanelTab = useSettingsStore((s) => s.codingLanguage);
  const [docsOpen, setDocsOpen] = useState(true);
  const program = useProgramStore((s) => s.program);
  const errors = useProgramStore((s) => s.errorCount);
  const check = checkProgram(program, errors);
  const locale = useLocale();
  // eslint-free note: `locale` re-runs the memo so the Spellbook follows a language switch.
  const commands = useMemo(() => pythonCommands(level.allowedBlocks), [level.allowedBlocks, locale]);
  const dataKeys = useMemo(() => missionDataKeys(level), [level]);

  return (
    <aside
      aria-label={m.codePanelAria}
      className={cn(
        // Below 1024 px the panel covers the whole simulator (the student edits, then closes it to run).
        'flex shrink-0 flex-col border-white/10 bg-[#0b1628] text-white transition-[width] duration-200 max-lg:absolute max-lg:inset-0 max-lg:z-30 max-lg:w-full lg:h-full lg:border-l',
        tab === 'blocks' ? 'lg:w-[560px] xl:w-[640px]' : 'lg:w-[450px] xl:w-[510px]',
      )}
    >
      <div className="flex h-14 shrink-0 lg:h-12 items-center justify-between gap-2 border-b border-white/[0.08] px-3">
        <div className="flex items-center gap-2">
          {tab === 'python' ? (
            <Code2 size={16} className="text-cyan" aria-hidden="true" />
          ) : (
            <Blocks size={16} className="text-cyan" aria-hidden="true" />
          )}
          <span className="text-[13px] font-bold text-white">
            {tab === 'python' ? m.python : m.codingBlocks}
          </span>
          <span
            className={cn(
              'ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              check.ok ? 'bg-success/15 text-[#4ade80]' : check.reason === 'empty' ? 'bg-white/5 text-muted' : 'bg-danger/15 text-[#fca5a5]',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', check.ok ? 'bg-success' : check.reason === 'empty' ? 'bg-faint' : 'bg-danger')} />
            {check.ok ? m.codeReady : check.reason === 'empty' ? m.codeEmpty : m.codeErrors({ n: errors })}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {tab === 'python' && (
            <button
              type="button"
              onClick={() => setDocsOpen((v) => !v)}
              title={m.toggleSpellbook}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] max-lg:min-h-11 font-semibold transition-colors',
                docsOpen ? 'bg-cyan/15 text-cyan' : 'text-muted hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <BookOpen size={13} aria-hidden="true" /> API
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={m.hideCode}
            className="flex h-11 w-11 lg:h-7 lg:w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {tab === 'python' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            <PythonEditor />
          </div>
          {docsOpen && (
            <div className="max-h-[210px] shrink-0 overflow-y-auto border-t border-white/[0.08] bg-[#081120] p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.1em] text-[#93c5fd]">
                <span>{m.spellbook}</span>
                <span className="font-normal normal-case text-muted">{m.methods({ n: commands.length })}</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {commands.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => insertPython(c.insert)}
                    title={c.help}
                    className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1.5 text-left pointer-coarse:min-h-11 transition-colors hover:border-cyan/30 hover:bg-white/[0.07]"
                  >
                    <code className="block truncate font-mono text-[11.5px] text-[#e2e8f0]">{c.code}</code>
                    <span className="block truncate text-[10.5px] text-muted">{c.help}</span>
                  </button>
                ))}
                {dataKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => insertPython(`mission.${k}`)}
                    className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-2 py-1.5 text-left font-mono text-[11.5px] text-[#fbbf24] hover:bg-amber-400/10"
                  >
                    mission.{k}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <BlockToolbox />
          <BlockEditor />
          <ProgrammingOverlays />
        </div>
      )}
    </aside>
  );
}
