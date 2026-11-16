import { z } from 'zod';
import { unprocessable } from '../http/errors.ts';

/*
 * Validation of the frontend's serialized block program
 * ({ format: "roboverse.blocks", version: 1, blocks, roots, variables }).
 * Nothing is stored unless it is a well-formed, bounded, acyclic tree of known
 * block types — no arbitrary JSON reaches the database.
 */

/** Block types the editor can produce (apps/web block-types.ts). */
export const BLOCK_TYPES = [
  'event.start', 'event.button', 'event.sensor',
  'motion.step', 'motion.forward', 'motion.backward', 'motion.turnLeft', 'motion.turnRight', 'motion.stop', 'motion.speed', 'motion.goTo',
  'action.pick', 'action.drop',
  'control.wait', 'control.repeat', 'control.forever', 'control.while', 'control.until', 'control.break', 'control.if', 'control.ifElse',
  'sensor.distance', 'sensor.line', 'sensor.color', 'sensor.obstacle', 'sensor.value', 'sensor.robotX', 'sensor.robotY',
  'logic.compare', 'logic.and', 'logic.or', 'logic.not',
  'math.add', 'math.subtract', 'math.multiply', 'math.divide', 'math.random',
  'variable.set', 'variable.change', 'variable.get', 'mission.value',
  'function.define', 'function.call',
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const LIMITS = {
  /** Serialized size of block_program. */
  maxBytes: 200_000,
  maxBlocks: 500,
  /** Nesting through slots / inputs (loops inside ifs inside loops…). */
  maxDepth: 32,
  maxRoots: 50,
  maxVariables: 50,
  maxFieldString: 200,
  maxComment: 500,
  maxPythonBytes: 64_000,
} as const;

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
/** A reserved name used as an object key anywhere in the JSON (not inside a string value). */
const RESERVED_KEY_JSON = /(?<!\\)"(?:__proto__|constructor|prototype)"\s*:/;
const Key = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]{0,31}$/, 'Invalid key.')
  .refine((k) => !RESERVED.has(k), 'Reserved key.');
const BlockIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, 'Invalid block id.')
  .refine((k) => !RESERVED.has(k), 'Reserved id.');
const FieldValue = z.union([z.number().finite().min(-1e6).max(1e6), z.string().max(LIMITS.maxFieldString), z.boolean()]);
const boundedRecord = <T extends z.ZodTypeAny>(value: T, max: number) =>
  z.record(Key, value).refine((r) => Object.keys(r).length <= max, `At most ${max} entries.`);

const BlockSchema = z
  .object({
    id: BlockIdSchema,
    type: z.enum(BLOCK_TYPES),
    fields: boundedRecord(FieldValue, 12),
    inputs: boundedRecord(BlockIdSchema.nullable(), 8),
    slots: boundedRecord(BlockIdSchema.nullable(), 4),
    next: BlockIdSchema.nullable(),
    comment: z.string().max(LIMITS.maxComment).optional(),
    disabled: z.boolean().optional(),
  })
  .strict();

export const ProgramSchema = z
  .object({
    format: z.literal('roboverse.blocks'),
    version: z.literal(1),
    blocks: z.record(BlockIdSchema, BlockSchema).refine((b) => Object.keys(b).length <= LIMITS.maxBlocks, `At most ${LIMITS.maxBlocks} blocks.`),
    roots: z
      .array(z.object({ id: BlockIdSchema, x: z.number().finite().min(-1e5).max(1e5), y: z.number().finite().min(-1e5).max(1e5) }).strict())
      .min(1)
      .max(LIMITS.maxRoots),
    variables: z.array(z.string().min(1).max(40)).max(LIMITS.maxVariables),
  })
  .strict();

export type Program = z.infer<typeof ProgramSchema>;
type Block = Program['blocks'][string];

/**
 * Full validation: shape (zod), size, references, single parent, no cycles,
 * nesting depth, a start block, and the level's allowed block types.
 * Throws 422 PROGRAM_INVALID / BLOCK_NOT_ALLOWED with details.
 */
