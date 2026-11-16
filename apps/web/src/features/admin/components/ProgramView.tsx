import { Check, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { outlineProgram, outlineText, type OutlineLine } from '../lib/program-outline';
import { Tabs } from '../ui/layout';
import { Badge, Button, cx, Notice } from '../ui/primitives';

/** One program line, drawn like a flat block: category colour bar, label, values as chips. */
function Line({ line }: { line: OutlineLine }) {
  const indent = { paddingLeft: `${line.depth * 22 + 4}px` };
  if (line.kind === 'script') {
    return (
      <li className="mt-3 border-t border-dashed border-adm-line pt-2 text-xs font-semibold tracking-wide text-adm-faint uppercase" style={indent}>
        {line.parts[0]?.text}
      </li>
    );
  }
  if (line.kind === 'label' || line.kind === 'empty') {
    return (
      <li className={cx('py-0.5 text-[13px]', line.kind === 'label' ? 'font-semibold text-adm-body' : 'text-adm-faint italic')} style={indent}>
        {line.parts[0]?.text}
      </li>
    );
  }
  const color = line.category ? `var(--color-cat-${line.category})` : 'var(--color-adm-faint)';
  return (
    <li style={indent} className="py-0.5">
      <div
        className={cx('inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-md border border-adm-line bg-adm-surface py-1 pr-2.5 pl-2 text-[13px] text-adm-ink shadow-adm', line.disabled && 'opacity-50')}
        style={{ borderLeft: `4px solid ${color}` }}
      >
        {line.parts.map((p, i) =>
          p.kind === 'text' ? (
            <span key={i}>{p.text}</span>
          ) : (
            <span key={i} className="tabular rounded bg-adm-subtle px-1.5 py-px font-mono text-[12px] text-adm-ink ring-1 ring-adm-line">
              {p.text}
            </span>
          ),
        )}
        {line.disabled && <Badge>disabled</Badge>}
      </div>
      {line.comment && <p className="mt-0.5 ml-2 text-xs text-adm-muted italic">“{line.comment}”</p>}
    </li>
  );
}

/**
 * A student's block program, readable for staff: the blocks as an indented
 * outline (same labels as the editor) and the generated Python.
 */
export function ProgramView({ blockProgram, pythonCode }: { blockProgram: unknown; pythonCode?: string | null }) {
  const outline = useMemo(() => outlineProgram(blockProgram, pythonCode), [blockProgram, pythonCode]);
  const [tab, setTab] = useState<'blocks' | 'python'>('blocks');
  const [copied, setCopied] = useState(false);

  if (!outline) return <Notice tone="warning">This program could not be read (it is empty or in an unknown format).</Notice>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tab === 'python' ? outline.python : outlineText(outline));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable; nothing to do.
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <Tabs
          label="Program view"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'blocks', label: 'Blocks', count: outline.runnableBlocks },
            { id: 'python', label: 'Python' },
          ]}
        />
        <Button size="sm" variant="ghost" icon={copied ? Check : Copy} onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {tab === 'blocks' ? (
        <>
          {outline.variables.length > 0 && (
            <p className="mb-2 text-xs text-adm-muted">
              Variables: <span className="font-mono text-adm-body">{outline.variables.join(', ')}</span>
            </p>
          )}
          <ul className="flex flex-col" aria-label="Program blocks">
            {outline.lines.map((l) => (
              <Line key={l.key} line={l} />
            ))}
          </ul>
        </>
      ) : (
        <pre className="overflow-x-auto rounded-lg bg-adm-nav p-4 font-mono text-[12.5px] leading-relaxed text-slate-100">
          <code>{outline.python}</code>
        </pre>
      )}
    </div>
  );
}
