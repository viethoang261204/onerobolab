import { useFrame } from '@react-three/fiber';
import type { Area2D, MapEntityOf, MapQuery, Pose2D, Vec2 } from '@robolab/shared';
import { memo, useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Float32BufferAttribute, type Group, LineBasicMaterial, MeshStandardMaterial } from 'three';
import type { LevelScene } from '../../../../content/levels/types';
import { useSettingsStore } from '../../../settings/settings-store';
import { Checkpoint } from '../../environment/Checkpoint';
import { ribbonGeometry } from '../../environment/geometry';
import { MAT, PALETTE } from '../../environment/materials';
import { GEO } from '../../environment/shapes';
import { checkerTexture } from '../../environment/textures';
import { SENSOR_COLOR_HEX } from '../../render/palette';
import { AreaGeometry, floorRotation } from '../../render/scene/area-geometry';
import { LabelSprite } from '../../render/scene/LabelSprite';
import { useRuntimeStore } from '../../runtime/runtime-store';
import { PropBatch } from '../props/batch';
import { BatchMesh } from '../props/BatchMesh';
import { MissionObjects } from './MissionObjects';
import { boxPiece, bridgePieces, obstaclePiece, wallPieces } from './pieces';

/** Floor decal layers (m above the floor) to avoid z-fighting with roads. */
const LAYER = { grid: 0.005, zone: 0.006, line: 0.007, marker: 0.008 } as const;
const GRID_CELL = 0.6;

/** Subtle 0.6 m grid lines anchored so the robot starts at the center of a cell. */
function CourseGrid({ size, start }: { size: Vec2; start: Pose2D }) {
  const { geo, mat } = useMemo(() => {
    const hw = size.x / 2;
    const hd = size.z / 2;
    const verts: number[] = [];
    const ox = start.x + GRID_CELL / 2;
    const oz = start.z + GRID_CELL / 2;
    for (let x = ox - Math.ceil((ox + hw) / GRID_CELL) * GRID_CELL; x <= hw; x += GRID_CELL) {
      if (x < -hw) continue;
      verts.push(x, LAYER.grid, -hd, x, LAYER.grid, hd);
    }
    for (let z = oz - Math.ceil((oz + hd) / GRID_CELL) * GRID_CELL; z <= hd; z += GRID_CELL) {
      if (z < -hd) continue;
      verts.push(-hw, LAYER.grid, z, hw, LAYER.grid, z);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(verts, 3));
    const m = new LineBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.25, depthWrite: false });
    return { geo: g, mat: m };
  }, [size.x, size.z, start.x, start.z]);
  useEffect(() => () => {
    geo.dispose();
    mat.dispose();
  }, [geo, mat]);
  return <lineSegments geometry={geo} material={mat} />;
}

/**
 * Everything the robot interacts with, from the level's physics map: walls
 * (styled per id prefix / bridge), obstacles, boxes, bridges, checkpoints,
 * goal and start pad, painted lines and colour zones. Visuals never add or
 * move colliders — the map is the single source of truth.
 */
export const GameplayLayer = memo(function GameplayLayer({ map, scene, natural = false }: { map: MapQuery; scene: LevelScene; natural?: boolean }) {
  const { definition } = map;
  const batch = useMemo(() => {
    const b = new PropBatch();
    const bridges = scene.bridges ?? [];
    for (const w of map.entitiesOfType('wall')) wallPieces(b, w, bridges, natural);
    for (const o of map.entitiesOfType('obstacle')) obstaclePiece(b, o);
    // Pushable crates move during a run: `MissionObjects` draws them.
    for (const box of map.entitiesOfType('box')) if (!box.dynamic) boxPiece(b, box);
    for (const br of bridges) {
      const water = scene.water?.find((w) => w.points.length > 0);
      bridgePieces(b, br, water ? water.depth + 0.2 : 0.4, natural);
    }
    return b;
  }, [map, scene, natural]);
  return (
    <group>
      <CourseGrid size={definition.size} start={definition.start} />
      <BatchMesh batch={batch} />
      <Paths lines={map.entitiesOfType('line')} />
      <Zones zones={map.entitiesOfType('colorZone')} />
      <MissionObjects map={map} />
      <CourseCheckpoints map={map} />
      <GoalPad area={definition.finish} />
      <StartPad x={definition.start.x} z={definition.start.z} heading={definition.start.heading} />
    </group>
  );
});

/** Checkpoints light up as the current run reaches them (re-renders only when that list changes). */
function CourseCheckpoints({ map }: { map: MapQuery }) {
  const visited = useRuntimeStore((s) => s.mission?.visitedCheckpoints);
  return (
    <>
      {map.entitiesOfType('checkpoint').map((cp) => (
        <Checkpoint
          key={cp.id}
          position={[cp.area.center.x, 0, cp.area.center.z]}
          radius={areaRadius(cp.area)}
          label={String(cp.order)}
          reached={!!visited?.includes(cp.id)}
        />
      ))}
    </>
  );
}

const areaRadius = (a: Area2D) => (a.shape === 'circle' ? a.radius : Math.min(a.size.x, a.size.z) / 2);

/** Painted line tracks as mitred ribbons (smooth through curves). */
function Paths({ lines }: { lines: readonly MapEntityOf<'line'>[] }) {
  const geos = useMemo(() => lines.map((l) => ({ id: l.id, geo: ribbonGeometry(l.points, l.width, l.closed) })), [lines]);
  useEffect(() => () => geos.forEach((g) => g.geo.dispose()), [geos]);
  return (
    <>
      {geos.map(({ id, geo }) => (
        <mesh key={id} geometry={geo} material={MAT.road} position-y={LAYER.line} receiveShadow />
      ))}
    </>
  );
}

