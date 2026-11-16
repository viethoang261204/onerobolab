import { useMemo, useState } from 'react';
import { navigate } from '../../router/router-store';
import { adminPaths } from '../admin-routes';
import type { GraphLevel } from '../api/types';
import { buildDependencyGraph, lineage, NODE_H, NODE_W } from '../lib/dependency-graph';
import { CONTENT_STATUS } from '../lib/labels';
import { cx } from '../ui/primitives';

const STATUS_COLOR: Record<string, string> = {
  success: '#12b76a',
  review: '#7a5af8',
  warning: '#f79009',
  neutral: '#98a2b3',
};

/**
 * Level dependency graph: columns = how many levels come first; arrows go
 * from a prerequisite to the level it unlocks. Solid = required, dashed =
 * an alternative rule group ("or"), dotted = "complete the whole world".
 * Hover (or `focusId`) highlights everything a level depends on and unlocks.
 */
export function DependencyGraphView({ levels, focusId, onSelect }: { levels: readonly GraphLevel[]; focusId?: string; onSelect?: (id: string) => void }) {
  const graph = useMemo(() => buildDependencyGraph(levels), [levels]);
  const [hover, setHover] = useState<string | null>(null);
  const active = hover ?? focusId ?? null;
  const related = useMemo(() => (active ? lineage(graph, active) : null), [graph, active]);
  const pos = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const PAD = 16;

  const isLit = (id: string) => !related || id === active || related.ancestors.has(id) || related.descendants.has(id);

  if (!graph.nodes.length) return <p className="py-8 text-center text-sm text-adm-muted">No levels to show.</p>;

  return (
    <div className="overflow-auto rounded-lg border border-adm-line bg-adm-subtle">
      <svg
        width={graph.width + PAD * 2}
        height={graph.height + PAD * 2}
        role="img"
        aria-label={`Dependency graph of ${graph.nodes.length} levels`}
        className="block"
      >
        <defs>
          <marker id="dep-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
          </marker>
          <marker id="dep-arrow-lit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#2563eb" />
          </marker>
        </defs>
        <g transform={`translate(${PAD} ${PAD})`}>
          {graph.edges.map((e) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x - 2;
            const y2 = b.y + NODE_H / 2;
            const mid = (x1 + x2) / 2;
            const lit = !!related && isLit(e.from) && isLit(e.to);
            return (
              <path
                key={`${e.from}-${e.to}-${e.alternative}`}
                d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                fill="none"
                stroke={lit ? '#2563eb' : '#b8c2d0'}
                strokeOpacity={related && !lit ? 0.35 : 1}
                strokeWidth={lit ? 2 : 1.4}
                strokeDasharray={e.kind === 'world' ? '2 4' : e.alternative ? '6 4' : undefined}
                markerEnd={lit ? 'url(#dep-arrow-lit)' : 'url(#dep-arrow)'}
              />
            );
          })}
          {graph.nodes.map((n) => {
            const meta = CONTENT_STATUS[n.status];
            const lit = isLit(n.id);
            const focused = n.id === (focusId ?? null);
            const mode = n.accessMode === 'UNLOCKED' ? 'Open to all' : n.accessMode === 'LOCKED' ? 'Locked for all' : null;
            const subtitle = `${n.worldName} · ${mode ?? (n.extras.length ? n.extras[0] : meta.label)}`;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                className="cursor-pointer"
                tabIndex={0}
                role="link"
                aria-label={`${n.title}, ${n.worldName}, ${meta.label}`}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(n.id)}
                onBlur={() => setHover(null)}
                onClick={() => (onSelect ? onSelect(n.id) : navigate(adminPaths.level(n.id, 'unlock')))}
                onKeyDown={(ev) => ev.key === 'Enter' && (onSelect ? onSelect(n.id) : navigate(adminPaths.level(n.id, 'unlock')))}
                opacity={lit ? 1 : 0.35}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx="9"
                  fill="#fff"
                  stroke={focused ? '#2563eb' : '#d0d5dd'}
                  strokeWidth={focused ? 2 : 1}
                  className={cx(!focused && 'hover:stroke-[#2563eb]')}
                />
                <rect x="0" y="0" width="4" height={NODE_H} rx="2" fill={STATUS_COLOR[meta.tone] ?? '#98a2b3'} />
                <text x="14" y="23" fontSize="13" fontWeight="600" fill="#0f172a">
                  {n.title.length > 24 ? `${n.title.slice(0, 23)}…` : n.title}
                </text>
                <text x="14" y="42" fontSize="11" fill="#64748b">
                  {subtitle.length > 30 ? `${subtitle.slice(0, 29)}…` : subtitle}
                </text>
                <title>{[n.title, n.worldName, meta.label, mode, ...n.extras].filter(Boolean).join(' · ')}</title>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="flex flex-wrap gap-4 border-t border-adm-line bg-adm-surface px-3 py-2 text-xs text-adm-muted">
        <span className="flex items-center gap-1.5">
          <svg width="26" height="6" aria-hidden>
            <line x1="0" y1="3" x2="26" y2="3" stroke="#94a3b8" strokeWidth="1.5" />
          </svg>
          must complete
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="26" height="6" aria-hidden>
            <line x1="0" y1="3" x2="26" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 4" />
          </svg>
          alternative rule (or)
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="26" height="6" aria-hidden>
            <line x1="0" y1="3" x2="26" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 4" />
          </svg>
          complete the whole world
        </span>
        <span>Hover a level to highlight what it needs and what it unlocks. Click to edit its rules.</span>
      </div>
    </div>
  );
}
