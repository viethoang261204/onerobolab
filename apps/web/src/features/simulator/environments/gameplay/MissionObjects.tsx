import { useFrame } from '@react-three/fiber';
import { CARGO_RADIUS } from '@robolab/physics-engine';
import { moverPosition, signalPhase, type Area2D, type CargoColor, type MapEntityOf, type MapQuery, type SignalPhase } from '@robolab/shared';
import { memo, useRef } from 'react';
import { MeshStandardMaterial, type Group, type Material, type Mesh } from 'three';
import { useSettingsStore } from '../../../settings/settings-store';
import { MAT } from '../../environment/materials';
import { GEO } from '../../environment/shapes';
import { SENSOR_COLOR_HEX } from '../../render/palette';
import { AreaGeometry, floorRotation } from '../../render/scene/area-geometry';
import { LabelSprite } from '../../render/scene/LabelSprite';
import { getWorldView } from '../../runtime/world-view';
import { envMaterial } from '../props/materials';

/*
 * The interactive mission objects of a level, drawn from its map: pushable
 * crates, construction / delivery / hazard zones, smart gates, traffic
 * lights, cargo stacks (and the crates set down) and patrolling obstacles.
 * Anything that changes during a run reads the simulation's `WorldView`
 * every frame (refs only, no React state); previews show the start state.
 */

const LAYER = 0.009;

// Materials shared by every level (created once, app lifetime — like `MAT`).
const cache = new Map<string, Material>();
const mat = (key: string, make: () => Material): Material => {
  let m = cache.get(key);
  if (!m) cache.set(key, (m = make()));
  return m;
};
const std = (color: string, extra: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}) => new MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const crateMat = (color: CargoColor | undefined) => mat(`crate:${color ?? 'wood'}`, () => (color ? std(SENSOR_COLOR_HEX[color], { roughness: 0.55 }) : envMaterial('wood') as MeshStandardMaterial));
const lamp = (phase: SignalPhase, lit: boolean) =>
  mat(`lamp:${phase}:${lit}`, () => {
    const hex = phase === 'red' ? '#ef4444' : phase === 'green' ? '#22c55e' : '#facc15';
    return lit ? std(hex, { emissive: hex, emissiveIntensity: 1.6, roughness: 0.3 }) : std('#1f2937', { roughness: 0.4 });
  });
const tile = (phase: SignalPhase) => mat(`tile:${phase}`, () => std(SENSOR_COLOR_HEX[phase], { emissive: SENSOR_COLOR_HEX[phase], emissiveIntensity: 0.45 }));
const water = () => mat('flood', () => std('#2f7fc4', { roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.82 }));
const zoneFill = (hex: string) => mat(`zone:${hex}`, () => std(hex, { transparent: true, opacity: 0.55, roughness: 0.8, depthWrite: false }));
const white = () => mat('white', () => std('#f8fafc', { roughness: 0.6 }));

const reduceMotion = () => useSettingsStore.getState().reduceMotion;

/** Thin border along an area's edge (hazard tape, pad rims). */
function AreaBorder({ area, material, width = 0.025, height = 0.012 }: { area: Area2D; material: Material; width?: number; height?: number }) {
  if (area.shape === 'circle') {
    return <mesh geometry={GEO.ring} material={material} scale={[area.radius * 2, 1, area.radius * 2]} position={[area.center.x, LAYER + 0.002, area.center.z]} />;
  }
  const { x: w, z: d } = area.size;
  const sides: [number, number, number, number][] = [
    [0, -d / 2, w + width, width],
    [0, d / 2, w + width, width],
    [-w / 2, 0, width, d],
    [w / 2, 0, width, d],
  ];
  return (
    <group position={[area.center.x, 0, area.center.z]} rotation-y={area.rotation}>
      {sides.map(([x, z, sx, sz], i) => (
        <mesh key={i} geometry={GEO.boxFloor} material={material} scale={[sx, height, sz]} position={[x, 0, z]} />
      ))}
    </group>
  );
}

