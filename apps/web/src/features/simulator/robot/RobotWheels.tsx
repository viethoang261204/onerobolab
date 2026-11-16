import { memo, useLayoutEffect, useRef, type RefObject } from 'react';
import { type Group, type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { RG } from './RobotGeometry';
import type { RobotMaterials } from './RobotMaterials';
import { DESIGN, type RobotRig } from './RobotTypes';

const LUGS = 18;
const BOLTS = 5;

/** Places tread lugs around the tyre and bolts around the hub (one instanced mesh each). */
function useRadialInstances(ref: RefObject<InstancedMesh | null>, count: number, radius: number, z: number) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const axis = new Vector3(0, 0, 1);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      q.setFromAxisAngle(axis, a);
      mesh.setMatrixAt(i, m.compose(new Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z), q, new Vector3(1, 1, 1)));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, count, radius, z]);
}

/**
 * One wheel. Local axle = Z with the outer face toward +Z. The inner `spin`
 * group is the part that rotates (rig ref); mirrored for left-side wheels.
 */
function Wheel({ spinRef, mats, side }: { spinRef: RefObject<Group | null>; mats: RobotMaterials; side: -1 | 1 }) {
  const lugs = useRef<InstancedMesh>(null);
  const bolts = useRef<InstancedMesh>(null);
  const R = DESIGN.wheelRadius;
  const w = DESIGN.wheelWidth / 2;
  useRadialInstances(lugs, LUGS, R - 0.004, 0);
  useRadialInstances(bolts, BOLTS, R * 0.36, w + 0.004);

  return (
    <group scale={[1, 1, side]}>
      <group ref={spinRef}>
        <mesh geometry={RG.tyre} material={mats.rubber} castShadow receiveShadow />
        <instancedMesh ref={lugs} args={[RG.lug, mats.rubber, LUGS]} castShadow />
        <mesh geometry={RG.hub} material={mats.hub} />
        <mesh geometry={RG.hubRing} material={mats.cyanAccent} position-z={w - 0.004} />
        <mesh geometry={RG.hubCap} material={mats.darkGloss} position-z={w + 0.002} />
        <instancedMesh ref={bolts} args={[RG.hubBolt, mats.metal, BOLTS]} />
      </group>
    </group>
  );
}

/**
 * Wheels: FrontLeft, FrontRight, RearLeft, RearRight — each independently
 * rotatable through `rig.wheels.*` (the physics/engine can drive them later).
 */
export const RobotWheels = memo(function RobotWheels({ mats, rig }: { mats: RobotMaterials; rig: RobotRig }) {
  const { wheelX: x, wheelZ: z, wheelRadius: y } = DESIGN;
  return (
    <group>
      <group position={[x, y, -z]}>
        <Wheel spinRef={rig.wheels.frontLeft} mats={mats} side={-1} />
      </group>
      <group position={[x, y, z]}>
        <Wheel spinRef={rig.wheels.frontRight} mats={mats} side={1} />
      </group>
      <group position={[-x, y, -z]}>
        <Wheel spinRef={rig.wheels.rearLeft} mats={mats} side={-1} />
      </group>
      <group position={[-x, y, z]}>
        <Wheel spinRef={rig.wheels.rearRight} mats={mats} side={1} />
      </group>
    </group>
  );
});
