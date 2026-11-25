import { useFrame } from '@react-three/fiber';
import type { MapQuery, RobotDefinition } from '@robolab/shared';
import { createRef, memo, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import type { Group, Mesh } from 'three';
import { bodyBob, displayFrame, headPitchTarget, headYawTarget } from './RobotAnimation';
import { RobotBody } from './RobotBody';
import { EYE_TRAVEL, EYE_Z } from './RobotDisplay';
import { RobotGripper } from './RobotGripper';
import { RobotHead } from './RobotHead';
import { RobotLights } from './RobotLights';
import { useSettingsStore } from '../../settings/settings-store';
import { applyPaint, highlightFrame, type RobotPaint } from '../../garage/render/part-materials';
import { useRobotMaterials } from './RobotMaterials';
import { RobotSensors } from './RobotSensors';
import { DESIGN, type RobotRig, type RobotVisualSource } from './RobotTypes';
import { RobotWheels } from './RobotWheels';

export interface RobotProps {
  definition: RobotDefinition;
  /** Where the live state comes from (demo autopilot now, engine/physics later). */
  source: RobotVisualSource;
  showSensors?: boolean;
  /** Needed for the line-sensor visualisation. */
  map: MapQuery;
  /** Receives the rig (part refs) for external control / debugging. */
  onRig?: (rig: RobotRig) => void;
  /** The student's paint job (colours, patterns, highlighted part); default look when absent. */
  paint?: RobotPaint | undefined;
  /** Attachments in design units that move with the body (accessories, decals). */
  children?: ReactNode;
}

const g = () => createRef<Group>() as RefObject<Group | null>;
const m = () => createRef<Mesh>() as RefObject<Mesh | null>;

/** Frame-rate independent exponential smoothing. */
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

/**
 * The main playable robot. Built procedurally, scaled so its wheels match the
 * physical `RobotDefinition`. All motion (pose, wheels, head, display, LEDs)
 * is applied to refs in one `useFrame` — nothing here re-renders per frame.
 *
 * Hierarchy: root(pose) → model(scale) → [ body(bob) → Body, Lights, Head ] + Wheels
 *            root → Sensors (metres)
 */
export const Robot = memo(function Robot({ definition, source, showSensors = false, map, onRig, paint, children }: RobotProps) {
  const mats = useRobotMaterials();
  // Paint: map the part colours / patterns onto the robot's own materials.
  useEffect(() => {
    if (!paint) return;
    const { colors: c, maps } = paint;
    applyPaint(mats.white, c.body, maps.body);
    applyPaint(mats.head, c.head, maps.head);
    applyPaint(mats.dark, c.trim, maps.trim);
    applyPaint(mats.darkGloss, c.trim, null);
    applyPaint(mats.blue, c.accent, maps.accent);
    applyPaint(mats.rubber, c.wheels, maps.wheels);
    for (const m of [mats.cyanAccent, mats.accentLed, mats.lens]) {
      m.color.set(c.led);
      m.emissive.set(c.led);
    }
  }, [mats, paint]);
  const rig = useMemo<RobotRig>(
    () => ({
      root: g(),
      body: g(),
      headYaw: g(),
      headPitch: g(),
      wheels: { frontLeft: g(), frontRight: g(), rearLeft: g(), rearRight: g() },
      display: { leftEye: m(), rightEye: m() },
    }),
    [],
  );
  useEffect(() => onRig?.(rig), [onRig, rig]);

  const scale = definition.wheelRadius / DESIGN.wheelRadius;
  const lastStatus = useRef(source.state.status);
  const detectUntil = useRef(0);

  useFrame((frame, delta) => {
    const s = source.state;
    const t = frame.clock.elapsedTime;
    const dt = Math.min(delta, 0.1);

    const root = rig.root.current;
    if (root) {
      root.position.set(s.pose.x, 0, s.pose.z);
      root.rotation.y = s.pose.heading;
    }
    // Reduced motion: no idle bob / head wander (status poses still apply).
    const calm = useSettingsStore.getState().reduceMotion;
    const body = rig.body.current;
    if (body) body.position.y = calm ? 0 : bodyBob(s.status, t);

    const yaw = rig.headYaw.current;
    if (yaw) yaw.rotation.y = damp(yaw.rotation.y, calm ? 0 : headYawTarget(s, t), 4, dt);
    const pitch = rig.headPitch.current;
    // Positive pitch target looks down: rotate +X toward −Y (negative about Z).
    if (pitch) pitch.rotation.z = damp(pitch.rotation.z, -headPitchTarget(s, calm ? 0 : t), 4, dt);

    // Wheels roll forward for positive angles: rotate +X-top toward +X → negative about Z.
    const { frontLeft, rearLeft, frontRight, rearRight } = rig.wheels;
    if (frontLeft.current) frontLeft.current.rotation.z = -s.wheelAngle.left;
    if (rearLeft.current) rearLeft.current.rotation.z = -s.wheelAngle.left;
    if (frontRight.current) frontRight.current.rotation.z = -s.wheelAngle.right;
    if (rearRight.current) rearRight.current.rotation.z = -s.wheelAngle.right;

    const d = displayFrame(s.status, t);
    if (lastStatus.current !== s.status) {
      lastStatus.current = s.status;
      detectUntil.current = t + 0.32;
    }
    const detecting = !calm && t < detectUntil.current;
    // The student's LED colour replaces cyan; success / error keep their meaning.
    const led = paint && s.status !== 'success' && s.status !== 'error' ? paint.colors.led : d.color;
    mats.eyes.color.set(led);
    mats.eyes.emissive.set(led);
    mats.eyes.emissiveIntensity = detecting ? 2.25 : d.eyeIntensity;
    mats.frontLed.color.set(led);
    mats.frontLed.emissive.set(led);
    mats.frontLed.emissiveIntensity = d.ledIntensity * (paint?.highlight === 'led' ? 2 : 1);
    if (paint) {
      const h = paint.highlight;
      highlightFrame([mats.white], h === 'body', t, calm);
      highlightFrame([mats.head], h === 'head', t, calm);
      highlightFrame([mats.dark, mats.darkGloss], h === 'trim', t, calm);
      highlightFrame([mats.blue], h === 'accent', t, calm);
      highlightFrame([mats.rubber], h === 'wheels', t, calm);
    }
    mats.accentLed.emissiveIntensity = 0.8 + Math.sin(t * 1.8) * 0.2;
    mats.lens.emissiveIntensity = (s.status === 'running' ? 2.6 : 1.9) + Math.sin(t * 2.6) * 0.25;
    const le = rig.display.leftEye.current;
    const re = rig.display.rightEye.current;
    if (le && re) {
      le.position.z = -EYE_Z + d.eyeShift * EYE_TRAVEL;
      re.position.z = EYE_Z + d.eyeShift * EYE_TRAVEL;
      // Idle arcs, running dots, error squint, and success crescents read by shape.
      const eyeShape = s.status === 'running' ? 0.58 : s.status === 'error' ? 0.72 : 1;
      le.scale.set(eyeShape, d.eyeScaleY, 1);
      re.scale.set(eyeShape, d.eyeScaleY, 1);
    }
  });

  return (
    <group ref={rig.root}>
      {/* Soft contact shadow so the robot never looks like it floats. */}
      <mesh position-y={0.004} rotation-x={-Math.PI / 2} scale={[0.2, 0.17, 1]} renderOrder={1}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#0b1020" transparent opacity={0.28} depthWrite={false} />
      </mesh>

      <group scale={scale}>
        <group ref={rig.body}>
          <RobotBody mats={mats} rig={rig} />
          <RobotGripper mats={mats} />
          <RobotLights mats={mats} />
          <RobotHead mats={mats} rig={rig} showFov={showSensors} />
          {children}
        </group>
        <RobotWheels mats={mats} rig={rig} />
      </group>

      {showSensors && <RobotSensors definition={definition} source={source} map={map} />}
    </group>
  );
});