/** A flat area on the floor. */
function AreaFloor({ area, material, y = LAYER }: { area: Area2D; material: Material; y?: number }) {
  return (
    <mesh position={[area.center.x, y, area.center.z]} rotation={floorRotation(area)} material={material} receiveShadow>
      <AreaGeometry area={area} />
    </mesh>
  );
}

/** Pushable crate: follows the simulation every frame. */
function PushCrate({ box }: { box: MapEntityOf<'box'> }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    const pose = getWorldView()?.crates().find((c) => c.id === box.id)?.pose;
    if (!g) return;
    g.position.set(pose?.x ?? box.position.x, 0, pose?.z ?? box.position.z);
    g.rotation.y = pose?.heading ?? box.rotation;
  });
  const { x: sx, y: sy, z: sz } = box.size;
  return (
    <group ref={ref} position={[box.position.x, 0, box.position.z]} rotation-y={box.rotation}>
      <mesh geometry={GEO.boxFloor} material={envMaterial('wood')} scale={[sx, sy, sz]} castShadow receiveShadow />
      <mesh geometry={GEO.boxFloor} material={envMaterial('woodDark')} scale={[sx * 1.03, sy * 1.01, sz * 0.2]} position-y={-0.001} />
      <mesh geometry={GEO.boxFloor} material={envMaterial('woodDark')} scale={[sx * 0.2, sy * 1.01, sz * 1.03]} position-y={-0.001} />
      <mesh geometry={GEO.boxFloor} material={envMaterial('hazard')} scale={[sx * 1.01, sy * 0.12, sz * 1.01]} position-y={sy * 0.8} />
    </group>
  );
}

function Zone({ zone, finish }: { zone: MapEntityOf<'zone'>; finish: { x: number; z: number } }) {
  const c = zone.area.center;
  const nearGoal = Math.hypot(c.x - finish.x, c.z - finish.z) < 0.55;
  if (zone.kind === 'hazard') {
    const corners = zone.area.shape === 'rect' ? [-1, 1].flatMap((a) => [-1, 1].map((b) => [a, b] as const)) : [];
    return (
      <group>
        <AreaFloor area={zone.area} material={water()} y={LAYER + 0.004} />
        <AreaBorder area={zone.area} material={envMaterial('hazard')} width={0.03} height={0.02} />
        {zone.area.shape === 'rect' &&
          corners.map(([a, b], i) => {
            const area = zone.area as Extract<Area2D, { shape: 'rect' }>;
            const local = { x: (a * area.size.x) / 2, z: (b * area.size.z) / 2 };
            const cos = Math.cos(area.rotation);
            const sin = Math.sin(area.rotation);
            return <mesh key={i} geometry={GEO.cylinderLow} material={MAT.red} scale={[0.025, 0.16, 0.025]} position={[c.x + local.x * cos + local.z * sin, 0, c.z - local.x * sin + local.z * cos]} castShadow />;
          })}
        <LabelSprite text={zone.label ?? 'FLOOD'} color="#ef4444" y={0.3} />
      </group>
    );
  }
  if (zone.kind === 'construction') {
    return (
      <group>
        <AreaFloor area={zone.area} material={zoneFill('#f59e0b')} />
        <AreaBorder area={zone.area} material={envMaterial('hazard')} />
        <group position={[c.x, 0, c.z]}>
          <LabelSprite text={zone.label ?? 'BUILD HERE'} color="#f59e0b" y={0.32} />
        </group>
      </group>
    );
  }
  const hex = zone.color ? SENSOR_COLOR_HEX[zone.color] : '#22c55e';
  return (
    <group>
      <AreaFloor area={zone.area} material={zoneFill(hex)} />
      <AreaBorder area={zone.area} material={white()} width={0.02} height={0.008} />
      {zone.label && (
        <group position={[c.x, 0, c.z]}>
          <LabelSprite text={zone.label} color={hex} y={nearGoal ? 0.88 : 0.3} />
        </group>
      )}
    </group>
  );
}

