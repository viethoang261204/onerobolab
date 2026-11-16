import { memo, type RefObject } from 'react';
import { BoxGeometry, CapsuleGeometry, CylinderGeometry, type Group, SphereGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { WheelStyleId } from '../model/robot-config';
import type { PartMaterials } from './part-materials';

/*
 * Procedural placeholder models (Scout, Tank, Biped) — each with its own
 * silhouette, in the rover's design units, painted through the shared part
 * materials. Replaceable by GLB models that expose the same rig groups.
 */

/** Animated groups a model exposes (all optional). */
export interface ModelRig {
  readonly head: RefObject<Group | null>;
  readonly armLeft: RefObject<Group | null>;
  readonly armRight: RefObject<Group | null>;
  /** Wheels / road wheels: rotate about Z to roll. */
  readonly wheels: readonly RefObject<Group | null>[];
}

export interface ModelProps {
  mats: PartMaterials;
  rig: ModelRig;
  wheelStyle: WheelStyleId;
}

const rbox = (x: number, y: number, z: number, r: number) => new RoundedBoxGeometry(x, y, z, 3, r);
const cylZ = (r: number, len: number, sides = 24) => new CylinderGeometry(r, r, len, sides).rotateX(Math.PI / 2);

// App-lifetime shared geometry (like environment/shapes).
const G = {
  scoutBody: rbox(0.5, 0.13, 0.3, 0.05),
  scoutNose: rbox(0.14, 0.07, 0.2, 0.03),
  scoutSpoiler: rbox(0.07, 0.02, 0.34, 0.008),
  scoutStrut: new BoxGeometry(0.03, 0.08, 0.03),
  mast: new CylinderGeometry(0.018, 0.022, 0.3, 14),
  scoutHead: new CapsuleGeometry(0.06, 0.08, 6, 16).rotateZ(Math.PI / 2),
  visor: rbox(0.03, 0.035, 0.1, 0.012),
  stripe: new BoxGeometry(0.34, 0.018, 0.004),
  tyre: cylZ(1, 1, 28),
  hub: cylZ(1, 1, 18),
  stud: new TorusGeometry(1, 0.08, 6, 28),
  fork: new BoxGeometry(0.03, 0.1, 0.1),

  track: rbox(0.64, 0.17, 0.12, 0.07),
  roadWheel: cylZ(0.05, 0.13, 18),
  hull: rbox(0.54, 0.18, 0.36, 0.04),
  glacis: new BoxGeometry(0.12, 0.02, 0.34),
  deck: rbox(0.34, 0.03, 0.3, 0.012),
  turret: rbox(0.3, 0.13, 0.26, 0.045),
  barrel: cylZ(0.022, 0.16, 14).rotateY(Math.PI / 2),
  eye: new SphereGeometry(0.022, 16, 12),
  shoulder: rbox(0.18, 0.05, 0.04, 0.015),

  thigh: new CapsuleGeometry(0.035, 0.11, 6, 14),
  foot: rbox(0.12, 0.04, 0.07, 0.015),
  pelvis: rbox(0.14, 0.06, 0.2, 0.025),
  torso: rbox(0.2, 0.24, 0.26, 0.06),
  chest: rbox(0.02, 0.1, 0.14, 0.01),
  core: new SphereGeometry(0.028, 16, 12),
  ball: new SphereGeometry(0.04, 16, 12),
  upperArm: new CapsuleGeometry(0.027, 0.1, 6, 12),
  hand: new SphereGeometry(0.032, 14, 10),
  bipedHead: rbox(0.19, 0.15, 0.2, 0.05),
  bipedVisor: rbox(0.02, 0.05, 0.15, 0.012),
  ear: cylZ(0.03, 0.03, 16),
};

/** A wheel whose look depends on the wheel style; the group spins about Z. */
function StyledWheel({ spin, r, width, mats, style, at }: { spin: RefObject<Group | null>; r: number; width: number; mats: PartMaterials; style: WheelStyleId; at: readonly [number, number, number] }) {
  const big = style === 'all-terrain' ? 1.12 : 1;
  const w = width * (style === 'all-terrain' ? 1.35 : 1);
  return (
    <group position={[at[0], at[1] * big, at[2]]}>
      <group ref={spin}>
        <mesh geometry={G.tyre} material={mats.wheels} scale={[r * big, r * big, w]} castShadow />
        <mesh geometry={G.hub} material={mats.trim} scale={[r * 0.55, r * 0.55, w * 1.04]} />
        {style === 'snow' &&
          [-0.3, 0.3].map((k) => <mesh key={k} geometry={G.stud} material={mats.body} rotation-x={0} position-z={k * w} scale={[r * 1.01, r * 1.01, r * 0.5]} />)}
        {style === 'all-terrain' && <mesh geometry={G.hub} material={mats.accent} scale={[r * 0.3, r * 0.3, w * 1.08]} />}
      </group>
    </group>
  );
}

/** SCOUT: low wedge, two big rear wheels + a front wheel, tall sensor mast. */
export const ScoutModel = memo(function ScoutModel({ mats, rig, wheelStyle }: ModelProps) {
  return (
    <group>
      <mesh geometry={G.scoutBody} material={mats.body} position={[0, 0.2, 0]} castShadow />
      <mesh geometry={G.scoutNose} material={mats.trim} position={[0.25, 0.17, 0]} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={G.stripe} material={mats.accent} position={[-0.02, 0.2, s * 0.151]} />
      ))}
      {/* Spoiler */}
      {[-0.1, 0.1].map((z) => (
        <mesh key={z} geometry={G.scoutStrut} material={mats.trim} position={[-0.23, 0.29, z]} />
      ))}
      <mesh geometry={G.scoutSpoiler} material={mats.accent} position={[-0.24, 0.335, 0]} rotation-z={0.08} castShadow />
      {/* Mast + sensor head */}
      <mesh geometry={G.mast} material={mats.trim} position={[-0.05, 0.42, 0]} castShadow />
      <group ref={rig.head} position={[-0.05, 0.62, 0]}>
        <mesh geometry={G.scoutHead} material={mats.head} castShadow />
        <mesh geometry={G.visor} material={mats.led} position={[0.1, 0, 0]} />
      </group>
      {/* Wheels: two big rear, one front on a fork */}
      {[-1, 1].map((s, i) => (
        <StyledWheel key={s} spin={rig.wheels[i]!} r={0.13} width={0.09} mats={mats} style={wheelStyle} at={[-0.14, 0.13, s * 0.2]} />
      ))}
      <mesh geometry={G.fork} material={mats.trim} position={[0.22, 0.1, 0]} />
      <StyledWheel spin={rig.wheels[2]!} r={0.075} width={0.06} mats={mats} style={wheelStyle} at={[0.22, 0.075, 0]} />
    </group>
  );
});

