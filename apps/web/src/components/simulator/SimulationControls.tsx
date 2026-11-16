import { LoaderCircle, Play, RotateCcw, Square } from 'lucide-react';
import { useSimulationStore } from '../../stores/simulation-store';
import { cn } from '../../utils/cn';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';

/**
 * Run / Stop / Reset robot. Actions go through the simulation store (never to
 * physics directly). "Reset" resets the robot only — the program and level
 * progress are untouched.
 */
export function SimulationControls() {
  const status = useSimulationStore((s) => s.status);
  const run = useSimulationStore((s) => s.run);
  const stop = useSimulationStore((s) => s.stop);
  const reset = useSimulationStore((s) => s.reset);
  const running = status === 'running';

  return (
    <div data-tour="run" className="glass flex items-center gap-2.5 rounded-[var(--radius-panel)] p-2" role="toolbar" aria-label="Simulation controls">
      <Tooltip label="Run your robot program" shortcut="Space">
        <Button variant="run" icon={running ? undefined : Play} iconFilled onClick={run} disabled={running} className={cn('w-[112px]', running && 'disabled:opacity-100')}>
          {running && <LoaderCircle size={17} strokeWidth={2.4} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {running ? 'Running' : 'Run'}
        </Button>
      </Tooltip>
      <Tooltip label="Stop the robot now" shortcut="Space">
        <Button variant="stop" icon={Square} iconFilled onClick={stop} disabled={!running} className="w-[104px]">
          Stop
        </Button>
      </Tooltip>
      <Tooltip label="Put the robot back at the start (your program is kept)" shortcut="R">
        <Button variant="reset" icon={RotateCcw} onClick={reset} className="w-[104px]">
          Reset
        </Button>
      </Tooltip>
    </div>
  );
}
