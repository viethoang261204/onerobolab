import { useEffect, useMemo } from 'react';
import { Simulator } from '../../../components/simulator/Simulator';
import { LevelRegistry } from '../../../content/levels/registry';
import { useSimulationStore } from '../../../stores/simulation-store';
import { DebugOverlay } from '../../debug/DebugOverlay';
import { currentLevel, useLevelStore } from '../../levels/level-store';
import { useLevelRoute } from '../../levels/use-level-route';
import { OnboardingTour } from '../../onboarding/OnboardingTour';
import { useOnboardingStore } from '../../onboarding/onboarding-store';
import { flushProgramSave } from '../../programming/state/program-store';
import { paths } from '../../router/routes';
import { useGlobalShortcuts } from '../../shortcuts/use-global-shortcuts';

/**
 * `/simulator/:levelId` — full-screen 3D simulator for the level's own
 * environment, running the program written in Code Studio (same program
 * store, same level session: nothing is copied or reset).
 */
export default function SimulatorPage({ levelId }: { levelId: string | null }) {
  useGlobalShortcuts();
  useLevelRoute(levelId, paths.simulator);
  const id = useLevelStore((s) => s.levelId);
  const level = useMemo(() => LevelRegistry.get(id) ?? currentLevel(), [id]);

  // Tour on the first visit (or when requested); timers survive StrictMode's double mount.
  useEffect(() => {
    const tour = setTimeout(() => useOnboardingStore.getState().onScreenReady('simulator'), 1200);
    return () => clearTimeout(tour);
  }, []);

  // Leaving the simulator: stop any run, clear result panels, save the program.
  useEffect(
    () => () => {
      if (useSimulationStore.getState().status !== 'idle') useSimulationStore.getState().reset();
      useLevelStore.setState({ result: null });
      flushProgramSave();
    },
    [],
  );

  return (
    <div className="h-full w-full overflow-hidden animate-page-in">
      <Simulator level={level} />
      <OnboardingTour />
      <DebugOverlay />
    </div>
  );
}
