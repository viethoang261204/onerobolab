import { compileProgram, parseProgram } from '@robolab/blocks';
import { ROVER } from '@robolab/robot-engine';
import { playableFromStored, runHeadless, type PlayableLevel, type RunFacts, type StoredObjective } from '@robolab/simulation';
import { z } from 'zod';
import type { Queryable } from '../db/db.ts';
import { notFound } from '../http/errors.ts';
import { countRunnableBlocks, type Program } from './program.ts';
import { scoreRun, type LevelRules, type RunReport, type Scored } from './scoring.ts';

/*
 * The run judge. The browser simulates a run so the student can watch it,
 * but the verdict never rests on what the browser says: the server compiles
 * the stored program with the same compiler, plays it headless on the same
 * level, layout and seed with the same fixed-timestep runtime
 * (`@robolab/simulation`), and scores what *it* observed. The client's report
 * is kept next to the verdict only to spot tampering or drift.
 */

/** Simulated seconds a judged run may take (bounds CPU; the longest mission needs < 400 s). */
export const JUDGE_MAX_SECONDS = 600;
/** Layouts a level can have / seeds a run can use. */
export const MAX_LAYOUTS = 100;

/** Which layout and seed the browser played (stored on the attempt; the judge replays exactly that). */
export const RunSetupSchema = z
  .object({
    layout: z.number().int().min(0).max(MAX_LAYOUTS - 1).default(0),
    seed: z.number().int().min(0).max(2_147_483_647).default(1),
  })
  .strict();
export type RunSetup = z.infer<typeof RunSetupSchema>;

/** The level as the simulation plays it, from the database (same codec as the web catalog). */
export async function loadPlayableLevel(q: Queryable, levelId: string): Promise<PlayableLevel | null> {
  const { rows } = await q.query<{ slug: string; title: string; briefDescription: string | null; mapDefinition: unknown; missionSettings: unknown }>(
    `SELECT slug, title, brief_description AS "briefDescription", map_definition AS "mapDefinition", mission_settings AS "missionSettings"
       FROM levels WHERE id = $1`,
    [levelId],
  );
  const level = rows[0];
  if (!level) throw notFound('Level');
  const { rows: objectives } = await q.query<StoredObjective>(
    `SELECT o.code, o.title, o.objective_type AS type, o.config, o.required, c.code AS "checkpointCode"
       FROM level_objectives o LEFT JOIN level_checkpoints c ON c.id = o.checkpoint_id
      WHERE o.level_id = $1 AND o.deleted_at IS NULL ORDER BY o.sort_order`,
    [levelId],
  );
  return playableFromStored({ ...level, objectives });
}

/** The judge's verdict on one run. */
export type Judgement =
  | {
      readonly kind: 'judged';
      readonly facts: RunFacts;
      /** The facts as a run report (what scoring reads). */
      readonly report: RunReport;
      /** The run passed by the simulation's own account (mission success). */
      readonly completed: boolean;
      /** Where the browser's report disagrees with the judge (empty = consistent). */
      readonly mismatch: readonly string[];
    }
  /** The program or the level can't be simulated (no map, compile error): the run cannot pass. */
  | { readonly kind: 'unplayable'; readonly reason: string };

/** Seconds of simulated-time difference still counted as "the same run" (a few ticks of jitter). */
const TIME_TOLERANCE = 0.1;

/** Differences between what the browser reported and what the judge observed. */
export function compareReports(claimed: RunReport, judged: RunReport): string[] {
  const out: string[] = [];
  const a = new Set(claimed.objectivesCompleted);
  const b = new Set(judged.objectivesCompleted);
  const extra = [...a].filter((c) => !b.has(c));
  const missing = [...b].filter((c) => !a.has(c));
  if (extra.length) out.push(`claimed objectives the judge did not see: ${extra.join(', ')}`);
  if (missing.length) out.push(`objectives the judge saw but the client did not report: ${missing.join(', ')}`);
  if (claimed.collisions !== judged.collisions) out.push(`collisions ${claimed.collisions} reported, ${judged.collisions} judged`);
  if (Math.abs(claimed.timeSeconds - judged.timeSeconds) > TIME_TOLERANCE) out.push(`time ${claimed.timeSeconds.toFixed(2)} s reported, ${judged.timeSeconds.toFixed(2)} s judged`);
  return out;
}

/**
 * Replays `stored` (the program version the attempt snapshotted) on `level`
 * with `setup`, for at most `maxSeconds` of simulated time.
 */
export function judgeRun(level: PlayableLevel | null, stored: Program, setup: RunSetup, claimed: RunReport, maxSeconds = JUDGE_MAX_SECONDS): Judgement {
  if (!level) return { kind: 'unplayable', reason: 'This level has no playable map.' };
  const program = parseProgram(JSON.stringify(stored));
  if (!program) return { kind: 'unplayable', reason: 'The saved program could not be read.' };
  const compiled = compileProgram(program, ROVER);
  if (!compiled.ok) return { kind: 'unplayable', reason: compiled.diagnostics.find((d) => d.severity === 'error')?.message ?? 'The program has errors.' };

  const facts = runHeadless({ level, program: compiled.program, layout: setup.layout, seed: setup.seed, maxSeconds: Math.min(maxSeconds, JUDGE_MAX_SECONDS), robot: ROVER });
  const report: RunReport = {
    objectivesCompleted: [...facts.objectivesCompleted],
    timeSeconds: Math.round(facts.timeSeconds * 1000) / 1000,
    collisions: facts.collisions,
    ...(facts.errorMessage && { errorMessage: facts.errorMessage.slice(0, 500) }),
  };
  return { kind: 'judged', facts, report, completed: facts.outcome === 'success', mismatch: compareReports(claimed, report) };
}

