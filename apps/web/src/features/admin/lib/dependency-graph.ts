import type { AccessMode, ContentStatus, GraphLevel } from '../api/types';
import { describeRequirement } from './unlock-rules';

/*
 * Layout for the level dependency graph: levels are placed in columns by
 * depth (how many levels must be finished before them), edges point from a
 * prerequisite to the level it unlocks. "Complete world W" is drawn as edges
 * from every level of W. Pure and cycle-safe.
 */

export const NODE_W = 196;
export const NODE_H = 58;
const GAP_X = 72;
const GAP_Y = 18;

export interface GraphNode {
  readonly id: string;
  readonly title: string;
  readonly worldName: string;
  readonly status: ContentStatus;
  readonly accessMode: AccessMode;
  /** Requirements that aren't levels (stars, XP, achievements) — shown as a note. */
  readonly extras: readonly string[];
  readonly col: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'level' | 'stars' | 'world';
  /** From a second or later rule group ("or"). */
  readonly alternative: boolean;
}

export interface DependencyGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly width: number;
  readonly height: number;
}

export function buildDependencyGraph(levels: readonly GraphLevel[]): DependencyGraph {
  const byId = new Map(levels.map((l) => [l.id, l]));
  const byWorld = new Map<string, string[]>();
  for (const l of levels) byWorld.set(l.worldId, [...(byWorld.get(l.worldId) ?? []), l.id]);

  const edges: GraphEdge[] = [];
  const extras = new Map<string, string[]>();
  for (const l of levels) {
    l.prerequisites.forEach((g, gi) => {
      for (const r of g.requirements) {
        if ((r.type === 'LEVEL_COMPLETED' || r.type === 'LEVEL_STARS') && r.levelId && byId.has(r.levelId)) {
          edges.push({ from: r.levelId, to: l.id, kind: r.type === 'LEVEL_STARS' ? 'stars' : 'level', alternative: gi > 0 });
        } else if (r.type === 'WORLD_COMPLETED' && r.worldId && byWorld.has(r.worldId)) {
          for (const from of byWorld.get(r.worldId)!) if (from !== l.id) edges.push({ from, to: l.id, kind: 'world', alternative: gi > 0 });
        } else {
          extras.set(l.id, [...(extras.get(l.id) ?? []), describeRequirement(r)]);
        }
      }
    });
  }

  const incoming = new Map<string, string[]>();
  for (const e of edges) incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from]);

  // Depth = longest chain of prerequisites (a cycle, which the API refuses, is cut).
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const d = Math.max(-1, ...(incoming.get(id) ?? []).map(depthOf)) + 1;
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };

  const order = (a: GraphLevel, b: GraphLevel) => a.worldOrder - b.worldOrder || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
  const columns = new Map<number, GraphLevel[]>();
  for (const l of [...levels].sort(order)) {
    const c = depthOf(l.id);
    columns.set(c, [...(columns.get(c) ?? []), l]);
  }

  const nodes: GraphNode[] = [];
  let rows = 0;
  for (const [col, list] of columns) {
    rows = Math.max(rows, list.length);
    list.forEach((l, row) =>
      nodes.push({
        id: l.id,
        title: l.title,
        worldName: l.worldName,
        status: l.status,
        accessMode: l.accessMode,
        extras: extras.get(l.id) ?? [],
        col,
        row,
        x: col * (NODE_W + GAP_X),
        y: row * (NODE_H + GAP_Y),
      }),
    );
  }
  const cols = columns.size ? Math.max(...columns.keys()) + 1 : 0;
  // De-duplicate edges (a level can be required by two groups).
  const seen = new Set<string>();
  const unique = edges.filter((e) => {
    const k = `${e.from}>${e.to}>${e.alternative}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    nodes,
    edges: unique,
    width: Math.max(0, cols * (NODE_W + GAP_X) - GAP_X),
    height: Math.max(0, rows * (NODE_H + GAP_Y) - GAP_Y),
  };
}

/** Everything `id` depends on and everything that depends on it (for highlighting). */
export function lineage(graph: DependencyGraph, id: string): { ancestors: Set<string>; descendants: Set<string> } {
  const walk = (start: string, next: (e: GraphEdge) => [string, string]) => {
    const out = new Set<string>();
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const e of graph.edges) {
        const [a, b] = next(e);
        if (a === cur && !out.has(b) && b !== id) {
          out.add(b);
          stack.push(b);
        }
      }
    }
    return out;
  };
  return { ancestors: walk(id, (e) => [e.to, e.from]), descendants: walk(id, (e) => [e.from, e.to]) };
}
