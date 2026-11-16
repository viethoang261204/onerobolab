import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points, PointsMaterial } from 'three';
import { seededRandom } from '../../environment/geometry';
import { glowTexture } from '../../environment/textures';
import type { ParticleKind } from '../lighting';

interface Motion {
  readonly fall: number;
  readonly drift: number;
  readonly size: number;
  readonly additive: boolean;
}

const MOTION: Record<ParticleKind, Motion> = {
  pollen: { fall: -0.02, drift: 0.08, size: 0.05, additive: true },
  dust: { fall: 0.01, drift: 0.12, size: 0.045, additive: true },
  snow: { fall: 0.32, drift: 0.14, size: 0.06, additive: false },
  spores: { fall: -0.04, drift: 0.06, size: 0.05, additive: true },
  motes: { fall: -0.05, drift: 0.05, size: 0.04, additive: true },
  embers: { fall: -0.25, drift: 0.1, size: 0.05, additive: true },
};

/**
 * Lightweight ambient particles (snow, dust, pollen, spores) in a box around
 * the course: one Points draw call, positions advanced on the CPU.
 */
export const Atmosphere = memo(function Atmosphere({ kind, color, count, half, animate }: { kind: ParticleKind; color: string; count: number; half: number; animate: boolean }) {
  const m = MOTION[kind];
  const top = 3.2;
  const { geometry, seeds } = useMemo(() => {
    const rnd = seededRandom(91);
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() * 2 - 1) * half;
      pos[i * 3 + 1] = rnd() * top;
      pos[i * 3 + 2] = (rnd() * 2 - 1) * half;
      seeds[i] = rnd() * 100;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    return { geometry: g, seeds };
  }, [count, half]);
  const material = useMemo(
    () =>
      new PointsMaterial({
        color,
        size: m.size,
        map: glowTexture(),
        transparent: true,
        opacity: kind === 'snow' ? 0.95 : 0.7,
        depthWrite: false,
        ...(m.additive && { blending: AdditiveBlending }),
        sizeAttenuation: true,
      }),
    [color, kind, m],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  const ref = useRef<Points>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    if (!animate) return;
    const dt = Math.min(delta, 0.1);
    t.current += dt;
    const attr = geometry.getAttribute('position') as BufferAttribute;
    const a = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const s = seeds[i]!;
      a[i * 3]! += Math.sin(t.current * 0.6 + s) * m.drift * dt;
      a[i * 3 + 2]! += Math.cos(t.current * 0.5 + s * 1.3) * m.drift * dt;
      let y = a[i * 3 + 1]! - m.fall * dt;
      if (y < 0) y += top;
      if (y > top) y -= top;
      a[i * 3 + 1] = y;
    }
    attr.needsUpdate = true;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
});