/** Smart gate: posts, a barrier arm that lifts once the scanner has read the robot, and the scanner pad. */
function Gate({ gate }: { gate: MapEntityOf<'gate'> }) {
  const arm = useRef<Group>(null);
  const red = useRef<Mesh>(null);
  const green = useRef<Mesh>(null);
  const dx = gate.to.x - gate.from.x;
  const dz = gate.to.z - gate.from.z;
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(-dz, dx);
  useFrame((_, delta) => {
    const open = !!getWorldView()?.isGateOpen(gate.id);
    if (arm.current) {
      const target = open ? -Math.PI * 0.45 : 0;
      const cur = arm.current.rotation.z;
      arm.current.rotation.z = reduceMotion() ? target : cur + (target - cur) * Math.min(1, delta * 4);
    }
    if (red.current) red.current.visible = !open;
    if (green.current) green.current.visible = open;
  });
  return (
    <group>
      <AreaFloor area={gate.trigger} material={zoneFill('#22d3ee')} />
      <AreaBorder area={gate.trigger} material={MAT.cyanGlow} width={0.015} height={0.006} />
      <group position={[gate.from.x, 0, gate.from.z]} rotation-y={yaw}>
        <mesh geometry={GEO.cylinderFloor} material={MAT.metalDark} scale={[0.05, gate.height + 0.08, 0.05]} castShadow />
        <mesh ref={red} geometry={GEO.icosa} material={lamp('red', true)} scale={0.045} position-y={gate.height + 0.12} />
        <mesh ref={green} geometry={GEO.icosa} material={lamp('green', true)} scale={0.045} position-y={gate.height + 0.12} visible={false} />
        {/* The arm pivots at this post. */}
        <group ref={arm} position-y={gate.height * 0.75}>
          <mesh geometry={GEO.box} material={envMaterial('hazard')} scale={[len, 0.045, 0.035]} position-x={len / 2} castShadow />
        </group>
      </group>
      <mesh geometry={GEO.cylinderFloor} material={MAT.metalDark} scale={[0.035, gate.height * 0.8, 0.035]} position={[gate.to.x, 0, gate.to.z]} castShadow />
    </group>
  );
}

/** Traffic light pole + lamps, zebra crossing and the signal tile, all following the light's timetable. */
function TrafficLight({ light }: { light: MapEntityOf<'trafficLight'> }) {
  const lamps = useRef<Record<SignalPhase, [Mesh | null, Mesh | null]>>({ red: [null, null], yellow: [null, null], green: [null, null] });
  const tiles = useRef<Record<SignalPhase, Mesh | null>>({ red: null, yellow: null, green: null });
  useFrame(() => {
    const phase = signalPhase(light, getWorldView()?.time() ?? 0);
    for (const p of ['red', 'yellow', 'green'] as const) {
      const [on, off] = lamps.current[p];
      if (on) on.visible = p === phase;
      if (off) off.visible = p !== phase;
      const t = tiles.current[p];
      if (t) t.visible = p === phase;
    }
  });
  const c = light.crossing;
  const stripes = c.shape === 'rect' ? Math.max(3, Math.round(Math.max(c.size.x, c.size.z) / 0.12)) : 0;
  return (
    <group>
      {/* Zebra stripes across the crossing. */}
      {c.shape === 'rect' && (
        <group position={[c.center.x, LAYER, c.center.z]} rotation-y={c.rotation}>
          {Array.from({ length: stripes }, (_, i) => {
            const along = c.size.x >= c.size.z;
            const span = along ? c.size.x : c.size.z;
            const o = -span / 2 + (i + 0.5) * (span / stripes);
            return <mesh key={i} geometry={GEO.box} material={white()} scale={along ? [span / stripes / 2, 0.004, c.size.z * 0.92] : [c.size.x * 0.92, 0.004, span / stripes / 2]} position={along ? [o, 0, 0] : [0, 0, o]} receiveShadow />;
          })}
        </group>
      )}
      {(['red', 'yellow', 'green'] as const).map((p) => (
        <mesh
          key={p}
          ref={(m) => {
            tiles.current[p] = m;
          }}
          position={[light.signal.center.x, LAYER + 0.003, light.signal.center.z]}
          rotation={floorRotation(light.signal)}
          material={tile(p)}
          visible={p === 'red'}
        >
          <AreaGeometry area={light.signal} />
        </mesh>
      ))}
      <group position={[light.position.x, 0, light.position.z]} rotation-y={light.facing}>
        <mesh geometry={GEO.cylinderFloor} material={MAT.metalDark} scale={[0.03, 0.62, 0.03]} castShadow />
        <mesh geometry={GEO.box} material={MAT.metalDark} scale={[0.06, 0.2, 0.08]} position={[0.02, 0.58, 0]} castShadow />
        {(['red', 'yellow', 'green'] as const).map((p, i) => (
          <group key={p} position={[0.052, 0.645 - i * 0.062, 0]}>
            <mesh
              ref={(m) => {
                lamps.current[p][0] = m;
              }}
              geometry={GEO.icosa}
              material={lamp(p, true)}
              scale={0.04}
              visible={p === 'red'}
            />
            <mesh
              ref={(m) => {
                lamps.current[p][1] = m;
              }}
              geometry={GEO.icosa}
              material={lamp(p, false)}
              scale={0.04}
              visible={p !== 'red'}
            />
          </group>
        ))}
      </group>
    </group>
  );
}

