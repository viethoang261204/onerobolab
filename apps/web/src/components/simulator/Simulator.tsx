import { lazy, Suspense, useRef, useState } from 'react';
import type { LevelDefinition } from '../../content/levels/types';
import { LevelResultPanel } from '../../features/levels/components/LevelResultPanel';
import { useLevelStore } from '../../features/levels/level-store';
import { useActiveLevel } from '../../features/levels/variant-store';
import { useOnboardingStore } from '../../features/onboarding/onboarding-store';
import { environmentInfo } from '../../features/simulator/environments/catalog';
import { useSimulationView } from '../../features/simulator/use-simulation-view';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useMessages } from '../../features/i18n/i18n';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { ConsoleToast } from './ConsoleToast';
import { MiniMap } from './MiniMap';
import { MissionBriefingPanel } from './MissionBriefingPanel';
import { MissionStatusBar } from './MissionStatusBar';
import { RobotPicker } from './RobotPicker';
import { SimCodePanel } from './SimCodePanel';
import { SimMissionHud } from './SimMissionHud';
import { SimToolbar } from './SimToolbar';
import { simulatorMessages } from './simulator.messages';
import { SimulationControls } from './SimulationControls';
import { Telemetry } from './Telemetry';

const SimulatorCanvas = lazy(() => import('../../features/simulator/render/SimulatorCanvas'));

/** Branded loading state while the 3D chunk and the environment build. */
function LoadingScene({ level }: { level: LevelDefinition }) {
  const m = useMessages(simulatorMessages);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#1b2d5a] via-[#233a73] to-[#0b1426]">
      <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-cyan">{m.loadingMission({ title: level.title })}</div>
      <div className="font-display text-[30px] font-black text-white">{environmentInfo(level.environmentId).name}</div>
      <div className="flex items-center gap-3 text-[13.5px] text-[#cbd5e1]">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan shadow-[0_0_10px_#22d3ee]" />
        {m.buildingEnv}
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
  const m = useMessages(simulatorMessages);
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
    <section ref={root} data-tour="simulator" aria-label={m.simulatorAria} className="relative flex h-full w-full overflow-hidden bg-[#0b1426]">
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          <ErrorBoundary title={m.loadError} onRetry={() => useLevelStore.getState().resetLevel()}>
            <Suspense fallback={<LoadingScene level={level} />}>
              {ready ? <SimulatorCanvas level={level} data={active.data} map={view.map} robot={view.robot} runtime={view.runtime} /> : <LoadingScene level={level} />}
            </Suspense>
          </ErrorBoundary>
        </div>

        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2 lg:inset-x-4 lg:top-4 lg:gap-3">
          <div className="pointer-events-auto">
            <SimMissionHud level={active} />
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

        {/* Run / Stop / Reset + mission status: top-centre on desktop, a thumb-reachable bottom bar below 1024 px. */}
        <div className="pointer-events-none absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex flex-col items-center gap-2 lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-4 lg:-translate-x-1/2">
          <div className="pointer-events-auto order-2 w-full max-w-[440px] lg:order-1 lg:w-auto lg:max-w-none">
            <SimulationControls />
          </div>
          <div className="pointer-events-auto order-1 max-w-full lg:order-2">
            <MissionStatusBar level={level} />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-10 flex items-end justify-center gap-3 lg:inset-x-4 lg:bottom-4 lg:justify-between">
          <div className="pointer-events-auto max-lg:hidden">
            <Telemetry />
          </div>
          <div className="pointer-events-auto mb-1 max-w-full">
            <ConsoleToast />
          </div>
          <div className="pointer-events-auto max-lg:hidden [@media(max-height:700px)]:hidden">
            <MiniMap map={view.map} getRobotPose={view.getRobotPose} fog={!!level.fog} />
          </div>
        </div>
      </div>

      {codeOpen && <SimCodePanel level={level} onClose={() => setCodeOpen(false)} />}

      {!tour && !result && introOpen && level.briefing && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#050b16]/45 p-3 sm:p-4">
          <MissionBriefingPanel level={level} onStartCoding={() => setCodeOpen(true)} />
        </div>
      )}
      {!tour && result && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-4">
          <LevelResultPanel onEditCode={() => setCodeOpen(true)} />
        </div>
      )}
      {robots && <RobotPicker onClose={() => setRobots(false)} />}
    </section>
  );
}
