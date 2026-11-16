import { useFrame } from '@react-three/fiber';
import { createMapEngine } from '@robolab/map-engine';
import type { MapQuery } from '@robolab/shared';
import { createRef, memo, useMemo, useRef, type RefObject } from 'react';
import type { Group } from 'three';
import { LevelRegistry } from '../../../content/levels/registry';
import { DEFAULT_ROBOT_ID, getRobot } from '../../../data/content-registry';
import { useSettingsStore } from '../../settings/settings-store';
import { Robot } from '../../simulator/robot/Robot';
import { DESIGN, type RobotRig, type RobotVisualSource, type RobotVisualState } from '../../simulator/robot/RobotTypes';
import type { AnimationId, PartId, RobotConfiguration } from '../model/robot-config';
import { Accessories, Decals } from './attachments';
import { BipedModel, type ModelRig, ScoutModel, TankModel } from './models';
import { paintOf, usePartMaterials } from './part-materials';

let showcaseMap: MapQuery | null = null;
/** The simulator robot wants a map for its (hidden) sensor visuals; any level map works. */
const getShowcaseMap = () => (showcaseMap ??= createMapEngine().load(LevelRegistry.first().map));

/** Drives the rover's wheels / status for showcase animations (no physics). */
class ShowcaseSource implements RobotVisualSource {
  state: RobotVisualState = {
    pose: { x: 0, z: 0, heading: 0 },
    motors: { left: 0, right: 0 },
    wheelAngle: { left: 0, right: 0 },
    linear: 0,
    angular: 0,
    status: 'idle',
    sensors: {},
  };
}

const grp = () => createRef<Group>() as RefObject<Group | null>;

export interface RobotAvatarProps {
  config: RobotConfiguration;
  /** Part being customised (subtle pulse). */
  highlight?: PartId | null;
  /** Animation to play (defaults to the robot's own). */
  animation?: AnimationId;
  /** Parked heading (rad). */
  heading?: number;
}

/**
 * The student's robot, any model, fully painted — the one component every
 * screen uses to show it (garage, Explore map, Home). Output is in metres,
 * like the simulator robot. Animations are applied to groups in one
 * `useFrame`; nothing re-renders per frame.
 */
export const RobotAvatar = memo(function RobotAvatar({ config, highlight = null, animation, heading = 0 }: RobotAvatarProps) {
  const definition = useMemo(() => getRobot(DEFAULT_ROBOT_ID), []);
  const scale = definition.wheelRadius / DESIGN.wheelRadius;
  const paint = useMemo(() => paintOf(config, highlight), [config, highlight]);
  const mats = usePartMaterials(paint);
  const source = useMemo(() => new ShowcaseSource(), []);
  const rig = useMemo<ModelRig>(() => ({ head: grp(), armLeft: grp(), armRight: grp(), wheels: Array.from({ length: 8 }, grp) }), []);
  const root = useRef<Group>(null);
  const roverRig = useRef<RobotRig | null>(null);
  const anim = animation ?? config.animation;
  const started = useRef({ anim, t: -1 });

  useFrame(({ clock }, delta) => {
    const g = root.current;
    if (!g) return;
    const calm = useSettingsStore.getState().reduceMotion;
    if (started.current.anim !== anim || started.current.t < 0) started.current = { anim, t: clock.elapsedTime };
    const t = calm ? 0 : clock.elapsedTime - started.current.t;
    const dt = Math.min(delta, 0.1);
    const d = scale; // design units → metres

    let y = 0;
    let yaw = heading;
    let x = 0;
    let roll = 0;
    let headYaw = 0;
    let wave = 0;
    let spin = 0;
    switch (anim) {
      case 'idle':
        y = Math.sin(t * 2) * 0.006 * d;
        headYaw = Math.sin(t * 0.7) * 0.25;
        break;
      case 'wave':
        wave = Math.sin(t * 7) * 0.5;
        roll = Math.sin(t * 3.5) * 0.06;
        headYaw = 0.3;
        break;
      case 'scan':
        headYaw = Math.sin(t * 1.4) * 1.1;
        yaw += config.model === 'rover' ? Math.sin(t * 1.4) * 0.5 : 0;
        break;
      case 'celebrate':
        y = Math.abs(Math.sin(t * 5)) * 0.09 * d;
        wave = 1.2 + Math.sin(t * 10) * 0.3;
        break;
      case 'drive':
        x = Math.sin(t * 1.3) * 0.12 * d;
        spin = Math.cos(t * 1.3) * 1.3 * 0.12 * (1 / 0.16);
        break;
      case 'victory': {
        const c = t % 3;
        yaw += c < 1.2 ? (c / 1.2) * Math.PI * 2 : 0;
        y = c < 1.2 ? Math.sin((c / 1.2) * Math.PI) * 0.1 * d : 0;
        wave = c >= 1.2 ? 1.4 : 0;
        break;
      }
    }
    g.position.set(Math.cos(heading) * x, y, -Math.sin(heading) * x);
    g.rotation.set(roll, yaw, 0);

    if (rig.head.current) rig.head.current.rotation.y = headYaw;
    if (rig.armRight.current) rig.armRight.current.rotation.x = -wave * 2.2 - (wave ? 0.3 : 0);
    if (rig.armLeft.current) rig.armLeft.current.rotation.x = anim === 'celebrate' || anim === 'victory' ? wave * 2.2 : 0;
    for (const w of rig.wheels) if (w.current) w.current.rotation.z -= spin * dt;

    // Rover: bigger all-terrain wheels through its rig; wheels and status through its visual source.
    const wr = roverRig.current?.wheels;
    if (wr) {
      const k = config.wheelStyle === 'all-terrain' ? 1.14 : 1;
      for (const w of [wr.frontLeft, wr.frontRight, wr.rearLeft, wr.rearRight]) w.current?.scale.setScalar(k);
    }
    const s = source.state;
    const roll2 = spin * dt;
    source.state = {
      ...s,
      wheelAngle: { left: s.wheelAngle.left + roll2, right: s.wheelAngle.right + roll2 },
      linear: spin ? 0.1 : 0,
      status: anim === 'celebrate' || anim === 'victory' ? 'success' : anim === 'drive' || anim === 'scan' ? 'running' : 'idle',
    };
  });

  const attachments = (
    <>
      <Accessories model={config.model} ids={config.accessories} mats={mats} />
      <Decals model={config.model} decals={config.decals} />
    </>
  );

  return (
    <group ref={root} rotation-y={heading}>
      {config.model === 'rover' ? (
        <Robot definition={definition} source={source} map={getShowcaseMap()} paint={paint} onRig={(r) => {
          roverRig.current = r;
        }}>
          {attachments}
        </Robot>
      ) : (
        <>
          <mesh position-y={0.004} rotation-x={-Math.PI / 2} scale={[0.2, 0.17, 1]} renderOrder={1}>
            <circleGeometry args={[1, 32]} />
            <meshBasicMaterial color="#0b1020" transparent opacity={0.28} depthWrite={false} />
          </mesh>
          <group scale={scale}>
            {config.model === 'scout' && <ScoutModel mats={mats} rig={rig} wheelStyle={config.wheelStyle} />}
            {config.model === 'tank' && <TankModel mats={mats} rig={rig} wheelStyle={config.wheelStyle} />}
            {config.model === 'biped' && <BipedModel mats={mats} rig={rig} wheelStyle={config.wheelStyle} />}
            {attachments}
          </group>
        </>
      )}
    </group>
  );
});