const CRATE = 0.11;
const COLUMN = 5;

/** Where the j-th crate from the bottom of an n-crate stack sits (columns of 5 side by side). */
function stackSpot(j: number, n: number): [number, number, number] {
  const columns = Math.ceil(n / COLUMN);
  const col = Math.floor(j / COLUMN);
  return [(col - (columns - 1) / 2) * (CRATE + 0.01), 0.03 + (j % COLUMN) * (CRATE + 0.004), 0];
}

/** A pallet with its stack of crates; picked crates disappear from the top. */
function CargoStack({ cargo }: { cargo: MapEntityOf<'cargo'> }) {
  const refs = useRef<(Group | null)[]>([]);
  const n = cargo.items.length;
  useFrame(() => {
    const left = getWorldView()?.stack(cargo.id);
    cargo.items.forEach((item, k) => {
      const g = refs.current[k];
      if (g) g.visible = left ? left.includes(item) : true;
    });
  });
  return (
    <group>
      {cargo.tile && <AreaFloor area={cargo.tile} material={zoneFill('#94a3b8')} />}
      <group position={[cargo.position.x, 0, cargo.position.z]}>
        <mesh geometry={GEO.cylinderLow} material={envMaterial('woodDark')} scale={[CARGO_RADIUS * 2, 0.03, CARGO_RADIUS * 2]} castShadow receiveShadow />
        {cargo.items.map((item, k) => (
          <group
            key={item.id}
            ref={(g) => {
              refs.current[k] = g;
            }}
            // items[0] is picked first: it sits on top. Tall stacks stand in columns of 5.
            position={stackSpot(n - 1 - k, n)}
            rotation-y={k * 0.35}
          >
            <mesh geometry={GEO.boxFloor} material={crateMat(item.color)} scale={CRATE} castShadow />
            <mesh geometry={GEO.boxFloor} material={envMaterial('woodDark')} scale={[CRATE * 1.02, CRATE * 1.01, CRATE * 0.2]} position-y={-0.0005} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** Crates set down by the robot (a small pool, placed every frame). */
function PlacedCrates({ max }: { max: number }) {
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const placed = getWorldView()?.placed() ?? [];
    refs.current.forEach((m, k) => {
      if (!m) return;
      const p = placed[k];
      m.visible = !!p;
      if (!p) return;
      // Crates set down on the same spot pile up.
      let below = 0;
      for (let j = 0; j < k; j++) {
        const q = placed[j]!;
        if (Math.hypot(q.at.x - p.at.x, q.at.z - p.at.z) < CRATE * 0.8) below++;
      }
      m.position.set(p.at.x, below * (CRATE + 0.004), p.at.z);
      m.material = crateMat(p.item.color);
    });
  });
  return (
    <>
      {Array.from({ length: max }, (_, k) => (
        <mesh
          key={k}
          ref={(m) => {
            refs.current[k] = m;
          }}
          geometry={GEO.boxFloor}
          scale={CRATE}
          visible={false}
          castShadow
        />
      ))}
    </>
  );
}

/** A patrol cart moving on its timetable, with a warning beacon. */
function Mover({ mover }: { mover: MapEntityOf<'mover'> }) {
  const ref = useRef<Group>(null);
  const beacon = useRef<Mesh>(null);
  useFrame((state) => {
    const p = getWorldView()?.moverAt(mover) ?? moverPosition(mover, 0);
    ref.current?.position.set(p.x, 0, p.z);
    if (beacon.current && !reduceMotion()) beacon.current.rotation.y = state.clock.elapsedTime * 4;
  });
  const r = mover.radius;
  return (
    <group>
      <mesh
        geometry={GEO.box}
        material={zoneFill('#a855f7')}
        scale={[Math.hypot(mover.to.x - mover.from.x, mover.to.z - mover.from.z) + r * 2, 0.002, 0.03]}
        position={[(mover.from.x + mover.to.x) / 2, LAYER, (mover.from.z + mover.to.z) / 2]}
        rotation-y={Math.atan2(-(mover.to.z - mover.from.z), mover.to.x - mover.from.x)}
      />
      <group ref={ref} position={[mover.from.x, 0, mover.from.z]}>
        <mesh geometry={GEO.cylinderFloor} material={MAT.yellow} scale={[r * 2, mover.height * 0.7, r * 2]} castShadow />
        <mesh geometry={GEO.cylinderFloor} material={MAT.metalDark} scale={[r * 2.05, mover.height * 0.12, r * 2.05]} position-y={mover.height * 0.3} />
        <mesh ref={beacon} geometry={GEO.coneFloor} material={MAT.redGlow} scale={[r * 0.8, mover.height * 0.35, r * 0.8]} position-y={mover.height * 0.7} />
      </group>
    </group>
  );
}

/** Every interactive object of the map. */
export const MissionObjects = memo(function MissionObjects({ map }: { map: MapQuery }) {
  const crates = map.entitiesOfType('box').filter((b) => b.dynamic);
  const cargo = map.entitiesOfType('cargo');
  const items = cargo.reduce((n, c) => n + c.items.length, 0);
  const finish = map.definition.finish.center;
  return (
    <group>
      {map.entitiesOfType('zone').map((z) => (
        <Zone key={z.id} zone={z} finish={finish} />
      ))}
      {crates.map((b) => (
        <PushCrate key={b.id} box={b} />
      ))}
      {map.entitiesOfType('gate').map((g) => (
        <Gate key={g.id} gate={g} />
      ))}
      {map.entitiesOfType('trafficLight').map((l) => (
        <TrafficLight key={l.id} light={l} />
      ))}
      {cargo.map((c) => (
        <CargoStack key={c.id} cargo={c} />
      ))}
      {items > 0 && <PlacedCrates max={items} />}
      {map.entitiesOfType('mover').map((m) => (
        <Mover key={m.id} mover={m} />
      ))}
    </group>
  );
});

/** Inside `<Robot>` (design units): the crate the robot is carrying, shown while it carries one. */
export function CarriedCrate() {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const item = getWorldView()?.carried() ?? null;
    m.visible = !!item;
    if (item) m.material = crateMat(item.color);
  });
  return <mesh ref={ref} geometry={GEO.boxFloor} scale={0.16} position={[0.415, 0.185, 0]} visible={false} castShadow />;
}