/** What gets stored next to the verdict (attempt / submission `result.judge`). */
export function judgeRecord(j: Judgement, setup: RunSetup): Record<string, unknown> {
  if (j.kind === 'unplayable') return { layout: setup.layout, seed: setup.seed, unplayable: j.reason };
  return { layout: j.facts.layout, seed: setup.seed, outcome: j.facts.outcome, ticks: j.facts.ticks, failureReason: j.facts.failureReason, mismatch: j.mismatch };
}

/**
 * Judges the student's saved program before the caller's transaction (the
 * replay is CPU work and must not hold row locks). The returned function
 * gives the verdict for the program version the transaction snapshotted; if
 * that differs from what was judged (saved again in between), it replays
 * that version instead, so the verdict always matches the stored version.
 */
export async function savedProgramJudge(
  q: Queryable,
  studentId: string,
  levelId: string,
  rules: LevelRules,
  setup: RunSetup,
  claimed: RunReport,
  clientOutcome: ClientOutcome,
): Promise<(version: Program) => { verdict: Verdict; count: number; types: Set<string> }> {
  const level = await loadPlayableLevel(q, levelId);
  const { rows } = await q.query<{ blockProgram: Program }>(
    `SELECT block_program AS "blockProgram" FROM programs WHERE student_id = $1 AND level_id = $2 AND name = 'Main' AND deleted_at IS NULL`,
    [studentId, levelId],
  );
  const verdictOf = (program: Program) => {
    const { count, types } = countRunnableBlocks(program);
    return { verdict: verdictFor({ rules, level, program, setup, claimed, clientOutcome, blockCount: count, maxSeconds: JUDGE_MAX_SECONDS }), count, types };
  };
  const saved = rows[0]?.blockProgram;
  const early = saved ? verdictOf(saved) : null;
  return (version) => (early && saved && JSON.stringify(saved) === JSON.stringify(version) ? early : verdictOf(version));
}

/** How the browser says the run ended. */
export type ClientOutcome = 'COMPLETED' | 'FAILED' | 'ERROR' | 'STOPPED';

export interface VerdictInput {
  readonly rules: LevelRules;
  readonly level: PlayableLevel | null;
  /** The program version the run played. */
  readonly program: Program;
  readonly setup: RunSetup;
  /** What the browser reported. */
  readonly claimed: RunReport;
  readonly clientOutcome: ClientOutcome;
  /** Runnable blocks of `program` (server count). */
  readonly blockCount: number;
  /** Simulated-time budget for the replay. */
  readonly maxSeconds: number;
}

/** The server's verdict: the facts it scored, the score, how a non-pass is recorded, and the judge record. */
export interface Verdict {
  readonly report: RunReport;
  readonly scored: Scored;
  readonly failedStatus: 'FAILED' | 'ERROR' | 'ABORTED';
  readonly judge: Record<string, unknown>;
}

const fail = (s: Scored, reason?: string): Scored => ({ ...s, passed: false, stars: 0, score: 0, reasons: reason ? [...s.reasons, reason] : s.reasons, criteria: s.criteria.map((c) => ({ ...c, met: false })) });

/**
 * The verdict on a run. A run the student stopped is recorded as aborted and
 * never passes (nothing to replay to its end). Every other run is replayed:
 * it passes only when the server's own simulation completed the mission and
 * the level's rules are met by the facts the server observed.
 */
export function verdictFor(v: VerdictInput): Verdict {
  if (v.clientOutcome === 'STOPPED') {
    return { report: v.claimed, scored: fail(scoreRun(v.rules, v.claimed, v.blockCount)), failedStatus: 'ABORTED', judge: { layout: v.setup.layout, seed: v.setup.seed, skipped: 'stopped' } };
  }
  const j = judgeRun(v.level, v.program, v.setup, v.claimed, v.maxSeconds);
  if (j.kind === 'unplayable') {
    const report: RunReport = { objectivesCompleted: [], timeSeconds: 0, collisions: 0 };
    return { report, scored: fail(scoreRun(v.rules, report, v.blockCount), j.reason), failedStatus: 'ERROR', judge: judgeRecord(j, v.setup) };
  }
  const scored = scoreRun(v.rules, j.report, v.blockCount);
  const passed = scored.passed && j.completed;
  return {
    report: j.report,
    scored: passed ? scored : scored.passed ? fail(scored, 'The mission was not completed when the server replayed the program.') : scored,
    failedStatus: j.facts.outcome === 'error' ? 'ERROR' : 'FAILED',
    judge: judgeRecord(j, v.setup),
  };
}
