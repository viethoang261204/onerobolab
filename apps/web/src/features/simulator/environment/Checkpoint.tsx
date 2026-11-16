import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useRef } from 'react';
import type { Group } from 'three';
import { useSettingsStore } from '../../settings/settings-store';
import { LabelSprite } from '../render/scene/LabelSprite';
import type { Triple } from './Instanced';
import { MAT, PALETTE } from './materials';
import { GEO } from './shapes';

const COLORS = {
  cyan: { ring: MAT.cyanGlow, beam: MAT.beamCyan, hex: PALETTE.cyan },
  green: { ring: MAT.greenGlow, beam: MAT.beamGreen, hex: PALETTE.green },
} as const;

interface CheckpointProps {
  position: Triple;
  radius: number;
  color?: keyof typeof COLORS;
  label?: string;
  /** Beam height (m). */
  height?: number;
  /** Reached in the current run: turns green with a short activation pulse. */
  reached?: boolean;
}

/** Glowing floor ring + soft light beam + floating number; activates when reached. */
export const Checkpoint = memo(function Checkpoint({ position, radius, color = 'cyan', label, height = 0.32, reached = false }: CheckpointProps) {
  const c = COLORS[reached ? 'green' : color];
  const ring = useRef<Group>(null);
  const pulse = useRef(0);
  useEffect(() => {
    if (reached) pulse.current = 1;
  }, [reached]);

  useFrame((state, dt) => {
    const g = ring.current;
    if (!g) return;
    const still = useSettingsStore.getState().reduceMotion;
    if (pulse.current > 0) pulse.current = Math.max(0, pulse.current - dt * 2.2);
    const idle = still || reached ? 0 : Math.sin(state.clock.elapsedTime * 2.4) * 0.03;
    g.scale.setScalar(1 + idle + pulse.current * 0.45);
  });

  return (
    <group position={position}>
      <group ref={ring}>
        <mesh geometry={GEO.disc} material={c.beam} scale={radius * 2} position-y={0.003} />
        <mesh geometry={GEO.ring} material={c.ring} scale={radius * 2} position-y={0.004} />
      </group>
      <mesh geometry={GEO.beam} material={c.beam} scale={[radius * 1.9, reached ? height * 0.5 : height, radius * 1.9]} renderOrder={2} />
      {label && <LabelSprite text={reached ? '✓' : label} color={c.hex} y={height + 0.08} />}
    </group>
  );
});
