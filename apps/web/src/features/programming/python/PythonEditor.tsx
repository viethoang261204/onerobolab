import { AlertTriangle, Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { ProgramState } from '../blocks/block-types';
import { generatePythonWithLines } from '../generators/python-generator';
import { highlight } from '../generators/PythonView';
import { useProgramStore } from '../state/program-store';
import { useRuntimeStore } from '../../simulator/runtime/runtime-store';
import { pythonToBlocks, type PythonProblem } from './python-to-blocks';

const LINE = 24;
const PAD = 14;
const INDENT = '    ';
/** Wait this long after the last keystroke before rebuilding the blocks (ms). */
const PARSE_DELAY = 350;

let inserter: ((code: string) => void) | null = null;
/** Insert code at the Python editor's cursor (the command reference). */
export const insertPython = (code: string) => inserter?.(code);

/**
 * Editable Python for the program. The text is a second view of the block
 * program (the single source of truth): every valid edit rebuilds the
 * blocks (`pythonToBlocks`), and block edits regenerate the text. Nothing is
 * executed here — Run compiles the blocks as always.
 */
export function PythonEditor() {
  const program = useProgramStore((s) => s.program);
  const replaceProgram = useProgramStore((s) => s.replaceProgram);
  const generated = useMemo(() => generatePythonWithLines(program), [program]);
  const [text, setText] = useState(generated.code);
  const [problem, setProblem] = useState<PythonProblem | null>(null);
  /** The program this editor produced last (so its own edits don't overwrite the text). */
  const own = useRef<ProgramState | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const errorBlock = useRuntimeStore((s) => s.errorBlockId);

  // Blocks changed elsewhere (undo, the block editor, another level): show their Python.
  useEffect(() => {
    if (program === own.current) return;
    setText(generated.code);
    setProblem(null);
  }, [program, generated.code]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // The command reference inserts code at the cursor.
  useEffect(() => {
    inserter = (code: string) => {
      const el = area.current;
      if (!el) return;
      const { selectionStart: a, selectionEnd: b, value } = el;
      const lineStart = value.lastIndexOf('\n', a - 1) + 1;
      const indent = /^\s*/.exec(value.slice(lineStart, a))?.[0] ?? '';
      // Multi-line snippets keep the indentation of the line they are inserted on.
      const piece = code.replace(/\n/g, '\n' + indent);
      const next = value.slice(0, a) + piece + value.slice(b);
      change(next);
      el.focus();
      requestAnimationFrame(() => el.setSelectionRange(a + piece.length, a + piece.length));
    };
    return () => {
      inserter = null;
    };
  });

  const apply = (source: string) => {
    const r = pythonToBlocks(source, useProgramStore.getState().program);
    if (!r.ok) return setProblem(r.problem);
    setProblem(null);
    own.current = r.program;
    replaceProgram(r.program);
  };

  const change = (next: string) => {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(next), PARSE_DELAY);
  };

  /** Tab indents; Enter keeps the indentation (one level deeper after “:”). */
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation(); // editor shortcuts (delete block, undo…) must not fire while typing
    const el = e.currentTarget;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const insert = (s: string, caret = a + s.length) => {
      const next = value.slice(0, a) + s + value.slice(b);
      change(next);
      requestAnimationFrame(() => el.setSelectionRange(caret, caret));
    };
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey) return insert(INDENT);
      const start = value.lastIndexOf('\n', a - 1) + 1;
      if (value.startsWith(INDENT, start)) {
        change(value.slice(0, start) + value.slice(start + INDENT.length));
        requestAnimationFrame(() => el.setSelectionRange(Math.max(start, a - 4), Math.max(start, a - 4)));
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const start = value.lastIndexOf('\n', a - 1) + 1;
      const line = value.slice(start, a);
      const indent = /^\s*/.exec(line)?.[0] ?? '';
      insert('\n' + indent + (line.trimEnd().endsWith(':') ? INDENT : ''));
    }
  };

  const lines = text.split('\n');
  const errorLine = problem?.line ?? null;
  const failedLine = errorBlock && !problem && program !== own.current ? generated.blockAt.indexOf(errorBlock) + 1 || null : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-white/6 bg-[#0a1424]">
      <div className="relative min-h-0 flex-1 overflow-auto">
        <div className="relative grid min-w-max grid-cols-[44px_1fr] font-mono text-[13.5px]" style={{ lineHeight: `${LINE}px`, paddingTop: PAD, paddingBottom: PAD }}>
          <div aria-hidden="true" className="select-none pr-3 text-right text-[12px] text-faint">
            {lines.map((_, i) => (
              <div key={i} className={i + 1 === errorLine || i + 1 === failedLine ? 'font-bold text-[#f87171]' : ''}>
                {i + 1}
              </div>
            ))}
          </div>
          <div className="relative pl-3 pr-6">
            {/* Highlighted text under a transparent textarea with the same metrics. */}
            <div aria-hidden="true" className="pointer-events-none whitespace-pre text-[#e2e8f0]">
              {lines.map((line, i) => (
                <div key={i} className={i + 1 === errorLine ? '-mx-3 bg-[#7f1d1d]/45 px-3' : i + 1 === failedLine ? '-mx-3 bg-[#7f1d1d]/30 px-3' : ''}>
                  {line ? highlight(line) : '​'}
                </div>
              ))}
            </div>
            <textarea
              ref={area}
              aria-label="Python program"
              value={text}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              wrap="off"
              onChange={(e) => change(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => {
                clearTimeout(timer.current);
                apply(text);
              }}
              className="absolute inset-0 resize-none overflow-hidden whitespace-pre bg-transparent pl-3 pr-6 font-mono text-[13.5px] text-transparent caret-white outline-none selection:bg-cyan/30"
              style={{ lineHeight: `${LINE}px` }}
            />
          </div>
        </div>
      </div>
      <div
        role="status"
        aria-live="polite"
        className={`flex min-h-10 items-center gap-2 border-t px-4 py-2 font-sans text-[12.5px] ${problem ? 'border-[#7f1d1d] bg-[#2a1215] text-[#fecaca]' : 'border-white/6 text-muted'}`}
      >
        {problem ? (
          <>
            <AlertTriangle size={15} className="shrink-0 text-[#f87171]" aria-hidden="true" /> Line {problem.line}: {problem.message}
          </>
        ) : (
          <>
            <Check size={15} className="shrink-0 text-[#4ade80]" aria-hidden="true" /> Python and blocks are in sync — editing one updates the other.
          </>
        )}
      </div>
    </div>
  );
}
