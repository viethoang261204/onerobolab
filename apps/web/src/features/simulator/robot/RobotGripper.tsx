import { useFrame } from '@react-three/fiber';
import { memo, useRef } from 'react';
import type { Group } from 'three';
import { getWorldView } from '../runtime/world-view';
import type { RobotMaterials } from './RobotMaterials';

const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

/**
 * Front articulated cargo gripper (design units). Opens wide when empty and
 * clamps/lifts smoothly around the carried crate whenever `world-view` reports
 * a carried item — zero React re-renders per frame.
 */
export const RobotGripper = memo(function RobotGripper({ mats }: { mats: RobotMaterials }) {
  const arm = useRef<Group>(null);
  const leftJaw = useRef<Group>(null);
  const rightJaw = useRef<Group>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const holding = !!getWorldView()?.carried();
    if (arm.current) arm.current.position.y = damp(arm.current.position.y, holding ? 0.185 : 0.145, 10, dt);
    const zTarget = holding ? 0.088 : 0.125;
    if (leftJaw.current) leftJaw.current.position.z = damp(leftJaw.current.position.z, -zTarget, 12, dt);
    if (rightJaw.current) rightJaw.current.position.z = damp(rightJaw.current.position.z, zTarget, 12, dt);
  });

  return (
    <group ref={arm} position={[0.315, 0.145, 0]}>
      {/* Crossbar & actuator rail */}
      <mesh material={mats.darkGloss} position={[0.02, 0, 0]} castShadow>
        <boxGeometry args={[0.04, 0.032, 0.28]} />
      </mesh>
      <mesh material={mats.metal} position={[0.042, 0, 0]}>
        <boxGeometry args={[0.012, 0.014, 0.25]} />
      </mesh>

      {/* Left pincer jaw */}
      <group ref={leftJaw} position={[0.04, 0, -0.125]}>
        <mesh material={mats.blue} position={[0.055, 0, 0]} castShadow>
          <boxGeometry args={[0.11, 0.036, 0.024]} />
        </mesh>
        <mesh material={mats.cyanAccent} position={[0.105, 0, 0.014]}>
          <boxGeometry args={[0.03, 0.034, 0.018]} />
        </mesh>
      </group>

      {/* Right pincer jaw */}
      <group ref={rightJaw} position={[0.04, 0, 0.125]}>
        <mesh material={mats.blue} position={[0.055, 0, 0]} castShadow>
          <boxGeometry args={[0.11, 0.036, 0.024]} />
        </mesh>
        <mesh material={mats.cyanAccent} position={[0.105, 0, -0.014]}>
          <boxGeometry args={[0.03, 0.034, 0.018]} />
        </mesh>
      </group>
    </group>
  );
});
