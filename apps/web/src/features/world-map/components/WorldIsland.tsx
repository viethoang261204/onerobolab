import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Group, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { WorldDefinition, WorldTheme } from '../../../content/worlds/types';
import { useSettingsStore } from '../../settings/settings-store';
import { ribbonGeometry, rockGeometry } from '../../simulator/environment/geometry';
import { GEO } from '../../simulator/environment/shapes';
import { envMaterial } from '../../simulator/environments/props/materials';
import { Waterfall } from '../../simulator/environments/scene/Animated';
import { fbm, type ColorFn, type HeightFn } from '../../simulator/environments/terrain/fields';
import { createWaterMaterial } from '../../simulator/environments/terrain/Water';
import { ISLAND_RADIUS } from '../scene/island-decor';
import { BakedDiorama } from '../scene/BakedDiorama';
import { islandDiorama } from '../scene/island-diorama';
import { ISLAND_CHANNELS, islandColor, islandGround, islandHeight, islandSeed } from '../scene/island-terrain';
import type { Placement } from '../scene/journey-layout';
import { islandBob } from '../scene/screen-anchors';
import { themeKit } from '../scene/theme-materials';

export interface WorldIslandProps {
  world: WorldDefinition;
  /** Desaturated, no glow (locked / coming soon). */
  locked: boolean;
  selected?: boolean;
  hovered?: boolean;
  /** Island is interactive (world map); off for the hero showcase. */
  interactive?: boolean;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** Show the centre pad the robot stands on (off for artwork). */
  pad?: boolean;
  /** Where the island sits and how large (Explore journey); defaults to the world's `mapPosition`. */
  placement?: Placement;
  /** Placed on the island top (local y = 0), e.g. the robot. */
  children?: ReactNode;
}

const RINGS = 16;
const SEGS = 44;
const SKIRT = 0.34;
/** Pointer travel (px) above which a press counts as a drag, not a click. */
const CLICK_SLOP = 6;

/**
 * Terrain top (polar grid, wavy outline, height + colour fields) with a cliff
 * skirt around the rim — one mesh, vertex coloured, flat shaded.
 */
function buildTop(height: HeightFn, color: ColorFn, seed: number): BufferGeometry {
  const outline = (a: number) => 1 + 0.07 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 2) + 0.03 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, seed);
  const rows = RINGS + 2; // rings + rim + skirt bottom
  const verts = 1 + rows * SEGS;
  const pos = new Float32Array(verts * 3);
  const col = new Float32Array(verts * 3);
  const c = new Color();
  const set = (i: number, x: number, y: number, z: number, rgb: readonly [number, number, number]) => {
    pos.set([x, y, z], i * 3);
    c.setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);
    col.set([c.r, c.g, c.b], i * 3);
  };
  const e = 0.04;
  const sample = (x: number, z: number) => {
    const h = height(x, z);
    const slope = Math.min(1, Math.hypot(height(x + e, z) - height(x - e, z), height(x, z + e) - height(x, z - e)) / (2 * e));
    return { h, rgb: color(x, z, h, slope) };
  };
  const c0 = sample(0, 0);
  set(0, 0, c0.h, 0, c0.rgb);
  for (let ring = 1; ring <= rows; ring++) {
    for (let s = 0; s < SEGS; s++) {
      const a = (s / SEGS) * Math.PI * 2;
      const k = outline(a);
      const i = 1 + (ring - 1) * SEGS + s;
      if (ring <= RINGS) {
        const r = (ring / RINGS) * ISLAND_RADIUS * k;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const { h, rgb } = sample(x, z);
        set(i, x, h, z, rgb);
      } else {
        // Rim edge, then the bottom of the cliff skirt.
        const r = ISLAND_RADIUS * k * (ring === RINGS + 1 ? 0.985 : 0.95);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const y = ring === RINGS + 1 ? Math.min(sample(x, z).h, 0) - 0.04 : -SKIRT;
        set(i, x, y, z, color(x, z, -0.5, 1));
      }
    }
  }
  const index: number[] = [];
  for (let s = 0; s < SEGS; s++) index.push(0, 1 + ((s + 1) % SEGS), 1 + s);
  for (let ring = 1; ring < rows; ring++) {
    for (let s = 0; s < SEGS; s++) {
      const a = 1 + (ring - 1) * SEGS + s;
      const b = 1 + (ring - 1) * SEGS + ((s + 1) % SEGS);
      index.push(a, b, a + SEGS, b, b + SEGS, a + SEGS);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

let topMaterial: MeshStandardMaterial | null = null;
const islandTopMaterial = () => (topMaterial ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }));