export function validateProgram(raw: unknown, allowedBlocks: readonly string[] | null): Program {
  const json = JSON.stringify(raw ?? null);
  const size = Buffer.byteLength(json, 'utf8');
  if (size > LIMITS.maxBytes) throw unprocessable('PROGRAM_TOO_LARGE', `The program is too large (${size} bytes, max ${LIMITS.maxBytes}).`);
  // Belt and braces: the HTTP parser already refuses these; direct callers get the same guarantee.
  if (RESERVED_KEY_JSON.test(json)) throw unprocessable('PROGRAM_INVALID', 'The program uses a reserved key.');
  const parsed = ProgramSchema.safeParse(raw);
  if (!parsed.success) {
    throw unprocessable('PROGRAM_INVALID', 'The program is not a valid block program.', parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  const program = parsed.data;
  const problems: string[] = [];
  const { blocks } = program;

  for (const [key, block] of Object.entries(blocks)) if (block.id !== key) problems.push(`Block key "${key}" does not match its id.`);
  const start = blocks.start;
  if (!start || start.type !== 'event.start') problems.push('The program needs a "when program starts" block with id "start".');

  // Every reference must exist and every block has at most one parent.
  const parent = new Map<string, string>();
  const link = (from: string, to: string | null) => {
    if (to === null) return;
    if (!blocks[to]) problems.push(`Block "${from}" points to missing block "${to}".`);
    else if (parent.has(to)) problems.push(`Block "${to}" is attached in two places.`);
    else parent.set(to, from);
  };
  for (const b of Object.values(blocks)) {
    link(b.id, b.next);
    for (const child of Object.values(b.inputs)) link(b.id, child);
    for (const child of Object.values(b.slots)) link(b.id, child);
  }
  for (const r of program.roots) {
    if (!blocks[r.id]) problems.push(`Root "${r.id}" does not exist.`);
    else if (parent.has(r.id)) problems.push(`Root "${r.id}" is also attached to another block.`);
  }

  // Walk from the roots: detects cycles (a block reached twice) and depth.
  if (problems.length === 0) {
    const seen = new Set<string>();
    const stack: { id: string; depth: number }[] = program.roots.map((r) => ({ id: r.id, depth: 0 }));
    while (stack.length) {
      const { id, depth } = stack.pop()!;
      if (seen.has(id)) {
        problems.push(`Block "${id}" forms a loop.`);
        break;
      }
      seen.add(id);
      if (depth > LIMITS.maxDepth) {
        problems.push(`Blocks are nested more than ${LIMITS.maxDepth} levels deep.`);
        break;
      }
      const b = blocks[id]!;
      if (b.next) stack.push({ id: b.next, depth });
      for (const c of Object.values(b.inputs)) if (c) stack.push({ id: c, depth: depth + 1 });
      for (const c of Object.values(b.slots)) if (c) stack.push({ id: c, depth: depth + 1 });
    }
    // Blocks nobody reaches from a root would be a hidden cycle.
    if (problems.length === 0 && seen.size !== Object.keys(blocks).length) problems.push('Some blocks are detached from every script (or form a cycle).');
  }
  if (problems.length) throw unprocessable('PROGRAM_INVALID', 'The program structure is not valid.', problems.slice(0, 20));

  if (allowedBlocks) {
    const allowed = new Set(allowedBlocks);
    const used = [...new Set(Object.values(blocks).map((b) => b.type))].filter((t) => t !== 'event.start' && !allowed.has(t));
    if (used.length) throw unprocessable('BLOCK_NOT_ALLOWED', 'This level does not allow some of the blocks in the program.', { blocks: used });
  }
  return program;
}

/**
 * Blocks that run, counted exactly like the frontend compiler: enabled
 * statement blocks reachable from "when program starts" (including inside
 * loops / ifs) plus the value blocks plugged into them.
 */
export function countRunnableBlocks(program: Program): { count: number; types: Set<string> } {
  const { blocks } = program;
  const counted = new Set<string>();
  const types = new Set<string>();
  // "define …" scripts run where they are called (counted once, like the frontend compiler).
  const functions = new Map<string, Block>();
  for (const r of program.roots) {
    const b = blocks[r.id];
    if (b?.type === 'function.define' && !b.disabled && typeof b.fields.name === 'string' && !functions.has(b.fields.name)) functions.set(b.fields.name, b);
  }
  const value = (id: string | null) => {
    const b = id ? blocks[id] : undefined;
    if (!b || counted.has(b.id)) return;
    counted.add(b.id);
    types.add(b.type);
    for (const c of Object.values(b.inputs)) value(c);
  };
  const chain = (head: string | null) => {
    for (let id = head; id; id = blocks[id]?.next ?? null) {
      const b: Block | undefined = blocks[id];
      if (!b || counted.has(b.id)) return;
      if (b.disabled) continue;
      counted.add(b.id);
      types.add(b.type);
      for (const c of Object.values(b.inputs)) value(c);
      for (const s of Object.values(b.slots)) chain(s);
      const fn = b.type === 'function.call' ? functions.get(String(b.fields.name)) : undefined;
      if (fn && !counted.has(fn.id)) {
        counted.add(fn.id);
        types.add(fn.type);
        chain(fn.next);
      }
    }
  };
  chain(blocks.start?.next ?? null);
  return { count: counted.size, types };
}
