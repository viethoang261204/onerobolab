import { Bot, Camera, CircleHelp, Code2, Crosshair, Eye, Grid2x2, LocateFixed, Maximize, Minimize, Minus, Plus, Radar, Settings, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useOnboardingStore } from '../../features/onboarding/onboarding-store';
import { SettingsPanel } from '../../features/settings/SettingsPanel';
import { useUiStore } from '../../stores/ui-store';
import type { CameraView } from '../../types/ui';
import { ControlButton } from '../common/ControlButton';

const VIEWS: readonly { view: CameraView; label: string; icon: typeof Video }[] = [
  { view: 'chase', label: 'Chase camera', icon: Video },
  { view: 'overview', label: 'Overview', icon: Eye },
  { view: 'top', label: 'Top view', icon: Grid2x2 },
];

interface SimToolbarProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenRobots: () => void;
  codeOpen?: boolean;
  onToggleCode?: () => void;
  /** Fog of war: only the chase camera (no views from above). */
  fog?: boolean;
}

/** Top-right: camera views + follow + zoom, sensors, robot, screenshot, fullscreen, help, settings. */
export function SimToolbar({ isFullscreen, onToggleFullscreen, onOpenRobots, codeOpen = false, onToggleCode, fog = false }: SimToolbarProps) {
  const view = useUiStore((s) => s.cameraView);
  const setView = useUiStore((s) => s.setCameraView);
  const follow = useUiStore((s) => s.cameraFollow);
  const setFollow = useUiStore((s) => s.setCameraFollow);
  const send = useUiStore((s) => s.sendCameraCommand);
  const showSensors = useUiStore((s) => s.showSensors);
  const toggleSensors = useUiStore((s) => s.toggleSensors);
  const startTour = useOnboardingStore((s) => s.start);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="glass relative z-30 flex items-center gap-1.5 rounded-[var(--radius-panel)] p-1.5" role="toolbar" aria-label="View tools">
        {onToggleCode && <ControlButton icon={Code2} label={codeOpen ? 'Hide code panel' : 'Code + 3D split'} active={codeOpen} onClick={onToggleCode} />}
        <ControlButton icon={Radar} label={showSensors ? 'Hide sensors' : 'Show sensors'} active={showSensors} onClick={toggleSensors} />
        <ControlButton icon={Bot} label="Choose robot" onClick={onOpenRobots} />
        <ControlButton icon={Camera} label="Screenshot" onClick={() => send('screenshot')} />
        <ControlButton icon={isFullscreen ? Minimize : Maximize} label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={onToggleFullscreen} />
        <ControlButton icon={CircleHelp} label="Simulator tour" onClick={() => startTour('simulator')} />
        <div ref={settingsRef} className="relative">
          <ControlButton icon={Settings} label="Settings" active={settingsOpen} onClick={() => setSettingsOpen((v) => !v)} />
          {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        </div>
      </div>
      <div data-tour="camera" className="glass relative z-10 flex flex-col items-center gap-1.5 rounded-[var(--radius-panel)] p-1.5" role="toolbar" aria-label="Camera" aria-orientation="vertical">
        {VIEWS.filter((v) => !fog || v.view === 'chase').map(({ view: v, label, icon }) => (
          <ControlButton key={v} icon={icon} label={label} tooltipSide="left" active={view === v} onClick={() => setView(v)} />
        ))}
        <span className="my-0.5 h-px w-6 bg-white/10" />
        <ControlButton icon={Crosshair} label={follow ? 'Stop following the robot' : 'Follow the robot'} tooltipSide="left" active={follow} onClick={() => setFollow(!follow)} />
        <ControlButton icon={Plus} label="Zoom in" tooltipSide="left" onClick={() => send('zoomIn')} />
        <ControlButton icon={Minus} label="Zoom out" tooltipSide="left" onClick={() => send('zoomOut')} />
        <ControlButton icon={LocateFixed} label="Reset camera" shortcut="F" tooltipSide="left" onClick={() => send('reset')} />
      </div>
    </div>
  );
}
