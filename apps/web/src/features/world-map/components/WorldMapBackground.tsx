import { GradientTexture } from '@react-three/drei';
import { memo, useEffect, useMemo } from 'react';
import { BackSide, BufferAttribute, BufferGeometry } from 'three';
import { seededRandom } from '../../simulator/environment/geometry';
import { PropBatch } from '../../simulator/environments/props/batch';
import { BatchMesh } from '../../simulator/environments/props/BatchMesh';

/** Dusk over the clouds: deep navy above (matches the UI), soft blue at the horizon. */
export const MAP_SKY = {
  zenith: '#07102a',
  upper: '#132a5e',
  horizon: '#46699f',
  below: '#1b3363',
  fog: '#26467e',
} as const;

const DOME = 140;

/** A few faint stars high up (one draw call). */
function Stars({ count = 160 }: { count?: number }) {
  const geometry = useMemo(() => {
    const rnd = seededRandom(77);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const y = 0.35 + rnd() * 0.65;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * DOME * 0.9, y * DOME * 0.9, Math.sin(a) * r * DOME * 0.9], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#dbe7ff" size={1.3} sizeAttenuation={false} transparent opacity={0.45} fog={false} depthWrite={false} />
    </points>
  );
}

/**
 * Sea of clouds far below the islands: gives the floating worlds a place
 * and a sense of height (instanced; fog softens the distant banks).
 */
function clouds(): PropBatch {
  const b = new PropBatch();
  const rnd = seededRandom(311);
  // Cloud banks: soft clusters far below the islands, mostly towards the edges and the distance.
  for (let k = 0; k < 34; k++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (6 + rnd() * 34);
    const z = -46 + rnd() * 54;
    const y = -9 - rnd() * 3;
    const s = 1.2 + rnd() * 1.6;
    for (let j = 0; j < 5; j++) {
      b.add('puff', 'tint', { p: [x + (rnd() - 0.5) * 3.2 * s, y + rnd() * 0.5 * s, z + (rnd() - 0.5) * 1.8 * s], s: [(1.2 + rnd() * 0.8) * s, (0.55 + rnd() * 0.3) * s, (1 + rnd() * 0.5) * s], color: rnd() < 0.5 ? '#eef3fb' : '#d9e4f5' }, false);
    }
  }
  return b;
}

export const WorldMapBackground = memo(function WorldMapBackground() {
  const scenery = useMemo(clouds, []);
  return (
    <>
      <color attach="background" args={[MAP_SKY.below]} />
      <fog attach="fog" args={[MAP_SKY.fog, 28, 70]} />
      <mesh scale={DOME} renderOrder={-2}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial side={BackSide} depthWrite={false} fog={false}>
          <GradientTexture attach="map" stops={[0, 0.3, 0.5, 0.56, 1]} colors={[MAP_SKY.zenith, MAP_SKY.upper, MAP_SKY.horizon, MAP_SKY.horizon, MAP_SKY.below]} />
        </meshBasicMaterial>
      </mesh>
      <Stars />
      <BatchMesh batch={scenery} shadows={false} />
    </>
  );
});
