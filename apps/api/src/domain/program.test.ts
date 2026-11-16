import { describe, expect, test } from 'vitest';
import { AppError } from '../http/errors.ts';
import { straightProgram } from '../test/harness.ts';
import { countRunnableBlocks, LIMITS, validateProgram } from './program.ts';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : String(e);
  }
  return 'OK';
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('validateProgram', () => {
  test('accepts a well-formed program and counts runnable blocks like the compiler', () => {
    const p = validateProgram(straightProgram(170, [{ type: 'motion.turnLeft', fields: { angle: 90 } }]), null);
    expect(countRunnableBlocks(p).count).toBe(2);
  });

  test('rejects non-programs and unknown fields / block types', () => {
    expect(code(() => validateProgram(null, null))).toBe('PROGRAM_INVALID');
    expect(code(() => validateProgram({ ...straightProgram(1), extra: 1 }, null))).toBe('PROGRAM_INVALID');
    const p = clone(straightProgram(1)) as { blocks: Record<string, { type: string }> };
    p.blocks.b1!.type = 'system.exec';
    expect(code(() => validateProgram(p, null))).toBe('PROGRAM_INVALID');
  });

  test('rejects prototype-pollution keys', () => {
    const raw = JSON.parse(
      '{"format":"roboverse.blocks","version":1,"roots":[{"id":"start","x":0,"y":0}],"variables":[],"blocks":{"start":{"id":"start","type":"event.start","fields":{"__proto__":1},"inputs":{},"slots":{},"next":null}}}',
    );
    expect(code(() => validateProgram(raw, null))).toBe('PROGRAM_INVALID');
  });

  test('rejects dangling references, double parents and cycles', () => {
    const dangling = clone(straightProgram(1)) as { blocks: Record<string, { next: string | null }> };
    dangling.blocks.b1!.next = 'ghost';
    expect(code(() => validateProgram(dangling, null))).toBe('PROGRAM_INVALID');

    const cycle = clone(straightProgram(1)) as { blocks: Record<string, { next: string | null }> };
    cycle.blocks.b1!.next = 'b1';
    expect(code(() => validateProgram(cycle, null))).toBe('PROGRAM_INVALID');

    // Two blocks pointing at each other, detached from any root.
    const island = clone(straightProgram(1)) as { blocks: Record<string, unknown> };
    island.blocks.y1 = { id: 'y1', type: 'motion.stop', fields: {}, inputs: {}, slots: {}, next: 'y2' };
    island.blocks.y2 = { id: 'y2', type: 'motion.stop', fields: {}, inputs: {}, slots: {}, next: 'y1' };
    expect(code(() => validateProgram(island, null))).toBe('PROGRAM_INVALID');
  });

  test('limits nesting depth, block count, string length and total size', () => {
    const deep = clone(straightProgram(1)) as { blocks: Record<string, unknown> };
    let parent = 'b1';
    for (let i = 0; i < LIMITS.maxDepth + 2; i++) {
      const id = `r${i}`;
      deep.blocks[id] = { id, type: 'control.repeat', fields: { times: 2 }, inputs: {}, slots: { body: null }, next: null };
      const p = deep.blocks[parent] as { next: string | null; slots: Record<string, string | null> };
      if (parent === 'b1') p.next = id;
      else p.slots.body = id;
      parent = id;
    }
    expect(code(() => validateProgram(deep, null))).toBe('PROGRAM_INVALID');

    const many = Array.from({ length: LIMITS.maxBlocks + 1 }, () => ({ type: 'motion.stop' }));
    expect(code(() => validateProgram(straightProgram(1, many), null))).toMatch(/PROGRAM_(INVALID|TOO_LARGE)/);

    const longString = straightProgram(1, [{ type: 'motion.stop', comment: 'x'.repeat(LIMITS.maxComment + 1) }]);
    expect(code(() => validateProgram(longString, null))).toBe('PROGRAM_INVALID');

    const huge = { ...straightProgram(1), padding: 'x'.repeat(LIMITS.maxBytes) };
    expect(code(() => validateProgram(huge, null))).toBe('PROGRAM_TOO_LARGE');
  });

  test("enforces the level's allowed blocks", () => {
    const p = straightProgram(1, [{ type: 'control.repeat', fields: { times: 2 }, slots: { body: null } }]);
    expect(code(() => validateProgram(p, ['event.start', 'motion.forward']))).toBe('BLOCK_NOT_ALLOWED');
    expect(code(() => validateProgram(p, ['motion.forward', 'control.repeat']))).toBe('OK');
  });

  test('disabled and detached blocks do not count', () => {
    const p = validateProgram(straightProgram(1, [{ type: 'motion.stop', disabled: true }, { type: 'motion.stop' }]), null);
    expect(countRunnableBlocks(p).count).toBe(2);
  });
});
