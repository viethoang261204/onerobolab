import { beforeEach, describe, expect, it } from 'vitest';
import * as M from '@robolab/blocks';
import { searchBlocks } from '@robolab/blocks';
import type { BlockId, ProgramState } from '@robolab/blocks';
import { chainIds, cloneFragment, createBlock, extractFragment, fragmentFromBlock, subtreeIds } from '@robolab/blocks';
import { checkStructure, validateProgram } from '@robolab/blocks';
import { createSampleProgram } from '@robolab/blocks';
import { parseProgram, serializeProgram } from '@robolab/blocks';
import { generatePython } from './generators/python-generator';
import { useProgramStore } from './state/program-store';

const mainChain = (p: ProgramState) => chainIds(p.blocks, M.START_ID).map((id) => p.blocks[id]?.type);
const add = (p: ProgramState, type: Parameters<typeof createBlock>[0], target: Parameters<typeof M.insertFragment>[2]) => {
  const b = createBlock(type, p.variables);
  return { p: M.insertFragment(p, fragmentFromBlock(b), target), id: b.id };
};
const expectSound = (p: ProgramState) => expect(checkStructure(p)).toEqual([]);

describe('block model', () => {
  let p: ProgramState;
  let first: BlockId;
  beforeEach(() => {
    p = createSampleProgram();
    first = p.blocks[M.START_ID]?.next ?? '';
  });

  it('1. adds a block after another (inserting between)', () => {
    const r = add(p, 'motion.stop', { kind: 'after', blockId: first });
    expect(mainChain(r.p)).toEqual(['event.start', 'motion.forward', 'motion.stop', 'motion.turnRight', 'motion.forward', 'motion.stop']);
    expectSound(r.p);
  });

  it('2. deletes a block and closes the gap', () => {
    const next = M.deleteBlock(p, first);
    expect(mainChain(next)).toEqual(['event.start', 'motion.turnRight', 'motion.forward', 'motion.stop']);
    expect(next.blocks[first]).toBeUndefined();
    expectSound(next);
  });

  it('3. moves a block (with the blocks below it) to the workspace', () => {
    const turn = p.blocks[first]?.next ?? '';
    const next = M.moveBlock(p, turn, { kind: 'workspace', x: 300, y: 100 });
    expect(mainChain(next)).toEqual(['event.start', 'motion.forward']);
    expect(next.roots[1]).toEqual({ id: turn, x: 300, y: 100 });
    expect(chainIds(next.blocks, turn)).toHaveLength(3);
    expectSound(next);
  });

  it('4. connects a loose stack under the program', () => {
    const loose = add(p, 'motion.backward', { kind: 'workspace', x: 400, y: 0 });
    const tail = chainIds(loose.p.blocks, M.START_ID).at(-1) ?? '';
    const next = M.moveBlock(loose.p, loose.id, { kind: 'after', blockId: tail });
    expect(mainChain(next).at(-1)).toBe('motion.backward');
    expect(next.roots).toHaveLength(1);
    expectSound(next);
  });

  it('5. disconnects a block from its stack', () => {
    const next = M.disconnectBlock(p, first, 50, 300);
    expect(mainChain(next)).toEqual(['event.start']);
    expect(next.roots.map((r) => r.id)).toEqual([M.START_ID, first]);
    expectSound(next);
  });

  it('6. nests blocks inside a C-block', () => {
    const rep = add(p, 'control.repeat', { kind: 'after', blockId: M.START_ID });
    const nested = M.moveBlock(rep.p, first, { kind: 'slot', blockId: rep.id, slot: 'body' });
    const body = nested.blocks[rep.id]?.slots.body ?? null;
    expect(chainIds(nested.blocks, body).map((id) => nested.blocks[id]?.type)).toEqual(['motion.forward', 'motion.turnRight', 'motion.forward', 'motion.stop']);
    expect(mainChain(nested)).toEqual(['event.start', 'control.repeat']);
    expectSound(nested);
  });

  it('7. duplicates a block with an independent nested tree', () => {
    const rep = add(p, 'control.repeat', { kind: 'after', blockId: M.START_ID });
    const nested = M.moveBlock(rep.p, first, { kind: 'slot', blockId: rep.id, slot: 'body' });
    const { program, newId } = M.duplicateBlock(nested, rep.id);
    expect(newId).not.toBe(rep.id);
    const orig = subtreeIds(program.blocks, rep.id, false);
    const copy = subtreeIds(program.blocks, newId, false);
    expect(copy.size).toBe(orig.size);
    for (const id of copy) expect(orig.has(id)).toBe(false);
    expect(program.blocks[rep.id]?.next).toBe(newId);
    expectSound(program);
  });

  it('8. deletes a C-block together with everything nested inside', () => {
    const rep = add(p, 'control.repeat', { kind: 'after', blockId: M.START_ID });
    const nested = M.moveBlock(rep.p, first, { kind: 'slot', blockId: rep.id, slot: 'body' });
    const next = M.deleteBlock(nested, rep.id);
    expect(Object.keys(next.blocks)).toEqual([M.START_ID]);
    expectSound(next);
  });

  it('9. updates a field', () => {
    const next = M.updateField(p, first, 'distance', 45);
    expect(next.blocks[first]?.fields.distance).toBe(45);
    expect(p.blocks[first]?.fields.distance).toBe(30); // immutable
  });

  it('refuses invalid connections', () => {
    const cond = add(p, 'sensor.line', { kind: 'workspace', x: 0, y: 300 });
    expect(M.checkDrop(cond.p, cond.p.blocks, cond.id, { kind: 'after', blockId: first }).ok).toBe(false);
    const num = add(cond.p, 'sensor.distance', { kind: 'workspace', x: 0, y: 360 });
    const ifb = add(num.p, 'control.if', { kind: 'after', blockId: M.START_ID });
    expect(M.checkDrop(ifb.p, ifb.p.blocks, num.id, { kind: 'input', blockId: ifb.id, input: 'condition' }).ok).toBe(false);
    expect(M.checkDrop(ifb.p, ifb.p.blocks, cond.id, { kind: 'input', blockId: ifb.id, input: 'condition' }).ok).toBe(true);
    // a block can't be dropped inside itself
    const rep = add(p, 'control.repeat', { kind: 'after', blockId: M.START_ID });
    expect(() => M.moveBlock(rep.p, rep.id, { kind: 'slot', blockId: rep.id, slot: 'body' })).toThrow(M.InvalidOperation);
  });

  it('15. the start block cannot be deleted, moved or duplicated', () => {
    expect(() => M.deleteBlock(p, M.START_ID)).toThrow(M.InvalidOperation);
    expect(() => M.moveBlock(p, M.START_ID, { kind: 'workspace', x: 0, y: 0 })).toThrow(M.InvalidOperation);
    expect(() => M.duplicateBlock(p, M.START_ID)).toThrow(M.InvalidOperation);
  });

  it('clones fragments with fresh ids', () => {
    const frag = extractFragment(p, first);
    const copy = cloneFragment(frag);
    expect(copy.rootId).not.toBe(frag.rootId);
    expect(copy.blocks[copy.rootId]?.next).toBeNull();
  });
});

