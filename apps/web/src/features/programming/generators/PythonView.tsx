import { Fragment, type ReactNode } from 'react';
import { useMessages } from '../../i18n/i18n';
import { programmingMessages } from '../programming.messages';

const TOKEN = /(#.*$)|("[^"]*"|'[^']*')|\b(from|import|while|not|and|or|if|else|elif|for|in|def|break|pass|return|True|False|None)\b|\b(\d+(?:\.\d+)?)\b|(\w+)(?=\()/gm;

/** Tiny highlighter for the read-only Python preview (no dependency). */
export function highlight(line: string) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const start = m.index;
    if (start > last) out.push(line.slice(last, start));
    const [text, comment, str, kw, num, fn] = m;
    const cls = comment ? 'text-faint italic' : str ? 'text-[#86efac]' : kw ? 'text-[#c4b5fd]' : num ? 'text-[#fbbf24]' : fn ? 'text-cyan' : '';
    out.push(
      <span key={start} className={cls}>
        {text}
      </span>,
    );
    last = start + text.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function PythonView({ source }: { source: string }) {
  const m = useMessages(programmingMessages);
  const lines = source.replace(/\n$/, '').split('\n');
  return (
    <div className="relative min-h-0 flex-1 overflow-auto rounded-[14px] border border-white/6 bg-[#0a1424] py-4 font-mono text-[13.5px] leading-[26px]">
      <div className="grid grid-cols-[40px_1fr]">
        {lines.map((line, i) => (
          <Fragment key={i}>
            <span className="select-none pr-3 text-right text-[12px] text-faint">{i + 1}</span>
            <code className="whitespace-pre pl-3 text-[#e2e8f0]">{highlight(line)}</code>
          </Fragment>
        ))}
      </div>
      <p className="mx-4 mt-4 rounded-lg border border-dashed border-edge-strong px-3 py-2 font-sans text-xs text-muted">
        {m.pythonReadOnlyHint}
      </p>
    </div>
  );
}