/** Water / lava features that belong to a theme. */
function Features({ theme, locked, ground }: { theme: WorldTheme; locked: boolean; ground: (x: number, z: number) => number }) {
  const water = useMemo(() => createWaterMaterial({ deep: locked ? '#475569' : '#1d6b8a', shallow: locked ? '#64748b' : '#5fd0e6' }), [locked]);
  const geos = useMemo(
    () => ({
      river: theme === 'jungle' ? ribbonGeometry(ISLAND_CHANNELS.jungle!, 0.3, false) : null,
      lava: theme === 'lava' ? ribbonGeometry(ISLAND_CHANNELS.lava!, 0.2, false) : null,
    }),
    [theme],
  );
  useEffect(() => () => water.dispose(), [water]);
  useEffect(() => () => Object.values(geos).forEach((g) => g?.dispose()), [geos]);
  useFrame((_, dt) => {
    if (!useSettingsStore.getState().reduceMotion) water.uniforms.uTime!.value += Math.min(dt, 0.1);
  });
  const lavaMat = locked ? themeKit('lava', true).b : envMaterial('lava');
  return (
    <>
      {theme === 'starter' && <mesh geometry={GEO.disc} material={water} position={[-1.0, 0.012, -0.75]} scale={[0.72, 1, 0.55]} />}
      {theme === 'frost' && <mesh geometry={GEO.disc} material={themeKit('frost', locked).d} position={[0.95, ground(0.95, 0.75) + 0.015, 0.75]} scale={[0.9, 1, 0.6]} />}
      {geos.river && <mesh geometry={geos.river} material={water} position-y={0.02} />}
      {theme === 'jungle' && !locked && <Waterfall x={2.05} y={-1.1} z={0.22} yaw={Math.PI / 2 - 0.35} width={0.3} height={1.1} />}
      {geos.lava && <mesh geometry={geos.lava} material={lavaMat} position-y={0.025} />}
      {theme === 'lava' && <mesh geometry={GEO.disc} material={lavaMat} position={[-0.15, ground(-0.15, -0.95) + 0.03, -0.95]} scale={0.42} />}
      {theme === 'lava' && !locked && <pointLight position={[-0.15, 1.2, -0.95]} color="#ff7a2a" intensity={2.5} distance={3.2} decay={2} />}
    </>
  );
}

/**
 * One floating world as a miniature diorama: its own landform (hills,
 * canyon mesa, snowy peaks, jungle terraces, sky deck, volcano), water or
 * lava, landmarks and instanced props — then a rock (or engine) underside.
 * Bobs gently; hover / selection scale up and light the halo.
 */
export const WorldIsland = memo(function WorldIsland({ world, locked, selected = false, hovered = false, interactive = true, pad = true, placement, onSelect, onHover, children }: WorldIslandProps) {
  const at = placement ?? { ...world.mapPosition, scale: 1 };
  const seed = islandSeed(world.order);
  const kit = themeKit(world.theme, locked);
  const ground = useMemo(() => islandGround(world.theme, seed), [world.theme, seed]);
  const geo = useMemo(
    () => ({
      top: buildTop(islandHeight(world.theme, seed), islandColor(world.theme, locked), seed),
      rock: rockGeometry(ISLAND_RADIUS * 0.9, ISLAND_RADIUS * 1.35, 9, seed),
    }),
    [world.theme, seed, locked],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const diorama = useMemo(() => islandDiorama(world.theme, seed, ground, locked), [world.theme, seed, ground, locked]);
  const sky = world.theme === 'skylab';

  const halo = useMemo(
    () => new MeshBasicMaterial({ color: world.color, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    [world.color],
  );
  useEffect(() => () => halo.dispose(), [halo]);

  const root = useRef<Group>(null);
  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const calm = useSettingsStore.getState().reduceMotion;
    const t = state.clock.elapsedTime;
    const k = calm ? 1 : 1 - Math.exp(-10 * Math.min(delta, 0.1));
    g.position.y = at.y + (calm ? 0 : islandBob(world.order, t));
    const s = g.scale.x + (at.scale * (selected ? 1.08 : hovered ? 1.03 : 1) - g.scale.x) * k;
    g.scale.setScalar(s);
    // Restraint: a faint, steady rim under the selected island only.
    const targetOpacity = selected ? 0.07 : hovered ? 0.03 : 0;
    halo.opacity += (targetOpacity - halo.opacity) * k;
  });

  const handlers = interactive
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover?.(world.id);
        },
        onPointerOut: () => onHover?.(null),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta <= CLICK_SLOP) onSelect?.(world.id);
        },
      }
    : {};

  const padY = ground(0, 0);
  return (
    <group ref={root} position={[at.x, at.y, at.z]} scale={at.scale} {...handlers}>
      <mesh geometry={geo.top} material={islandTopMaterial()} />
      {sky ? (
        <>
          {/* Sky Lab floats on engines instead of rock. */}
          <mesh geometry={GEO.coneLow} material={kit.band} position-y={-SKIRT} rotation-x={Math.PI} scale={[ISLAND_RADIUS * 1.6, 1.0, ISLAND_RADIUS * 1.6]} />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return <mesh key={i} geometry={GEO.cylinder} material={kit.glow} position={[Math.cos(a) * 0.9, -SKIRT - 0.35, Math.sin(a) * 0.9]} scale={[0.22, 0.12, 0.22]} />;
          })}
        </>
      ) : (
        <mesh geometry={geo.rock} material={kit.rock} position-y={-SKIRT + 0.02} />
      )}
      <Features theme={world.theme} locked={locked} ground={ground} />
      <BakedDiorama batch={diorama} />
      {/* Centre beacon pad (robot / mission marker stands here). */}
      {pad && <mesh geometry={GEO.hexFloor} material={kit.band} scale={[0.95, 0.04, 0.95]} position-y={padY} />}
      {selected && <mesh geometry={GEO.ring} material={kit.glow} scale={0.98} position-y={padY + 0.045} />}
      <mesh geometry={GEO.ring} material={halo} scale={[ISLAND_RADIUS * 2.36, 1, ISLAND_RADIUS * 2.36]} position-y={-0.06} renderOrder={3} />
      {children}
    </group>
  );
});
