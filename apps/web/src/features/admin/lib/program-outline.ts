import { getBlockDef } from '@robolab/blocks';
import type { BlockCategoryId, BlockId, BlockInstance, BlockType, ProgramState } from '@robolab/blocks';
import { chainIds } from '@robolab/blocks';
import { parseProgram } from '@robolab/blocks';
import { generatePython } from '../../programming/generators/python-generator';

/*
 * A stored block program as readable, indented lines for the admin program
 * viewer — built from the same block registry the editor uses, so labels
 * match what the student saw ("move forward 170 cm", "repeat 4 times").
 */

export type OutlinePart = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'value'; readonly text: string };

export interface OutlineLine {
  readonly key: string;
  readonly depth: number;
  /** block = a statement/hat; label = "else" divider; empty = an empty slot; script = header of a detached script. */
  readonly kind: 'block' | 'label' | 'empty' | 'script';
  readonly type?: BlockType;
  readonly category?: BlockCategoryId;
  readonly parts: readonly OutlinePart[];
  readonly disabled: boolean;
  readonly comment?: string;
}

export interface ProgramOutline {
  readonly lines: readonly OutlineLine[];
  /** Statement blocks attached under "when program starts". */
  readonly runnableBlocks: number;
  readonly variables: readonly string[];
  readonly python: string;
}

/** Parse a stored `block_program` (unknown JSON) into the editor's program model; null if it isn't one. */
export function toProgramState(raw: unknown): ProgramState | null {
  if (!raw || typeof raw !== 'object') return null;
  try {
    return parseProgram(JSON.stringify(raw));
  } catch {
    return null;
  }
}

const formatValue = (v: unknown, unit?: string): string => {
  if (v === '' || v === undefined || v === null) return '?';
  const s = String(v);
  if (!unit) return s;
  return unit === '°' || unit === '%' ? `${s}${unit}` : `${s} ${unit}`;
};

/** A value block inline: "distance (cm)", "(3 + 4)", "color is red?". */
function inline(p: ProgramState, id: BlockId | null | undefined, seen: Set<BlockId>): string {
  const b = id ? p.blocks[id] : undefined;
  if (!b || seen.has(b.id)) return '…';
  seen.add(b.id);
  const text = headerParts(p, b, seen)
    .map((x) => x.text)
    .join(' ')
    .replace(/\s+\?/g, '?')
    .trim();
  const def = getBlockDef(b.type);
  // Nested arithmetic reads better in brackets.
  return def.template.length > 1 && def.category === 'math' ? `(${text})` : text;
}

function headerParts(p: ProgramState, b: BlockInstance, seen: Set<BlockId>): OutlinePart[] {
  const def = getBlockDef(b.type);
  return def.template.map((part): OutlinePart => {
    if (typeof part === 'string') return { kind: 'text', text: part };
    const arg = def.args[part.arg];
    const child = b.inputs[part.arg];
    if (child) return { kind: 'value', text: inline(p, child, seen) };
    if (!arg) return { kind: 'value', text: '?' };
    switch (arg.kind) {
      case 'boolean':
        return { kind: 'value', text: '…' };
      case 'number':
        return { kind: 'value', text: formatValue(b.fields[part.arg], arg.unit) };
      case 'dropdown': {
        const v = String(b.fields[part.arg] ?? arg.default);
        return { kind: 'value', text: arg.options.find((o) => o.value === v)?.label ?? v };
      }
      case 'variable':
      case 'text':
      case 'functionName':
        return { kind: 'value', text: String(b.fields[part.arg] ?? '?') };
      case 'dataKey':
        return { kind: 'value', text: `mission.${String(b.fields[part.arg] ?? '?')}` };
    }
  });
}

function stackLines(p: ProgramState, head: BlockId | null, depth: number, out: OutlineLine[], seen: Set<BlockId>): number {
  let count = 0;
  for (const id of chainIds(p.blocks, head)) {
    const b = p.blocks[id];
    if (!b || seen.has(id)) break;
    seen.add(id);
    const def = getBlockDef(b.type);
    out.push({
      key: id,
      depth,
      kind: 'block',
      type: b.type,
      category: def.category,
      parts: headerParts(p, b, seen),
      disabled: !!b.disabled,
      ...(b.comment ? { comment: b.comment } : {}),
    });
    if (def.shape !== 'hat' && !b.disabled) count++;
    for (const slot of def.slots ?? []) {
      if (slot.label) out.push({ key: `${id}:${slot.name}`, depth, kind: 'label', parts: [{ kind: 'text', text: slot.label }], disabled: !!b.disabled });
      const inner = b.slots[slot.name] ?? null;
      if (!inner) out.push({ key: `${id}:${slot.name}:empty`, depth: depth + 1, kind: 'empty', parts: [{ kind: 'text', text: '(empty)' }], disabled: !!b.disabled });
      else {
        const n = stackLines(p, inner, depth + 1, out, seen);
        if (!b.disabled) count += n;
      }
    }
  }
  return count;
}

/** Outline + counts + Python for a stored program; null when the JSON isn't a valid program. */
export function outlineProgram(raw: unknown, storedPython?: string | null): ProgramOutline | null {
  const p = toProgramState(raw);
  if (!p) return null;
  const lines: OutlineLine[] = [];
  const seen = new Set<BlockId>();
  const roots = [...p.roots].sort((a, b) => (a.id === 'start' ? -1 : b.id === 'start' ? 1 : a.y - b.y || a.x - b.x));
  let runnable = 0;
  for (const root of roots) {
    const isStart = root.id === 'start';
    if (!isStart) lines.push({ key: `script:${root.id}`, depth: 0, kind: 'script', parts: [{ kind: 'text', text: 'Detached blocks (not run)' }], disabled: true });
    const n = stackLines(p, root.id, 0, lines, seen);
    if (isStart) runnable += n;
  }
  return { lines, runnableBlocks: runnable, variables: p.variables, python: storedPython?.trim() ? storedPython : generatePython(p) };
}

/** Plain-text rendering (copy to clipboard, tests). */
export const outlineText = (o: ProgramOutline): string =>
  o.lines.map((l) => `${'  '.repeat(l.depth)}${l.parts.map((x) => x.text).join(' ').replace(/\s+\?/g, '?')}${l.disabled && l.kind === 'block' ? '  (disabled)' : ''}`).join('\n');
