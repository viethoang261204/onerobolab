import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef } from 'react';
import { BoxGeometry, CylinderGeometry, type Group, MeshStandardMaterial, PlaneGeometry, SphereGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { useSettingsStore } from '../../settings/settings-store';
import type { AccessoryId, DecalConfig, RobotModelId } from '../model/robot-config';
import { DECAL_ANCHORS, MOUNTS, type Vec3 } from './mounts';
import type { PartMaterials } from './part-materials';
import { decalTexture } from './textures';

/*
 * Accessories and decals, placed at each model's mount points (design
 * units) and painted with the robot's part materials.
 */

const G = {
  rod: new CylinderGeometry(0.008, 0.01, 1, 10),
  tip: new SphereGeometry(0.022, 14, 10),
  lamp: new CylinderGeometry(0.03, 0.035, 0.05, 18).rotateZ(Math.PI / 2),
  lens: new CylinderGeometry(0.024, 0.024, 0.006, 18).rotateZ(Math.PI / 2),
  flag: new PlaneGeometry(0.12, 0.075),
  pod: new RoundedBoxGeometry(0.12, 0.06, 0.05, 3, 0.015),
  pack: new RoundedBoxGeometry(0.1, 0.14, 0.22, 3, 0.03),
  strip: new BoxGeometry(0.005, 0.1, 0.012),
  panel: new BoxGeometry(0.18, 0.008, 0.14),
  panelFrame: new BoxGeometry(0.19, 0.012, 0.15),
  seg: new BoxGeometry(0.03, 0.12, 0.03),
  claw: new BoxGeometry(0.05, 0.02, 0.012),
  shield: new CylinderGeometry(0.16, 0.16, 0.02, 24, 1, false, -Math.PI / 3, (Math.PI * 2) / 3),
  droneBody: new RoundedBoxGeometry(0.08, 0.025, 0.08, 2, 0.01),
  rotor: new CylinderGeometry(0.025, 0.025, 0.004, 14),
  arm: new BoxGeometry(0.11, 0.008, 0.008),
};

let solar: MeshStandardMaterial | null = null;
const solarMat = () => (solar ??= new MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.25, metalness: 0.5, emissive: '#0b1f5c', emissiveIntensity: 0.25 }));

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function MiniDrone({ at, mats }: { at: Vec3; mats: PartMaterials }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    const d = g.current;
    if (!d) return;
    const t = useSettingsStore.getState().reduceMotion ? 0.6 : clock.elapsedTime;
    d.position.set(at[0] + Math.cos(t * 0.9) * 0.34, at[1] + 0.2 + Math.sin(t * 2.1) * 0.03, at[2] + Math.sin(t * 0.9) * 0.34);
    d.rotation.y = -t * 0.9;
  });
  return (
    <group ref={g}>
      <mesh geometry={G.droneBody} material={mats.body} castShadow />
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} geometry={G.arm} material={mats.trim} rotation-y={r + Math.PI / 4} />
      ))}
      {[
        [0.04, 0.04],
        [-0.04, 0.04],
        [0.04, -0.04],
        [-0.04, -0.04],
      ].map(([x = 0, z = 0]) => (
        <mesh key={`${x}${z}`} geometry={G.rotor} material={mats.accent} position={[x, 0.012, z]} />
      ))}
      <mesh geometry={G.tip} material={mats.led} position={[0.04, 0, 0]} scale={0.5} />
    </group>
  );
}

