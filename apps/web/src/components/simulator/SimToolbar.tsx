import { Bot, Camera, CircleHelp, Code2, Crosshair, Eye, Grid2x2, LocateFixed, Maximize, Minimize, Minus, Plus, Radar, Settings, Video, Wrench, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useMessages } from '../../features/i18n/i18n';
import { useOnboardingStore } from '../../features/onboarding/onboarding-store';
import { SettingsPanel } from '../../features/settings/SettingsPanel';
import { useUiStore } from '../../stores/ui-store';
import type { CameraView } from '../../types/ui';
import { cn } from '../../utils/cn';
import { ControlButton } from '../common/ControlButton';
import { simulatorMessages } from './simulator.messages';

/** Touch targets: 44 px below 1024 px and on any coarse pointer (tablets in landscape). */
const TOUCH = 'max-lg:h-11 max-lg:w-11 pointer-coarse:h-11 pointer-coarse:w-11';

interface SimToolbarProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenRobots: () => void;
  codeOpen?: boolean;
  onToggleCode?: () => void;
  /** Fog of war: only the chase camera (no views from above). */
  fog?: boolean;
}

/**
 * Top-right: camera views + follow + zoom, sensors, robot, screenshot, fullscreen, help, settings.
 * Below 1024 px the tools collapse into one 44 px button that opens them as a small grid,
 * so the 3D view (and the robot) stays uncovered.
 */
export function SimToolbar({ isFullscreen, onToggleFullscreen, onOpenRobots, codeOpen = false, onToggleCode, fog = false }: SimToolbarProps) {
  const m = useMessages(simulatorMessages);
  const views: readonly { view: CameraView; label: string; icon: typeof Video }[] = [
    { view: 'chase', label: m.viewChase, icon: Video },
    { view: 'overview', label: m.viewOverview, icon: Eye },
    { view: 'top', label: m.viewTop, icon: Grid2x2 },
  ];
  const view = useUiStore((s) => s.cameraView);
  const setView = useUiStore((s) => s.setCameraView);
  const follow = useUiStore((s) => s.cameraFollow);
  const setFollow = useUiStore((s) => s.setCameraFollow);
  const send = useUiStore((s) => s.sendCameraCommand);
  const showSensors = useUiStore((s) => s.showSensors);
  const toggleSensors = useUiStore((s) => s.toggleSensors);
  const startTour = useOnboardingStore((s) => s.start);
  const touring = useOnboardingStore((s) => s.step !== null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  // In fog the map from above would give the answer away.
  useEffect(() => {
    if (fog && view !== 'chase') setView('chase');
  }, [fog, view, setView]);
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: PointerEvent) => !settingsRef.current?.contains(e.target as Node) && setSettingsOpen(false);
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [settingsOpen]);
  const showPanels = toolsOpen || touring;

  return (
    <div className="relative flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setToolsOpen((v) => !v)}
        aria-expanded={showPanels}
        aria-label={showPanels ? m.toolsClose : m.toolsOpen}
        className="glass flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-white lg:hidden"
      >
        {showPanels ? <X size={19} /> : <Wrench size={19} />}
      </button>
      <div className={cn('flex flex-col items-end gap-2 max-lg:absolute max-lg:right-0 max-lg:top-[52px] max-lg:z-30 max-lg:w-[212px]', !showPanels && 'max-lg:hidden')}>
        <div className="glass relative z-30 grid grid-cols-4 gap-1.5 rounded-[var(--radius-panel)] p-1.5 max-lg:w-full lg:flex lg:items-center" role="toolbar" aria-label={m.viewTools}>
          {onToggleCode && <ControlButton icon={Code2} label={codeOpen ? m.hideCode : m.showCode} active={codeOpen} onClick={onToggleCode} className={TOUCH} />}
          <ControlButton icon={Radar} label={showSensors ? m.hideSensors : m.showSensors} active={showSensors} onClick={toggleSensors} className={TOUCH} />
          <ControlButton icon={Bot} label={m.chooseRobot} onClick={onOpenRobots} className={TOUCH} />
          <ControlButton icon={Camera} label={m.screenshot} onClick={() => send('screenshot')} className={TOUCH} />
          <ControlButton icon={isFullscreen ? Minimize : Maximize} label={isFullscreen ? m.exitFullscreen : m.fullscreen} onClick={onToggleFullscreen} className={TOUCH} />
          <ControlButton icon={CircleHelp} label={m.tour} onClick={() => startTour('simulator')} className={TOUCH} />
          <div ref={settingsRef} className="relative">
            <ControlButton icon={Settings} label={m.settings} active={settingsOpen} onClick={() => setSettingsOpen((v) => !v)} className={TOUCH} />
            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
          </div>
        </div>
        <div data-tour="camera" className="glass relative z-10 grid grid-cols-4 gap-1.5 rounded-[var(--radius-panel)] p-1.5 max-lg:w-full lg:flex lg:flex-col lg:items-center" role="toolbar" aria-label={m.camera} aria-orientation="vertical">
          {views.filter((v) => !fog || v.view === 'chase').map(({ view: v, label, icon }) => (
            <ControlButton key={v} icon={icon} label={label} tooltipSide="left" active={view === v} onClick={() => setView(v)} className={TOUCH} />
          ))}
          <span className="my-0.5 hidden h-px w-6 bg-white/10 lg:block" />
          <ControlButton icon={Crosshair} label={follow ? m.unfollow : m.follow} tooltipSide="left" active={follow} onClick={() => setFollow(!follow)} className={TOUCH} />
          <ControlButton icon={Plus} label={m.zoomIn} tooltipSide="left" onClick={() => send('zoomIn')} className={TOUCH} />
          <ControlButton icon={Minus} label={m.zoomOut} tooltipSide="left" onClick={() => send('zoomOut')} className={TOUCH} />
          <ControlButton icon={LocateFixed} label={m.resetCamera} shortcut="F" tooltipSide="left" onClick={() => send('reset')} className={TOUCH} />
        </div>
      </div>
    </div>
  );
}
