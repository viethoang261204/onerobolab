import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Vec2Math, type MapDefinition, type Pose2D } from '@robolab/shared';
import { type ComponentRef, useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { useUiStore } from '../../../../stores/ui-store';
import type { CameraView } from '../../../../types/ui';
import { DEFAULT_CHASE, type ChaseFraming } from '../../environments/catalog';
import { useSettingsStore } from '../../../settings/settings-store';

declare global {
  interface Window {
    __onerobolabDebug?: { setCamera: (position: [number, number, number], target: [number, number, number]) => void };
  }
}

interface CameraGoal {
  position: Vector3;
  target: Vector3;
}

/** Preset transition speed (1/s). */
const EASE_RATE = 3.2;
/** How quickly the view catches up with the robot when following (1/s). */
const FOLLOW_RATE = 3;
const SETTLE_DISTANCE = 0.004;
const ZOOM_STEP = 0.8;
const MIN_DISTANCE = 0.7;

/** Camera goal for a preset, framed on the robot (chase) or the whole course. */
export function presetFor(view: CameraView, map: MapDefinition, robot: Pose2D, chase: ChaseFraming = DEFAULT_CHASE): CameraGoal {
  const span = Math.max(map.size.x, map.size.z);
  switch (view) {
    case 'top':
      return { position: new Vector3(0, span * 1.45, 0.001), target: new Vector3(0, 0, 0) };
    case 'overview':
      return { position: new Vector3(-span * 0.35, span * 0.72, span * 0.78), target: new Vector3(0, 0, 0) };
    case 'chase': {
      // Behind and a little to the right of the robot, looking along its heading.
      const f = Vec2Math.headingToVector(robot.heading);
      const right = { x: -f.z, z: f.x };
      return {
        position: new Vector3(robot.x - f.x * chase.back + right.x * chase.side, chase.height, robot.z - f.z * chase.back + right.z * chase.side),
        target: new Vector3(robot.x + f.x * 1.3, 0.1, robot.z + f.z * 1.3),
      };
    }
  }
}

/**
 * Cinematic simulator camera: orbit / pan / zoom with damping, eased preset
 * transitions (Chase, Overview, Top), and a soft follow that glides after
 * the robot while keeping the student's chosen angle. Clamped so it never
 * dips under the ground or wanders far from the course.
 */
export function CameraRig({ map, getRobotPose, chase = DEFAULT_CHASE }: { map: MapDefinition; getRobotPose: () => Pose2D; chase?: ChaseFraming }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const view = useUiStore((s) => s.cameraView);
  const command = useUiStore((s) => s.cameraCommand);
  const goal = useRef<CameraGoal | null>(null);
  const span = Math.max(map.size.x, map.size.z);
  const limit = { x: map.size.x / 2 + 1.2, z: map.size.z / 2 + 1.2 };

  // Apply the preset when the view or map changes.
  useEffect(() => {
    goal.current = presetFor(view, map, getRobotPose(), chase);
    // getRobotPose is read at change time only.
  }, [view, map, chase]);

  useEffect(() => {
    const ctrl = controls.current;
    if (!command || !ctrl) return;
    if (command.type === 'reset') {
      goal.current = presetFor(view, map, getRobotPose(), chase);
    } else if (command.type === 'zoomIn' || command.type === 'zoomOut') {
      const target = (goal.current?.target ?? ctrl.target).clone();
      const from = goal.current?.position ?? camera.position;
      const offset = from.clone().sub(target);
      const factor = command.type === 'zoomIn' ? ZOOM_STEP : 1 / ZOOM_STEP;
      const distance = Math.min(span * 2.4, Math.max(MIN_DISTANCE, offset.length() * factor));
      goal.current = { position: target.clone().add(offset.setLength(distance)), target };
    }
  }, [command]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__onerobolabDebug = {
      setCamera: (p, t) => {
        goal.current = { position: new Vector3(...p), target: new Vector3(...t) };
      },
    };
    return () => {
      delete window.__onerobolabDebug;
    };
  }, []);

  const robotPos = useRef(new Vector3());
  const delta3 = useRef(new Vector3());
  useFrame((_, delta) => {
    const ctrl = controls.current;
    if (!ctrl) return;
    const calm = useSettingsStore.getState().reduceMotion;
    const dt = Math.min(delta, 0.1);
    const g = goal.current;
    if (g) {
      const t = calm ? 1 : 1 - Math.exp(-EASE_RATE * dt);
      camera.position.lerp(g.position, t);
      ctrl.target.lerp(g.target, t);
      if (camera.position.distanceTo(g.position) < SETTLE_DISTANCE && ctrl.target.distanceTo(g.target) < SETTLE_DISTANCE) goal.current = null;
    } else if (useUiStore.getState().cameraFollow && view !== 'top') {
      // Soft follow: shift camera + target together towards the robot.
      const p = getRobotPose();
      const f = Vec2Math.headingToVector(p.heading);
      const lead = view === 'chase' ? 0.6 : 0;
      robotPos.current.set(p.x + f.x * lead, ctrl.target.y, p.z + f.z * lead);
      const t = calm ? 1 : 1 - Math.exp(-FOLLOW_RATE * dt);
      delta3.current.copy(robotPos.current).sub(ctrl.target).multiplyScalar(view === 'overview' ? t * 0.35 : t);
      ctrl.target.add(delta3.current);
      camera.position.add(delta3.current);
    }
    // Keep the target near the course.
    ctrl.target.x = Math.max(-limit.x, Math.min(limit.x, ctrl.target.x));
    ctrl.target.z = Math.max(-limit.z, Math.min(limit.z, ctrl.target.z));
    ctrl.target.y = Math.max(0, Math.min(1.5, ctrl.target.y));
    if (camera.position.y < 0.25) camera.position.y = 0.25;
    ctrl.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={0.7}
      panSpeed={0.8}
      zoomSpeed={0.8}
      minDistance={MIN_DISTANCE}
      maxDistance={span * 2.4}
      maxPolarAngle={Math.PI / 2 - 0.18}
      // User input cancels any in-flight transition.
      onStart={() => {
        goal.current = null;
      }}
    />
  );
}