/** Every chosen accessory at its mount on the model. */
export const Accessories = memo(function Accessories({ model, ids, mats }: { model: RobotModelId; ids: readonly AccessoryId[]; mats: PartMaterials }) {
  const m = MOUNTS[model];
  const has = (a: AccessoryId) => ids.includes(a);
  const sideL: Vec3 = [m.side[0], m.side[1], -m.side[2]];
  return (
    <group>
      {has('antenna') && (
        <group position={add(m.headTop, [-0.02, 0, 0.04])}>
          <mesh geometry={G.rod} material={mats.trim} position-y={0.12} scale-y={0.24} castShadow />
          <mesh geometry={G.tip} material={mats.led} position-y={0.25} />
        </group>
      )}
      {has('head-light') && (
        <group position={add(m.headTop, [0.03, -0.01, -0.04])}>
          <mesh geometry={G.lamp} material={mats.trim} castShadow />
          <mesh geometry={G.lens} material={mats.led} position-x={0.026} />
        </group>
      )}
      {has('flag') && (
        <group position={add(m.back, [0, 0, -0.08])}>
          <mesh geometry={G.rod} material={mats.trim} position-y={0.17} scale-y={0.34} castShadow />
          {/* Two faces so both sides take the accent paint. */}
          <mesh geometry={G.flag} material={mats.accent} position={[-0.062, 0.3, 0]} castShadow />
          <mesh geometry={G.flag} material={mats.accent} position={[-0.062, 0.3, 0]} rotation-y={Math.PI} />
        </group>
      )}
      {has('side-sensor') && (
        <group position={add(m.side, [0.02, 0.02, 0.03])}>
          <mesh geometry={G.pod} material={mats.trim} castShadow />
          <mesh geometry={G.lens} material={mats.led} position={[0.062, 0, 0]} />
        </group>
      )}
      {has('backpack') && (
        <group position={add(m.back, [-0.045, -0.02, 0])}>
          <mesh geometry={G.pack} material={mats.accent} castShadow />
          <mesh geometry={G.strip} material={mats.led} position={[-0.052, 0, 0]} />
        </group>
      )}
      {has('solar-panel') && (
        <group position={add(m.deck, [-0.04, 0.05, 0])} rotation-z={0.25}>
          <mesh geometry={G.panelFrame} material={mats.trim} castShadow />
          <mesh geometry={G.panel} material={solarMat()} position-y={0.006} />
          <mesh geometry={G.rod} material={mats.trim} position-y={-0.025} scale-y={0.05} />
        </group>
      )}
      {has('tool-arm') && (
        <group position={add(sideL, [0.02, 0.02, -0.03])}>
          <mesh geometry={G.seg} material={mats.trim} rotation-x={0.5} position={[0, 0.04, -0.03]} castShadow />
          <mesh geometry={G.seg} material={mats.accent} rotation-z={-1.1} position={[0.06, 0.1, -0.06]} castShadow />
          <mesh geometry={G.claw} material={mats.trim} position={[0.12, 0.13, -0.05]} rotation-z={0.4} />
          <mesh geometry={G.claw} material={mats.trim} position={[0.12, 0.11, -0.07]} rotation-z={-0.4} />
        </group>
      )}
      {has('shield') && (
        <group position={add(sideL, [0, 0.03, -0.04])} rotation-x={Math.PI / 2}>
          <mesh geometry={G.shield} material={mats.accent} castShadow />
          <mesh geometry={G.shield} material={mats.led} scale={[1.04, 0.3, 1.04]} position-y={-0.01} />
        </group>
      )}
      {has('mini-drone') && <MiniDrone at={m.headTop} mats={mats} />}
    </group>
  );
});

const plane = new PlaneGeometry(1, 1);

function Decal({ model, decal }: { model: RobotModelId; decal: DecalConfig }) {
  const anchor = DECAL_ANCHORS[model][decal.placement];
  const texture = decalTexture(decal.id, decal.color, decal.text ?? '');
  const material = useMemo(
    () => new MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.5 }),
    [texture],
  );
  useEffect(() => () => material.dispose(), [material]);
  if (!anchor || !texture) return null;
  return <mesh geometry={plane} material={material} position={anchor.p} rotation={[anchor.r[0], anchor.r[1], 0]} scale={anchor.size} renderOrder={2} />;
}

/** Decals on the model's supported surfaces. */
export const Decals = memo(function Decals({ model, decals }: { model: RobotModelId; decals: readonly DecalConfig[] }) {
  return (
    <group>
      {decals.map((d) => (
        <Decal key={d.placement} model={model} decal={d} />
      ))}
    </group>
  );
});
