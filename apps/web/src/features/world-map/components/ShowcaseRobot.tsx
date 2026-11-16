import { useFrame } from '@react-three/fiber';
import { createMapEngine } from '@robolab/map-engine';
import type { MapQuery } from '@robolab/shared';
import { useMemo } from 'react';
import { LevelRegistry } from '../../../content/levels/registry';
import { DEFAULT_ROBOT_ID, getRobot } from '../../../data/content-registry';
import { useSettingsStore } from '../../settings/settings-store';
import { Robot } from '../../simulator/robot/Robot';
import type { RobotVisualSource, RobotVisualState, RobotVisualStatus } from '../../simulator/robot/RobotTypes';

let showcaseMap: MapQuery | null = null;
/** The Robot component wants a map for its (hidden) sensor visuals; any level map works. */
const getShowcaseMap = () => (showcaseMap ??= createMapEngine().load(LevelRegistry.first().map));

/** Drives the UI 3 robot in a slow loop for showcases (no simulation, no physics). */
class LoopSource implements RobotVisualSource {
  state: RobotVisualState;
  constructor(status: RobotVisualStatus) {
    this.state = {
      pose: { x: 0, z: 0, heading: 0 },
      motors: { left: 0, right: 0 },
      wheelAngle: { left: 0, right: 0 },
      linear: 0,
      angular: 0,
      status,
      sensors: {},
    };
  }
}

interface ShowcaseRobotProps {
  /** Loop radius in robot metres (0 = park and idle). */
  loopRadius?: number;
  /** Metres per second along the loop. */
  speed?: number;
  /** Uniform scale into scene units. */
  scale?: number;
  /** Parked heading (rad) when not driving. */
  heading?: number;
}

/**
 * The real UI 3 robot (same component, rig and animations as the simulator),
 * driving a gentle circle. Parks and idles with reduced motion.
 */
export function ShowcaseRobot({ loopRadius = 0.12, speed = 0.06, scale = 1.8, heading = -0.5 }: ShowcaseRobotProps) {
  const definition = useMemo(() => getRobot(DEFAULT_ROBOT_ID), []);
  const source = useMemo(() => new LoopSource('idle'), []);
  const angle = useMemo(() => ({ value: 0 }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = source.state;
    const driving = loopRadius > 0 && !useSettingsStore.getState().reduceMotion;
    if (!driving) {
      source.state = { ...s, pose: { x: 0, z: 0, heading }, linear: 0, angular: 0, status: 'idle' };
      return;
    }
    angle.value += (speed / loopRadius) * dt;
    const a = angle.value;
    const roll = (speed * dt) / definition.wheelRadius;
    const turn = (speed / loopRadius) * (definition.wheelBase / 2) * (dt / definition.wheelRadius);
    source.state = {
      ...s,
      // CCW circle; heading is the tangent (heading 0 = +X, CCW positive).
      pose: { x: Math.cos(a) * loopRadius, z: -Math.sin(a) * loopRadius, heading: a + Math.PI / 2 },
      linear: speed,
      angular: speed / loopRadius,
      wheelAngle: { left: s.wheelAngle.left + roll - turn, right: s.wheelAngle.right + roll + turn },
      status: 'running',
    };
  });

  return (
    <group scale={scale}>
      <Robot definition={definition} source={source} map={getShowcaseMap()} />
    </group>
  );
}
