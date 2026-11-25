import { compileProgram, createStarterProgram, parseProgram, serializeProgram, type ProgramState } from '@robolab/blocks';
import { buildProgram, forever, fwd, ifThen, left, obstacle, repeat, right, stop, type Spec } from '@robolab/blocks/test-utils';
import { ROVER } from '@robolab/robot-engine';
import { layoutCount, objectiveToRow, playableFromStored, runHeadless, type StoredLevel, type StoredObjective } from '@robolab/simulation';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../content/levels/registry';
import type { LevelDefinition } from '../../content/levels/types';
import { playLevel } from '../levels/play';
import { SOLUTIONS, type Solution } from '../levels/reference-solutions';
import { missionSettingsOf } from './mission-settings';

/** Reference solutions for non-Starter-Island worlds (mirrors `levels.test.ts`). */
const OTHER_SOLUTIONS: Readonly<Record<string, readonly Spec[]>> = {
  'canyon-01': [repeat(2, [fwd(100), left(90), fwd(100), right(90)])],
  'canyon-02': [forever([ifThen(obstacle, [stop()]), fwd(5)])],
  'canyon-03': [fwd(380), right(90), fwd(120)],
  'frost-01': [fwd(260), left(90), fwd(300), right(90), fwd(320)],
  'jungle-01': [fwd(180), right(90), fwd(220), left(90), fwd(240)],
};

const solutionOf = (id: string): Solution | undefined => {
  const starter = SOLUTIONS[id];
  if (starter) return starter;
  const other = OTHER_SOLUTIONS[id];
  return other ? { stack: other } : undefined;
};

/** Mimic PostgreSQL jsonb round-tripping. */
const jsonbRoundTrip = <T>(value: T): unknown => JSON.parse(JSON.stringify(value)) as unknown;

/** Export a bundled level in the exact shape the database stores it. */
function exportStoredLevel(level: LevelDefinition): StoredLevel {
  const objectives: StoredObjective[] = level.mission.objectives.map((o) => {
    const row = objectiveToRow(o);
    return {
      code: o.id,
      title: o.label ?? o.id,
      type: row.type,
      config: jsonbRoundTrip(row.config) as Record<string, unknown>,
      required: row.required,
      checkpointCode: row.checkpointCode,
    };
  });

  return {
    slug: level.id,
    title: level.title,
    briefDescription: level.description,
    mapDefinition: jsonbRoundTrip(level.map),
    missionSettings: jsonbRoundTrip(missionSettingsOf(level)),
    objectives: jsonbRoundTrip(objectives) as StoredObjective[],
  };
}

function roundTripAndCompile(program: ProgramState) {
  const serialized = serializeProgram(program);
  const parsed = parseProgram(serialized);
  expect(parsed).not.toBeNull();
  const compiled = compileProgram(parsed!, ROVER);
  expect(compiled.ok, compiled.ok ? undefined : JSON.stringify(compiled.diagnostics)).toBe(true);
  if (!compiled.ok) throw new Error('Program failed to compile');
  return compiled.program;
}

describe('server headless judge parity', () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))(
    '%s: DB round-trip + runHeadless matches browser playLevel on every layout',
    { timeout: 120_000 },
    (id, level) => {
      const solution = solutionOf(id);
      expect(solution, `missing reference solution for ${id}`).toBeDefined();

      const stored = exportStoredLevel(level);
      const playable = playableFromStored(stored);
      expect(playable, `${id}: playableFromStored returned null`).not.toBeNull();

      const count = layoutCount(playable!);
      expect(count, `${id}: layout count mismatch`).toBe(layoutCount(level));

      const programState = buildProgram(solution!.stack, solution!.variables ?? [], solution!.functions ?? {});
      const compiledProgram = roundTripAndCompile(programState);

      for (let layout = 0; layout < count; layout++) {
        const serverFacts = runHeadless({
          level: playable!,
          program: compiledProgram,
          layout,
          seed: 1,
          maxSeconds: 600,
        });

        const { sim } = playLevel(level, programState, layout);
        const browserSnap = sim.snapshot();
        const browserMission = browserSnap.mission;
        const browserObjectives = (browserMission?.objectives ?? [])
          .filter((o) => o.completed)
          .map((o) => String(o.objectiveId));

        expect(serverFacts.outcome, `${id}#${layout}: server outcome`).toBe('success');
        expect(browserSnap.runState, `${id}#${layout}: browser runState`).toBe('success');
        expect(new Set(serverFacts.objectivesCompleted), `${id}#${layout}: objectivesCompleted`).toEqual(
          new Set(browserObjectives),
        );
        expect(serverFacts.collisions, `${id}#${layout}: collisions`).toBe(browserMission?.collisionCount ?? 0);
        expect(Math.abs(serverFacts.timeSeconds - browserSnap.time), `${id}#${layout}: timeSeconds`).toBeLessThanOrEqual(
          1e-9,
        );
      }
    },
  );

  it('negative: an empty program (start block only) on level 1 does not succeed', () => {
    const level1 = LEVELS[0]!;
    const playable = playableFromStored(exportStoredLevel(level1));
    expect(playable).not.toBeNull();

    const emptyProgram = roundTripAndCompile(createStarterProgram());
    const facts = runHeadless({
      level: playable!,
      program: emptyProgram,
      layout: 0,
      seed: 1,
      maxSeconds: 600,
    });

    expect(facts.outcome).not.toBe('success');
    expect(['finished', 'timeout']).toContain(facts.outcome);
  });

  it('determinism: running the same level and solution twice produces identical facts', () => {
    const level = LEVELS[0]!;
    const solution = solutionOf(level.id)!;
    const playable = playableFromStored(exportStoredLevel(level));
    expect(playable).not.toBeNull();

    const programState = buildProgram(solution.stack, solution.variables ?? [], solution.functions ?? {});
    const compiledProgram = roundTripAndCompile(programState);

    const first = runHeadless({
      level: playable!,
      program: compiledProgram,
      layout: 0,
      seed: 1,
      maxSeconds: 600,
    });
    const second = runHeadless({
      level: playable!,
      program: compiledProgram,
      layout: 0,
      seed: 1,
      maxSeconds: 600,
    });

    expect(first.outcome).toBe('success');
    expect(second).toEqual(first);
  });
});