/** Coloured floor zones with a glowing outline and a floating marker. */
function Zones({ zones }: { zones: readonly MapEntityOf<'colorZone'>[] }) {
  return (
    <>
      {zones.map((z) => {
        const glow = z.color === 'red' ? MAT.redGlow : z.color === 'blue' ? MAT.blueGlow : MAT.cyanGlow;
        return (
          <group key={z.id} position={[z.area.center.x, 0, z.area.center.z]}>
            <mesh position-y={LAYER.zone} rotation={floorRotation(z.area)} receiveShadow>
              <AreaGeometry area={z.area} inset={-0.025} />
              <meshStandardMaterial color={SENSOR_COLOR_HEX[z.color]} emissive={SENSOR_COLOR_HEX[z.color]} emissiveIntensity={0.55} roughness={0.6} />
            </mesh>
            <mesh position-y={LAYER.zone + 0.0005} rotation={floorRotation(z.area)} receiveShadow>
              <AreaGeometry area={z.area} inset={0.02} />
              <meshStandardMaterial color={SENSOR_COLOR_HEX[z.color]} roughness={0.7} />
            </mesh>
            <mesh geometry={GEO.octa} material={glow} scale={[0.06, 0.09, 0.06]} position-y={0.22} />
          </group>
        );
      })}
    </>
  );
}

const FINISH_TILE = 0.1;

/** Supply/goal area: checker pad, green glow border, beam and flag. */
function GoalPad({ area }: { area: Area2D }) {
  const extent = area.shape === 'rect' ? area.size : { x: area.radius * 2, z: area.radius * 2 };
  const checker = useMemo(() => {
    const tex = checkerTexture().clone();
    tex.repeat.set(extent.x / (FINISH_TILE * 2), extent.z / (FINISH_TILE * 2));
    tex.needsUpdate = true;
    return new MeshStandardMaterial({ map: tex, roughness: 0.7, transparent: true, opacity: 0.85 });
  }, [extent.x, extent.z]);
  useEffect(
    () => () => {
      checker.map?.dispose();
      checker.dispose();
    },
    [checker],
  );
  const r = Math.max(extent.x, extent.z) / 2;

  return (
    <group position={[area.center.x, 0, area.center.z]}>
      <mesh position-y={LAYER.zone} rotation={floorRotation(area)} material={MAT.greenGlow}>
        <AreaGeometry area={area} inset={-0.03} />
      </mesh>
      <mesh position-y={LAYER.zone + 0.0006} rotation={floorRotation(area)} material={checker} receiveShadow>
        <AreaGeometry area={area} />
      </mesh>
      <mesh geometry={GEO.beam} material={MAT.beamGreen} scale={[r * 1.6, 0.4, r * 1.6]} renderOrder={2} />
      <GoalBeacon radius={r} />
      <group position={[extent.x * 0.35, 0, -extent.z * 0.35]}>
        <mesh geometry={GEO.cylinderFloor} material={MAT.metal} scale={[0.012, 0.5, 0.012]} castShadow />
        <mesh geometry={GEO.box} material={MAT.red} scale={[0.14, 0.08, 0.004]} position={[0.07, 0.45, 0]} castShadow />
      </group>
      <LabelSprite text="GOAL" color={PALETTE.green} y={0.62} />
    </group>
  );
}

/** "Go here": a slowly turning floor ring and a bobbing arrow above the goal. */
function GoalBeacon({ radius }: { radius: number }) {
  const ring = useRef<Group>(null);
  const arrow = useRef<Group>(null);
  useFrame((state) => {
    if (useSettingsStore.getState().reduceMotion) return;
    const t = state.clock.elapsedTime;
    if (ring.current) {
      ring.current.rotation.y = t * 0.6;
      ring.current.scale.setScalar(1 + Math.sin(t * 2) * 0.04);
    }
    if (arrow.current) arrow.current.position.y = 0.5 + Math.sin(t * 2.2) * 0.04;
  });
  return (
    <>
      <group ref={ring} position-y={LAYER.marker + 0.001}>
        <mesh geometry={GEO.ring} material={MAT.greenGlow} scale={radius * 2.5} />
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={GEO.box} material={MAT.greenGlow} scale={[0.06, 0.004, 0.02]} position={[Math.cos((i * Math.PI) / 2) * radius * 1.35, 0, Math.sin((i * Math.PI) / 2) * radius * 1.35]} rotation-y={(-i * Math.PI) / 2} />
        ))}
      </group>
      <group ref={arrow} position-y={0.5}>
        <mesh geometry={GEO.coneFloor} material={MAT.greenGlow} scale={[0.07, 0.1, 0.07]} rotation-x={Math.PI} />
      </group>
    </>
  );
}

/** Start/charging pad under the robot's spawn pose. */
function StartPad({ x, z, heading }: { x: number; z: number; heading: number }) {
  return (
    <group position={[x, LAYER.marker, z]} rotation-y={heading}>
      <mesh geometry={GEO.disc} material={MAT.metalDark} scale={0.42} receiveShadow />
      <mesh geometry={GEO.ring} material={MAT.purpleGlow} scale={0.46} position-y={0.0005} />
      <mesh position={[0.27, 0.0005, 0]} rotation-x={-Math.PI / 2} material={MAT.purpleGlow}>
        <circleGeometry args={[0.045, 3]} />
      </mesh>
    </group>
  );
}
