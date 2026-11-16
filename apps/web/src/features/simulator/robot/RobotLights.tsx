import { memo } from 'react';
import { RG } from './RobotGeometry';
import type { RobotMaterials } from './RobotMaterials';

/**
 * Lights: FrontLED (bumper bar), StatusLED (deck), SideLED strips, rear LED.
 * Pure emissive meshes — no real light sources, so they cost nothing in
 * lighting. Brightness is animated through the shared LED materials.
 */
export const RobotLights = memo(function RobotLights({ mats }: { mats: RobotMaterials }) {
  return (
    <group>
      {/* FrontLED */}
      <mesh geometry={RG.ledBar} material={mats.frontLed} position={[0.348, 0.215, 0]} />
      {/* StatusLED + deck accent strip */}
      <mesh geometry={RG.dot} material={mats.purple} position={[0.11, 0.527, 0.13]} scale={1.3} />
      <mesh geometry={RG.ledBar} material={mats.accentLed} position={[0.168, 0.505, 0]} scale={[1, 0.6, 1.25]} />
      {/* SideLED strips under the shell line */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={RG.sideLed} material={mats.accentLed} position={[0, 0.255, s * 0.211]} />
      ))}
      {/* Rear LED */}
      <mesh geometry={RG.ledBar} material={mats.accentLed} position={[-0.335, 0.215, 0]} scale={[1, 0.8, 0.9]} />
    </group>
  );
});