/** TANK: heavy hull on two tracks, sensor turret with twin eyes. */
export const TankModel = memo(function TankModel({ mats, rig, wheelStyle }: ModelProps) {
  const wide = wheelStyle === 'all-terrain' ? 1.2 : 1;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0.1, s * 0.24]}>
          <mesh geometry={G.track} material={mats.wheels} scale={[1, 1, wide]} castShadow />
          {[-0.22, -0.075, 0.075, 0.22].map((x, i) => (
            <group key={x} position={[x, 0, s * 0.02 * wide]}>
              <group ref={rig.wheels[(s > 0 ? 4 : 0) + i]!}>
                <mesh geometry={G.roadWheel} material={wheelStyle === 'snow' ? mats.body : mats.trim} />
              </group>
            </group>
          ))}
        </group>
      ))}
      <mesh geometry={G.hull} material={mats.body} position={[0, 0.27, 0]} castShadow />
      <mesh geometry={G.glacis} material={mats.accent} position={[0.26, 0.31, 0]} rotation-z={-0.7} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={G.shoulder} material={mats.accent} position={[0.02, 0.35, s * 0.19]} castShadow />
      ))}
      <mesh geometry={G.deck} material={mats.trim} position={[-0.05, 0.37, 0]} />
      <group ref={rig.head} position={[-0.02, 0.44, 0]}>
        <mesh geometry={G.turret} material={mats.head} castShadow />
        <mesh geometry={G.barrel} material={mats.trim} position={[0.2, -0.01, 0]} />
        {[-0.06, 0.06].map((z) => (
          <mesh key={z} geometry={G.eye} material={mats.led} position={[0.15, 0.025, z]} />
        ))}
      </group>
    </group>
  );
});

/** BIPED: humanoid helper — legs, torso with a chest core, waving arms, visor head. */
export const BipedModel = memo(function BipedModel({ mats, rig, wheelStyle }: ModelProps) {
  const boots = wheelStyle === 'snow' ? mats.body : mats.trim;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * 0.075]}>
          <mesh geometry={G.thigh} material={mats.wheels} position={[0, 0.2, 0]} castShadow />
          <mesh geometry={G.foot} material={boots} position={[0.02, 0.02, 0]} scale={wheelStyle === 'all-terrain' ? [1.15, 1.3, 1.15] : 1} castShadow />
        </group>
      ))}
      <mesh geometry={G.pelvis} material={mats.trim} position={[0, 0.34, 0]} castShadow />
      <mesh geometry={G.torso} material={mats.body} position={[0, 0.5, 0]} castShadow />
      <mesh geometry={G.chest} material={mats.accent} position={[0.1, 0.52, 0]} />
      <mesh geometry={G.core} material={mats.led} position={[0.108, 0.54, 0]} scale={[0.5, 1, 1]} />
      {([
        [-1, rig.armLeft],
        [1, rig.armRight],
      ] as const).map(([s, ref]) => (
        <group key={s} position={[0, 0.6, s * 0.17]}>
          <mesh geometry={G.ball} material={mats.trim} castShadow />
          <group ref={ref}>
            <mesh geometry={G.upperArm} material={mats.accent} position={[0, -0.1, s * 0.01]} castShadow />
            <mesh geometry={G.hand} material={mats.trim} position={[0, -0.2, s * 0.012]} castShadow />
          </group>
        </group>
      ))}
      <group ref={rig.head} position={[0, 0.72, 0]}>
        <mesh geometry={G.bipedHead} material={mats.head} position-y={0.05} castShadow />
        <mesh geometry={G.bipedVisor} material={mats.led} position={[0.095, 0.06, 0]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={G.ear} material={mats.trim} position={[0, 0.05, s * 0.1]} />
        ))}
      </group>
    </group>
  );
});