describe('validation', () => {
  it('14. flags invalid fields, empty sockets, empty C-blocks and loose stacks', () => {
    let p = createSampleProgram();
    const first = p.blocks[M.START_ID]?.next ?? '';
    p = M.updateField(p, first, 'distance', '');
    const ifb = add(p, 'control.if', { kind: 'after', blockId: first });
    const speed = add(ifb.p, 'motion.speed', { kind: 'after', blockId: ifb.id });
    const loose = add(M.updateField(speed.p, speed.id, 'speed', 150), 'motion.stop', { kind: 'workspace', x: 400, y: 400 });
    const v = validateProgram(loose.p);
    expect(v.byBlock[first]?.severity).toBe('error');
    expect(v.byBlock[ifb.id]?.severity).toBe('error'); // missing condition
    expect(v.byBlock[speed.id]?.severity).toBe('warning'); // out of range
    expect(v.byBlock[loose.id]?.severity).toBe('info'); // not connected
    expect(validateProgram(createSampleProgram()).errors).toBe(0);
  });
});

describe('serialization', () => {
  it('13. round-trips and rejects broken data', () => {
    const p = createSampleProgram();
    expect(parseProgram(serializeProgram(p))).toEqual(p);
    expect(parseProgram('{"format":"roboverse.blocks","version":1,"blocks":{},"roots":[],"variables":[]}')).toBeNull();
    expect(parseProgram('not json')).toBeNull();
  });
});

