import { useFrame } from '@react-three/fiber';
import { memo, useRef } from 'react';
import type { Mesh } from 'three';
import type { Triple } from './Instanced';
import { MAT } from './materials';
import { GEO } from './shapes';

interface EnergyStationProps {
  position: Triple;
  rotation?: number;
  scale?: number;
}

/** Robot charging station: hex pad, two pylons and a floating energy core. */
export const EnergyStation = memo(function EnergyStation({ position, rotation = 0, scale = 1 }: EnergyStationProps) {
  const core = useRef<Mesh>(null);
  useFrame((state) => {
    const m = core.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    m.rotation.y = t * 0.8;
    m.position.y = 0.34 + Math.sin(t * 1.6) * 0.015;
  });

  return (
    <group position={position} rotation-y={rotation} scale={scale}>
      <mesh geometry={GEO.hexFloor} material={MAT.metal} scale={[0.46, 0.03, 0.46]} castShadow receiveShadow />
      <mesh geometry={GEO.hexFloor} material={MAT.energy} scale={[0.3, 0.034, 0.3]} />
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, side * 0.2]}>
          <mesh geometry={GEO.boxFloor} material={MAT.white} scale={[0.05, 0.3, 0.05]} castShadow />
          <mesh geometry={GEO.boxFloor} material={MAT.cyanGlow} scale={[0.055, 0.035, 0.055]} position-y={0.24} />
          <mesh geometry={GEO.sphere} material={MAT.energy} scale={0.03} position-y={0.32} />
        </group>
      ))}
      <mesh ref={core} geometry={GEO.octa} material={MAT.energy} scale={[0.09, 0.13, 0.09]} position-y={0.34} />
    </group>
  );
});
