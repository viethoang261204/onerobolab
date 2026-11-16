import { describe, expect, test } from 'vitest';
import { AppError } from '../http/errors.ts';
import { DEFAULT_POINTS, pointsFor, scoreRun, type LevelRules } from './scoring.ts';

/** starter-01 from the seed: 1.7 m straight, par 1 block / 8 s. */
const rules: LevelRules = {
  parBlocks: 1,
  parSeconds: 8,
  maxStars: 3,
  failOnCollision: true,
  timeLimit: null,
  start: { x: -2, z: 0.4 },
  finish: { x: -0.3, z: 0.4 },
  objectives: [
    { code: 'cp-1', type: 'REACH_CHECKPOINT', required: true, config: {}, position: { x: -1.05, z: 0.4 } },
    { code: 'goal', type: 'REACH_GOAL', required: true, config: {}, position: null },
    { code: 'safe', type: 'AVOID_COLLISIONS', required: true, config: { maxCollisions: 0 }, position: null },
  ],
};
const all = ['cp-1', 'goal', 'safe'];

describe('scoreRun', () => {
  test('a clean, efficient, fast run earns every star', () => {
    const r = scoreRun(rules, { objectivesCompleted: all, timeSeconds: 4, collisions: 0 }, 1);
    expect(r).toMatchObject({ passed: true, stars: 3, score: 600 }); // default points: 500 + 100 for the checkpoint
  });

  test('stars drop for extra blocks and slow runs', () => {
    expect(scoreRun(rules, { objectivesCompleted: all, timeSeconds: 4, collisions: 0 }, 3).stars).toBe(2);
    expect(scoreRun(rules, { objectivesCompleted: all, timeSeconds: 20, collisions: 0 }, 3).stars).toBe(1);
  });

  test('missing objectives or collisions fail (claims about "safe" are ignored)', () => {
    expect(scoreRun(rules, { objectivesCompleted: ['cp-1', 'safe'], timeSeconds: 4, collisions: 0 }, 1)).toMatchObject({ passed: false, stars: 0, score: 100 }); // the checkpoint still counts
    expect(scoreRun(rules, { objectivesCompleted: all, timeSeconds: 4, collisions: 2 }, 1).passed).toBe(false);
  });

  test('impossible reports are rejected', () => {
    const err = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return (e as AppError).code;
      }
      return null;
    };
    // 1.7 m in 0.5 s would need > 3 m/s.
    expect(err(() => scoreRun(rules, { objectivesCompleted: all, timeSeconds: 0.5, collisions: 0 }, 1))).toBe('IMPLAUSIBLE_RESULT');
    expect(err(() => scoreRun(rules, { objectivesCompleted: [...all, 'bonus'], timeSeconds: 4, collisions: 0 }, 1))).toBe('IMPLAUSIBLE_RESULT');
  });

  test('time limits are enforced', () => {
    expect(scoreRun({ ...rules, timeLimit: 10 }, { objectivesCompleted: all, timeSeconds: 12, collisions: 0 }, 1).passed).toBe(false);
  });
});

describe('points (same cases as packages/scoring-engine)', () => {
  const p = { completionPoints: 500, checkpointPoints: 100, timeBonus: { parSeconds: 20, maxPoints: 200 }, efficiencyBonus: { parBlocks: 4, maxPoints: 200 }, collisionPenalty: 100 };
  test('perfect run = maximum', () => {
    expect(pointsFor(p, { passed: true, checkpoints: 1, totalCheckpoints: 1, timeSeconds: 15, blockCount: 4, collisions: 0 })).toBe(1000);
  });
  test('slow, longer program', () => {
    expect(pointsFor(p, { passed: true, checkpoints: 1, totalCheckpoints: 1, timeSeconds: 30, blockCount: 6, collisions: 0 })).toBe(820);
  });
  test('failed run keeps checkpoints, minus collisions, never below 0', () => {
    expect(pointsFor(p, { passed: false, checkpoints: 1, totalCheckpoints: 1, timeSeconds: 8, blockCount: 2, collisions: 1 })).toBe(0);
    expect(pointsFor(DEFAULT_POINTS, { passed: false, checkpoints: 2, totalCheckpoints: 3, timeSeconds: 8, blockCount: 2, collisions: 0 })).toBe(200);
  });
});