describe('python generator', () => {
  it('reads the same block tree', () => {
    const py = generatePython(createSampleProgram());
    expect(py).toContain('robot.move_forward(30)');
    expect(py).toContain('robot.turn_right(90)');
    expect(py).toContain('robot.stop()');
  });
});

describe('toolbox search', () => {
  it('finds movement and sensor blocks', () => {
    const move = searchBlocks('move').flatMap((g) => g.types);
    expect(move).toEqual(expect.arrayContaining(['motion.forward', 'motion.backward', 'motion.turnLeft', 'motion.turnRight', 'motion.stop']));
    const sensor = searchBlocks('sensor').flatMap((g) => g.types);
    expect(sensor).toEqual(expect.arrayContaining(['sensor.distance', 'sensor.line', 'sensor.color', 'sensor.obstacle']));
  });
});

describe('program store (undo / redo / clipboard)', () => {
  beforeEach(() => {
    useProgramStore.setState({ program: createSampleProgram(), history: { past: [], future: [], lastKey: null, lastAt: 0 }, selectedId: null });
  });
  const s = () => useProgramStore.getState();

  it('10/11. undo and redo restore exact states', () => {
    const before = s().program;
    const first = before.blocks[M.START_ID]?.next ?? '';
    s().deleteBlock(first);
    const after = s().program;
    s().undo();
    expect(s().program).toBe(before);
    s().redo();
    expect(s().program).toBe(after);
  });

  it('coalesces typing into one undo step', () => {
    const before = s().program;
    const first = before.blocks[M.START_ID]?.next ?? '';
    s().updateField(first, 'distance', 3);
    s().updateField(first, 'distance', 35);
    s().undo();
    expect(s().program).toBe(before);
  });

  it('12. copy / paste creates new ids and keeps values', () => {
    const first = s().program.blocks[M.START_ID]?.next ?? '';
    expect(s().copy(first)).toBe(true);
    s().select(first);
    const pasted = s().paste();
    expect(pasted).toBeTruthy();
    expect(pasted).not.toBe(first);
    expect(s().program.blocks[pasted ?? '']?.fields.distance).toBe(30);
    expect(s().program.blocks[first]?.next).toBe(pasted);
    expectSound(s().program);
  });

  it('final check: realistic editing session keeps a valid tree', () => {
    // WHEN PROGRAM STARTS · REPEAT 3 { MOVE FORWARD 20 · TURN RIGHT 120 } · STOP
    useProgramStore.setState({ program: { ...createSampleProgram(), blocks: { start: createBlock('event.start', [], M.START_ID) } } });
    const rep = s().addBlock('control.repeat', { kind: 'after', blockId: M.START_ID }) ?? '';
    const fwd = s().addBlock('motion.forward', { kind: 'slot', blockId: rep, slot: 'body' }) ?? '';
    const turn = s().addBlock('motion.turnRight', { kind: 'after', blockId: fwd }) ?? '';
    s().updateField(turn, 'angle', 120);
    s().addBlock('motion.stop', { kind: 'after', blockId: rep });
    expect(validateProgram(s().program).errors).toBe(0);
    expect(generatePython(s().program)).toContain('for _ in range(3):\n    robot.move_forward(20)\n    robot.turn_right(120)\nrobot.stop()');

    const beforeDup = s().program;
    const dup = s().duplicateBlock(rep) ?? '';
    expect(mainChain(s().program)).toEqual(['event.start', 'control.repeat', 'control.repeat', 'motion.stop']);
    s().undo();
    expect(s().program).toBe(beforeDup);
    s().redo();
    expect(s().program.blocks[dup]).toBeDefined();

    s().updateField(fwd, 'distance', 30);
    expect(s().copy(fwd)).toBe(true);
    s().select(fwd);
    const pasted = s().paste() ?? '';
    expect(s().program.blocks[pasted]?.fields.distance).toBe(30);
    const withPaste = s().program;
    s().deleteBlock(pasted);
    expect(s().program.blocks[pasted]).toBeUndefined();
    s().undo();
    expect(s().program).toBe(withPaste);
    expectSound(s().program);
    expect(parseProgram(serializeProgram(s().program))).toEqual(s().program);
  });
});
