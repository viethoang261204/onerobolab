import { memo } from 'react';
import type { LevelDefinition } from '../../../content/levels/types';
import { GEO } from '../environment/shapes';
import { envMaterial } from '../environments/props/materials';
import { useRuntimeStore } from '../runtime/runtime-store';

/*
 * The `cargo` mission mechanic: the robot carries a supply box on its back
 * and, when the delivery succeeds, the box sits on the delivery pad. Purely
 * visual — the mission rules (stop inside the delivery zone) decide success.
 */

const hasCargo = (level: LevelDefinition) => level.briefing?.mechanics.includes('cargo') ?? false;

/** Mission status of the current run (React state, ≤ 8 Hz — not per tick). */
const useDelivered = (level: LevelDefinition) => useRuntimeStore((s) => s.mission?.missionId === level.mission.id && s.mission.status === 'success');

/** A wooden supply box with two straps; `size` in the parent's units. */
function Box({ size }: { size: number }) {
  return (
    <group>
      <mesh geometry={GEO.boxFloor} material={envMaterial('wood')} scale={size} castShadow />
      <mesh geometry={GEO.boxFloor} material={envMaterial('woodDark')} scale={[size * 1.02, size * 1.01, size * 0.18]} position-y={-0.001} />
      <mesh geometry={GEO.boxFloor} material={envMaterial('woodDark')} scale={[size * 0.18, size * 1.01, size * 1.02]} position-y={-0.001} />
    </group>
  );
}

/** Rendered inside `<Robot>` (design units): the box on the robot's back until it is delivered. */
export const CargoOnRobot = memo(function CargoOnRobot({ level }: { level: LevelDefinition }) {
  const delivered = useDelivered(level);
  if (!hasCargo(level) || delivered) return null;
  return (
    <group position={[-0.17, 0.53, 0]}>
      <Box size={0.24} />
    </group>
  );
});

/** Rendered in the world (metres): the delivered box on the pad. */
export const DeliveredCargo = memo(function DeliveredCargo({ level }: { level: LevelDefinition }) {
  const delivered = useDelivered(level);
  if (!hasCargo(level) || !delivered) return null;
  const c = level.map.finish.center;
  return (
    <group position={[c.x - 0.14, 0, c.z]}>
      <Box size={0.11} />
    </group>
  );
});
