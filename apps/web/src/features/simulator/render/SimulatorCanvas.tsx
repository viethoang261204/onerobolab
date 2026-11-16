import { Canvas } from '@react-three/fiber';
import type { MapQuery, RobotDefinition } from '@robolab/shared';
import { NeutralToneMapping } from 'three';
import type { LevelDefinition } from '../../../content/levels/types';
import { useUiStore } from '../../../stores/ui-store';
import { RobotScreenTracker } from '../../onboarding/RobotScreenTracker';
import { QUALITY_DPR } from '../../settings/quality';
import { useSettingsStore } from '../../settings/settings-store';
import { Effects } from '../effects/Effects';
import { chaseFraming } from '../environments/catalog';
import { EnvironmentScene } from '../environments/EnvironmentScene';
import { PersonalRoverExtras, usePersonalRoverPaint } from '../../garage/render/PersonalRover';
import { Robot } from '../robot/Robot';
import type { RobotRuntime } from '../robot/RobotMovement';
import { CargoOnRobot, DeliveredCargo } from '../mission/Cargo';
import { CarriedCrate } from '../environments/gameplay/MissionObjects';
import { SimulationDriver } from '../SimulationDriver';
import { CameraRig } from './camera/CameraRig';
import { FrameStats } from './FrameStats';
import { ScreenshotHandler } from './ScreenshotHandler';

export interface SimulatorCanvasProps {
  /** The level (its environment is built once; the layout comes with `map`). */
  level: LevelDefinition;
  /** Mission data of the layout being played. */
  data?: Readonly<Record<string, number>> | undefined;
  map: MapQuery;
  robot: RobotDefinition;
  runtime: RobotRuntime;
}

/**
 * The 3D view: the level's own environment (EnvironmentRegistry), the robot
 * (live state pulled from `runtime` every frame), the fixed-step driver, and
 * the cinematic camera. Loaded lazily so the page shell paints first.
 */
export default function SimulatorCanvas({ level, data, map, robot, runtime }: SimulatorCanvasProps) {
  const showSensors = useUiStore((s) => s.showSensors);
  const quality = useSettingsStore((s) => s.quality);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const getPose = () => runtime.state.pose;
  // The student's robot from the garage (paint, accessories, decals).
  const paint = usePersonalRoverPaint();
  return (
    <Canvas
      dpr={QUALITY_DPR[quality]}
      // Neutral tone mapping keeps the stylised palette saturated.
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: NeutralToneMapping }}
      camera={{ fov: 40, near: 0.03, far: 200, position: [-3, 2, 3] }}
      // One soft shadow-casting sun on High/Medium; Low relies on contact shadows.
      shadows={quality === 'low' ? false : 'soft'}
    >
      <EnvironmentScene level={level} map={map} quality={quality} reduceMotion={reduceMotion} />
      <Robot definition={robot} source={runtime} map={map} showSensors={showSensors} paint={paint}>
        <PersonalRoverExtras />
        <CargoOnRobot level={level} />
        <CarriedCrate />
      </Robot>
      <DeliveredCargo level={level} />
      <Effects quality={quality} reduceMotion={reduceMotion} map={map.definition} />
      <SimulationDriver runtime={runtime} map={map} data={data} />
      <CameraRig map={map.definition} getRobotPose={getPose} chase={chaseFraming(level.environmentId)} />
      <RobotScreenTracker getPose={getPose} />
      <ScreenshotHandler />
      <FrameStats />
    </Canvas>
  );
}
