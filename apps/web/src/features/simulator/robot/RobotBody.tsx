import { memo } from 'react';
import { RobotDisplay } from './RobotDisplay';
import { RG } from './RobotGeometry';
import type { RobotMaterials } from './RobotMaterials';
import { DESIGN, type RobotRig } from './RobotTypes';

interface RobotBodyProps {
  mats: RobotMaterials;
  rig: RobotRig;
}

const SIDES = [-1, 1] as const;

/** Side panel with the geometric emblem (hexagon + diamond core) and screws. */
function SidePanel({ side, mats }: { side: -1 | 1; mats: RobotMaterials }) {
  const z = side * 0.213;
  const face = side * 0.227;
  // Emblem geometry faces +Z; flip for the left side.
  const facing = side === 1 ? 0 : Math.PI;
  return (
    <group>
      <mesh geometry={RG.sidePanel} material={mats.blue} position={[-0.005, 0.345, z]} castShadow />
      <group position={[-0.005, 0.345, face]} rotation-y={facing}>
        <mesh geometry={RG.emblemHex} material={mats.cyanAccent} rotation-z={Math.PI / 6} />
        <mesh geometry={RG.emblemCore} material={mats.cyanAccent} position-z={0.0005} />
      </group>
      {[
        [-0.08, 0.4],
        [0.07, 0.4],
        [-0.08, 0.29],
        [0.07, 0.29],
      ].map(([x = 0, y = 0], i) => (
        <mesh key={i} geometry={RG.screw} material={mats.metal} position={[x, y, face - side * 0.001]} />
      ))}
    </group>
  );
}

/**
 * Body: navy chassis, white shell, deck, fenders, blue side panels, front
 * display + bumper, rear panel, sensor modules. Static geometry; the
 * animated parts (eyes, LEDs) are driven by `Robot` through `rig`/materials.
 */
export const RobotBody = memo(function RobotBody({ mats, rig }: RobotBodyProps) {
  const { wheelX, wheelZ } = DESIGN;
  return (
    <group>
      {/* MainBody */}
      <mesh geometry={RG.chassis} material={mats.dark} position={[0, DESIGN.chassisY, 0]} castShadow receiveShadow />
      <mesh geometry={RG.shell} material={mats.white} position={[-0.01, DESIGN.shellY, 0]} castShadow receiveShadow />
      <mesh geometry={RG.deck} material={mats.darkGloss} position={[-0.035, 0.5, 0]} castShadow receiveShadow />
      {[-0.2, -0.175, -0.15].map((x) => (
        <mesh key={x} geometry={RG.deckVent} material={mats.vent} position={[x, 0.526, 0.08]} />
      ))}

      {/* Fenders over each wheel */}
      {SIDES.flatMap((s) =>
        [-1, 1].map((f) => <mesh key={`${s}${f}`} geometry={RG.fender} material={mats.darkGloss} position={[f * wheelX, DESIGN.wheelRadius, s * wheelZ]} castShadow />),
      )}

      {/* SidePanels + AccentPanels (emblem) */}
      {SIDES.map((s) => (
        <SidePanel key={s} side={s} mats={mats} />
      ))}

      {/* FrontPanel: display bezel + LED status display */}
      <mesh geometry={RG.bezel} material={mats.dark} position={[0.285, 0.37, 0]} castShadow />
      <mesh geometry={RG.screen} material={mats.screen} position={[0.302, 0.37, 0]} />
      <RobotDisplay mats={mats} rig={rig} />

      {/* Bumper with distance sensor pods (the LED bar lives in RobotLights) */}
      <mesh geometry={RG.bumper} material={mats.darkGloss} position={[0.31, 0.215, 0]} castShadow />
      {SIDES.map((s) => (
        <group key={s} position={[0.35, 0.215, s * 0.17]}>
          <mesh geometry={RG.sonarPod} material={mats.lensGlass} />
          <mesh geometry={RG.sonarRing} material={mats.cyanAccent} position-x={0.011} />
        </group>
      ))}

      {/* BottomPanel: line sensor module with three emitters */}
      <mesh geometry={RG.lineModule} material={mats.dark} position={[0.24, 0.112, 0]} />
      {[-0.04, 0, 0.04].map((z) => (
        <mesh key={z} geometry={RG.dot} material={mats.accentLed} position={[0.24, 0.1, z]} />
      ))}

      {/* Rear: panel, vents, charging connector */}
      <mesh geometry={RG.rearPanel} material={mats.dark} position={[-0.285, 0.37, 0]} castShadow />
      {[0.405, 0.385, 0.365, 0.345].map((y) => (
        <mesh key={y} geometry={RG.vent} material={mats.vent} position={[-0.302, y, -0.02]} scale={[1, 1, 0.7]} />
      ))}
      <mesh geometry={RG.port} material={mats.cyanAccent} position={[-0.302, 0.37, 0.105]} />
    </group>
  );
});
