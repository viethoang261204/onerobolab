import { lazy, Suspense, useRef, useState } from 'react';
import type { LevelDefinition } from '../../content/levels/types';
import { LevelResultPanel } from '../../features/levels/components/LevelResultPanel';
import { useLevelStore } from '../../features/levels/level-store';
import { useActiveLevel } from '../../features/levels/variant-store';
import { useOnboardingStore } from '../../features/onboarding/onboarding-store';
import { environmentInfo } from '../../features/simulator/environments/catalog';
import { useSimulationView } from '../../features/simulator/use-simulation-view';
import { useFullscreen } from '../../hooks/useFullscreen';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { ConsoleToast } from './ConsoleToast';
import { MiniMap } from './MiniMap';
import { MissionBriefingPanel } from './MissionBriefingPanel';
import { MissionStatusBar } from './MissionStatusBar';
import { RobotPicker } from './RobotPicker';
import { SimCodePanel } from './SimCodePanel';
import { SimMissionHud } from './SimMissionHud';
import { SimToolbar } from './SimToolbar';
import { SimulationControls } from './SimulationControls';
import { Telemetry } from './Telemetry';

const SimulatorCanvas = lazy(() => import('../../features/simulator/render/SimulatorCanvas'));

/** Branded loading state while the 3D chunk and the environment build. */
function LoadingScene({ level }: { level: LevelDefinition }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#1b2d5a] via-[#233a73] to-[#0b1426]">
      <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-cyan">Mission {level.title}</div>
      <div className="font-display text-[30px] font-black text-white">{environmentInfo(level.environmentId).name}</div>
      <div className="flex items-center gap-3 text-[13.5px] text-[#cbd5e1]">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan shadow-[0_0_10px_#22d3ee]" />
        Building the environment…
      </div>
    </div>
  );
}

/**
 * The 3D-first simulator screen: the environment fills the screen; small
 * overlays sit at the edges — mission (top-left), Run/Stop/Reset
 * (top-centre), camera + tools (top-right), robot status (bottom-left),
 * minimap (bottom-right). No editor here; "Edit Program" goes to Code Studio.
 */
export function Simulator({ level }: { level: LevelDefinition }) {
  const view = useSimulationView();
  // The layout being played (levels with variants change it on every reset).
  const active = useActiveLevel(level);
  const root = useRef<HTMLElement>(null);
  const { isFullscreen, toggle } = useFullscreen(root);
  const [robots, setRobots] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const tour = useOnboardingStore((s) => s.step !== null);
  const result = useLevelStore((s) => s.result);
  const introOpen = useLevelStore((s) => s.introOpen);
  // The runtime map follows the level (ui-store map id); render only once they agree.
  const ready = view.map.definition.id === level.map.id;

  return (
    <section ref={root} data-tour="simulator" aria-label="3D simulator" className="relative flex h-full w-full overflow-hidden bg-[#0b1426]">
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          <ErrorBoundary title="The mission could not be loaded" onRetry={() => useLevelStore.getState().resetLevel()}>
            <Suspense fallback={<LoadingScene level={level} />}>
              {ready ? <SimulatorCanvas level={level} data={active.data} map={view.map} robot={view.robot} runtime={view.runtime} /> : <LoadingScene level={level} />}
            </Suspense>
          </ErrorBoundary>
        </div>

        <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
          <div className="pointer-events-auto">
            <SimMissionHud level={active} />
          </div>
          <div className="pointer-events-auto absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center gap-2">
            <SimulationControls />
            <MissionStatusBar level={level} />
          </div>
          <div className="pointer-events-auto">
            <SimToolbar
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggle}
              onOpenRobots={() => setRobots(true)}
              codeOpen={codeOpen}
              onToggleCode={() => setCodeOpen((v) => !v)}
              fog={!!level.fog}
            />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex items-end justify-between gap-3">
          <div className="pointer-events-auto max-[900px]:hidden">
            <Telemetry />
          </div>
          <div className="pointer-events-auto mb-1">
            <ConsoleToast />
          </div>
          <div className="pointer-events-auto [@media(max-height:700px)]:hidden">
            <MiniMap map={view.map} getRobotPose={view.getRobotPose} fog={!!level.fog} />
          </div>
        </div>
      </div>

      {codeOpen && <SimCodePanel level={level} onClose={() => setCodeOpen(false)} />}

      {!tour && !result && introOpen && level.briefing && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#050b16]/45 p-4">
          <MissionBriefingPanel level={level} onStartCoding={() => setCodeOpen(true)} />
        </div>
      )}
      {!tour && result && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
          <LevelResultPanel onEditCode={() => setCodeOpen(true)} />
        </div>
      )}
      {robots && <RobotPicker onClose={() => setRobots(false)} />}
    </section>
  );
}
