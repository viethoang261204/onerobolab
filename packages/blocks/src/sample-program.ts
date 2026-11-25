import { START_ID } from './block-model.ts';
import type { BlockInstance, ProgramState } from './block-types.ts';
import { createBlock } from './block-utils.ts';

const withFields = (b: BlockInstance, fields: Record<string, number>): BlockInstance => ({ ...b, fields: { ...b.fields, ...fields } });

/**
 * Starter program:
 *   when program starts → move forward 30 cm → turn right 90° → move forward 20 cm → stop
 */
export function createSampleProgram(): ProgramState {
  const f1 = withFields(createBlock('motion.forward'), { distance: 30 });
  const t1 = withFields(createBlock('motion.turnRight'), { angle: 90 });
  const f2 = withFields(createBlock('motion.forward'), { distance: 20 });
  const stop = createBlock('motion.stop');
  const start = { ...createBlock('event.start', [], START_ID), next: f1.id };
  const blocks = [start, { ...f1, next: t1.id }, { ...t1, next: f2.id }, { ...f2, next: stop.id }, stop];
  return {
    version: 1,
    blocks: Object.fromEntries(blocks.map((b) => [b.id, b])),
    roots: [{ id: START_ID, x: 24, y: 28 }],
    variables: ['score'],
  };
}

/** An empty program: just the start block. */
export function createStarterProgram(): ProgramState {
  return { version: 1, blocks: { [START_ID]: createBlock('event.start', [], START_ID) }, roots: [{ id: START_ID, x: 40, y: 28 }], variables: ['score'] };
}
