import { memo } from 'react';
import { RG } from './RobotGeometry';
import type { RobotMaterials } from './RobotMaterials';
import type { RobotRig } from './RobotTypes';

/** Base Z offset of each LED "eye" on the front screen (design units). */
export const EYE_Z = 0.058;
/** How far the eyes travel sideways when scanning. */
export const EYE_TRAVEL = 0.03;

/**
 * Front LED status display: two arch-shaped indicators on the dark screen.
 * Deliberately not humanoid — they read as status LEDs. Pattern, colour and
 * intensity are animated by `Robot` via `rig.display` and `mats.eyes`
 * (see `displayFrame` in RobotAnimation).
 */
export const RobotDisplay = memo(function RobotDisplay({ mats, rig }: { mats: RobotMaterials; rig: RobotRig }) {
  return (
    <group position={[0.31, 0.357, 0]}>
      <mesh ref={rig.display.leftEye} geometry={RG.eye} material={mats.eyes} position-z={-EYE_Z} />
      <mesh ref={rig.display.rightEye} geometry={RG.eye} material={mats.eyes} position-z={EYE_Z} />
    </group>
  );
});
