import { Code2 } from 'lucide-react';
import { useMemo } from 'react';
import { LevelRegistry } from '../../../content/levels/registry';
import { missionDataKeys } from '../../../content/levels/variants';
import { useLevelStore } from '../../levels/level-store';
import { pythonCommands, type PythonCommand } from './python-api';
import { insertPython } from './PythonEditor';

const GROUPS: readonly { kind: PythonCommand['kind']; label: string }[] = [
  { kind: 'action', label: 'Robot actions' },
  { kind: 'value', label: 'Sensors & values' },
  { kind: 'structure', label: 'Loops, ifs & functions' },
];

/**
 * Left rail in Python mode: the commands this mission allows (the same
 * toolbox rules as the blocks), click to insert at the cursor, plus the
 * mission values the program can read.
 */
export function PythonReference() {
  const levelId = useLevelStore((s) => s.levelId);
  const level = LevelRegistry.get(levelId);
  const commands = useMemo(() => pythonCommands(level?.allowedBlocks ?? 'all'), [level]);
  const data = level ? missionDataKeys(level) : [];
  return (
    <aside aria-label="Python commands" className="flex w-[268px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-white/[0.07] bg-[#0b1628] p-3">
      <div className="flex items-center gap-2 px-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[#93c5fd]">
        <Code2 size={15} aria-hidden="true" /> Python commands
      </div>
      {GROUPS.map((g) => {
        const list = commands.filter((c) => c.kind === g.kind);
        if (!list.length) return null;
        return (
          <section key={g.kind} className="flex flex-col gap-1.5">
            <h3 className="px-1 text-[11.5px] font-semibold text-muted">{g.label}</h3>
            {list.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => insertPython(c.insert)}
                title={`Insert: ${c.insert.trim()}`}
                className="rounded-[10px] border border-white/6 bg-white/[0.03] px-2.5 py-2 text-left transition-colors duration-150 hover:border-white/12 hover:bg-white/[0.07]"
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
          <h3 className="px-1 text-[11.5px] font-semibold text-muted">Mission values (change every run)</h3>
          {data.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => insertPython(`mission.${k}`)}
              className="rounded-[10px] border border-white/6 bg-white/[0.03] px-2.5 py-1.5 text-left font-mono text-[12.5px] text-[#fbbf24] hover:bg-white/[0.07]"
            >
              mission.{k}
            </button>
          ))}
        </section>
      )}
    </aside>
  );
}
