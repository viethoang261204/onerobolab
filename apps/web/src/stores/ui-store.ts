import type { MapId } from '@robolab/shared';
import { create } from 'zustand';
import { DEFAULT_MAP_ID } from '../data/content-registry';
import { ROBOT_OPTIONS } from '../data/robots';
import type { CameraView, CodeTab, OutputTab } from '../types/ui';

export type CameraCommandType = 'reset' | 'zoomIn' | 'zoomOut' | 'screenshot';

/** One-shot request to the camera rig. `seq` makes repeated commands distinct. */
export interface CameraCommand {
  readonly type: CameraCommandType;
  readonly seq: number;
}

/**
 * UI state only. Per-tick simulation data (poses, sensors) never lives here —
 * the renderer pulls it every frame.
 */
interface UiState {
  /** Block toolbox shown as an icon rail. */
  toolboxCollapsed: boolean;
  codeTab: CodeTab;
  outputTab: OutputTab;
  mapId: MapId;
  selectedRobotId: string;
  cameraView: CameraView;
  /** Camera glides after the robot (keeps your orbit angle). */
  cameraFollow: boolean;
  cameraCommand: CameraCommand | null;
  missionCollapsed: boolean;
  /** Sensor visualisation (distance cone, line rays, camera FOV). */
  showSensors: boolean;
  /** Sampled twice per second, not per frame. */
  fps: number;

  setToolboxCollapsed: (collapsed: boolean) => void;
  setCodeTab: (tab: CodeTab) => void;
  setOutputTab: (tab: OutputTab) => void;
  selectRobot: (id: string) => void;
  setMapId: (id: MapId) => void;
  setCameraView: (view: CameraView) => void;
  setCameraFollow: (follow: boolean) => void;
  sendCameraCommand: (type: CameraCommandType) => void;
  toggleMission: () => void;
  toggleSensors: () => void;
  setFps: (fps: number) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  toolboxCollapsed: typeof window !== 'undefined' && window.innerWidth < 1360,
  codeTab: 'blocks',
  outputTab: 'console',
  mapId: DEFAULT_MAP_ID,
  selectedRobotId: ROBOT_OPTIONS[0]?.id ?? 'rover',
  cameraView: 'chase',
  cameraFollow: true,
  cameraCommand: null,
  missionCollapsed: false,
  showSensors: true,
  fps: 0,

  setToolboxCollapsed: (toolboxCollapsed) => set({ toolboxCollapsed }),
  setCodeTab: (codeTab) => set({ codeTab }),
  setOutputTab: (outputTab) => set({ outputTab }),
  selectRobot: (selectedRobotId) => set({ selectedRobotId }),
  setMapId: (mapId) => set({ mapId }),
  // Re-selecting the same view re-applies it (acts as "snap back").
  setCameraView: (cameraView) =>
    set((s) => ({ cameraView, cameraCommand: { type: 'reset', seq: (s.cameraCommand?.seq ?? 0) + 1 } })),
  setCameraFollow: (cameraFollow) => set({ cameraFollow }),
  sendCameraCommand: (type) => set((s) => ({ cameraCommand: { type, seq: (s.cameraCommand?.seq ?? 0) + 1 } })),
  toggleMission: () => set((s) => ({ missionCollapsed: !s.missionCollapsed })),
  toggleSensors: () => set((s) => ({ showSensors: !s.showSensors })),
  setFps: (fps) => set({ fps }),
}));
