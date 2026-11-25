import { describe, expect, it } from 'vitest';
import type { MissionState, ScoringRules } from '@robolab/shared';
import { efficiencyBonus, maxScore, rankOf, scoreRun, timeBonus } from './index.ts';

const rules: ScoringRules = {
  completionPoints: 500,
  checkpointPoints: 100,
  timeBonus: { parSeconds: 20, maxPoints: 200 },
  efficiencyBonus: { parBlocks: 4, maxPoints: 200 },
  collisionPenalty: 100,
};

const mission = (status: MissionState['status'], visited: number): MissionState => ({
  missionId: 'm' as MissionState['missionId'],
  status,
  elapsed: 0,
  objectives: [
    { objectiveId: 'cp-1', completed: visited > 0, completedAt: null },
    { objectiveId: 'goal', completed: status === 'success', completedAt: null },
  ],
  visitedCheckpoints: Array.from({ length: visited }, (_, i) => `cp-${i + 1}` as MissionState['visitedCheckpoints'][number]),
  collisionCount: 0,
  failureReason: null,
});

describe('scoring engine', () => {
  it('bonuses fall off linearly past par', () => {
    expect(timeBonus(rules, 12)).toBe(200);
    expect(timeBonus(rules, 30)).toBe(100);
    expect(timeBonus(rules, 45)).toBe(0);
    expect(efficiencyBonus(rules, 4)).toBe(200);
    expect(efficiencyBonus(rules, 6)).toBe(120);
    expect(efficiencyBonus(rules, 20)).toBe(0);
  });

  it('a perfect run scores the maximum, three stars and Platinum', () => {
    const s = scoreRun({ rules, mission: mission('success', 1), stats: { elapsed: 15, collisions: 0, blockCount: 4, distanceTravelled: 3 } });
    expect(s.total).toBe(maxScore(rules, 1));
    expect(s.total).toBe(1000);
    expect(s.stars).toBe(3);
    expect(rankOf(s.total, s.max, true)).toBe('platinum');
  });

  it('a slow, long program still passes with fewer points', () => {
    const s = scoreRun({ rules, mission: mission('success', 1), stats: { elapsed: 30, collisions: 0, blockCount: 6, distanceTravelled: 3 } });
    expect(s.total).toBe(500 + 100 + 100 + 120);
    expect(s.stars).toBe(2);
    expect(rankOf(s.total, s.max, true)).toBe('gold');
  });

  it('failures keep checkpoint points only, never a rank', () => {
    const s = scoreRun({ rules, mission: mission('failure', 1), stats: { elapsed: 8, collisions: 1, blockCount: 2, distanceTravelled: 1 } });
    expect(s.total).toBe(0); // 100 for the checkpoint − 100 for the collision
    expect(s.stars).toBe(0);
    expect(rankOf(s.total, s.max, false)).toBe('none');
  });
});
