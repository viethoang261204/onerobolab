import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Color, type Group, MeshStandardMaterial } from 'three';
import { useSettingsStore } from '../../settings/settings-store';
import { EnergyField, Waterfall } from '../../simulator/environments/scene/Animated';
import { WATER_Y } from '../layout';
import type { AdventureLayout, AdventureView } from '../adventure.types';
import type { IslandLandmarks } from '../island/island-landmarks';

const still = () => useSettingsStore.getState().reduceMotion;

/** Energy core above the final arena: a slowly turning crystal with a halo. */
function ArenaCore({ x, y, z, lit }: { x: number; y: number; z: number; lit: boolean }) {
  const g = useRef<Group>(null);
  const mats = useMemo(() => {
    const c = lit ? '#fbbf24' : '#a78bfa';
    return {
      core: new MeshStandardMaterial({ color: c, emissive: new Color(c), emissiveIntensity: 1.6, roughness: 0.2, flatShading: true }),
      halo: new MeshStandardMaterial({ color: '#22d3ee', emissive: new Color('#22d3ee'), emissiveIntensity: 1.2, transparent: true, opacity: 0.55 }),
    };
  }, [lit]);
  useEffect(
    () => () => {
      mats.core.dispose();
      mats.halo.dispose();
    },
    [mats],
  );
  useFrame(({ clock }) => {
    if (!g.current || still()) return;
    g.current.rotation.y = clock.elapsedTime * 0.5;
    g.current.position.y = y + 2.2 + Math.sin(clock.elapsedTime * 1.2) * 0.12;
  });
  return (
    <group ref={g} position={[x, y + 2.2, z]}>
      <mesh material={mats.core} castShadow scale={[0.7, 1.5, 0.7]}>
        <octahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh material={mats.halo} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.3, 0.05, 8, 48]} />
      </mesh>
    </group>
  );
}

/** Pulsing ring + floating marker over the current mission's beacon. */
function CurrentRing({ x, y, z }: { x: number; y: number; z: number }) {
  const g = useRef<Group>(null);
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#22d3ee', emissive: new Color('#22d3ee'), emissiveIntensity: 1.8, transparent: true, opacity: 0.9, depthWrite: false }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    if (!g.current || still()) return;
    const t = (clock.elapsedTime * 0.8) % 1;
    g.current.scale.setScalar(0.8 + t * 0.9);
    mat.opacity = 0.9 * (1 - t);
  });
  return (
    <group ref={g} position={[x, y + 0.14, z]}>
      <mesh material={mat} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.62, 0.72, 40]} />
      </mesh>
    </group>
  );
}

/** Animated details: gate fields (amber closed / cyan open), the arena core, the current mission ring. */
export const LiveProps = memo(function LiveProps({ layout, view, marks }: { layout: AdventureLayout; view: AdventureView; marks: IslandLandmarks }) {
  const status = new Map(view.stops.map((s) => [s.id, s.status]));
  const current = view.current;
  const currentH = current ? ([...layout.main, ...layout.challenges].find((m) => m.def.id === current.id)?.h ?? 0) : 0;
  return (
    <>
      {marks.gates.map((g) => (
        <group key={g.stopId} position-y={g.y}>
          <EnergyField x={g.x} z={g.z} yaw={g.yaw} width={g.width - 0.1} height={1.6} color={status.get(g.stopId) === 'completed' ? '#22d3ee' : '#f59e0b'} />
        </group>
      ))}
      {marks.arena && <ArenaCore x={marks.arena.x} y={marks.arena.y} z={marks.arena.z - 1.6} lit={status.get('final') === 'completed'} />}
      {marks.waterfalls.map((w, i) => (
        <Waterfall key={i} x={w.x} y={WATER_Y} z={w.z} yaw={0} width={w.width} height={w.top - WATER_Y} />
      ))}
      {current && <CurrentRing x={current.pos.x} y={currentH} z={current.pos.y} />}
    </>
  );
});
