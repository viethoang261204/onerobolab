import { describe, it } from 'vitest';
import { LevelRegistry } from '../../content/levels/registry';
import { buildProgram } from '../programming/test-utils';
import { layouts, playLevel } from './play';
import { SOLUTIONS } from './reference-solutions';

declare const process: { env: Record<string, string | undefined>; stdout: { write: (s: string) => void } };

/** Dev probe: `PROBE=starter-04,starter-05 npx vitest run probe` prints how each reference solution plays. */
const ids = (process.env.PROBE ?? '').split(',').filter(Boolean);

describe.runIf(ids.length > 0)('probe', () => {
  for (const id of ids) {
    it(id, { timeout: 120000 }, () => {
      const level = LevelRegistry.get(id)!;
      const s = SOLUTIONS[id]!;
      for (const v of layouts(level)) {
        const { sim, blockCount } = playLevel(level, buildProgram(s.stack, s.variables ?? [], s.functions ?? {}), v);
        const snap = sim.snapshot();
        const m = snap.mission;
        process.stdout.write(
          `${id}#${v}: ${sim.state} mission=${m?.status} reason=${m?.failureReason} t=${snap.time.toFixed(1)} blocks=${blockCount} pose=(${snap.pose.x.toFixed(2)}, ${snap.pose.z.toFixed(2)}, ${((snap.pose.heading * 180) / Math.PI).toFixed(0)}°) ` +
            `objectives=${m?.objectives.map((o) => `${o.objectiveId}:${o.completed ? 'Y' : 'n'}${o.progress ? `(${o.progress.done}/${o.progress.total})` : ''}`).join(' ')} err=${snap.errorBlockId ?? ''}
`,
        );
      }
    });
  }
});
