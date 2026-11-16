import { BoxGeometry, CircleGeometry, CylinderGeometry, ExtrudeGeometry, LatheGeometry, RingGeometry, Shape, SphereGeometry, TorusGeometry, Vector2 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DESIGN } from './RobotTypes';

/*
 * Shared robot geometry in design units (see DESIGN). Low-to-medium poly:
 * rounded boxes use 3 bevel segments, cylinders 24–32 sides.
 * Axis conventions: robot +X forward, +Y up, +Z right.
 */

const rbox = (x: number, y: number, z: number, radius: number, segments = 3) => new RoundedBoxGeometry(x, y, z, segments, radius);

/** Cylinder with its axis along X (for lenses and sensors facing forward). */
const cylX = (r: number, len: number, sides = 24) => new CylinderGeometry(r, r, len, sides).rotateZ(Math.PI / 2);
/** Cylinder with its axis along Z (axles, joints). */
const cylZ = (r: number, len: number, sides = 24) => new CylinderGeometry(r, r, len, sides).rotateX(Math.PI / 2);

/** Tyre: rounded rectangular profile revolved around the axle (Z). */
function tyreGeometry() {
  const R = DESIGN.wheelRadius;
  const r = R * 0.64;
  const w = DESIGN.wheelWidth / 2;
  const bevel = 0.03;
  const pts: Vector2[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 5; i++) {
      const a = a0 + (i / 5) * (Math.PI / 2);
      pts.push(new Vector2(cx + Math.cos(a) * bevel, cy + Math.sin(a) * bevel));
    }
  };
  pts.push(new Vector2(r, -w));
  corner(R - bevel, -w + bevel, -Math.PI / 2);
  corner(R - bevel, w - bevel, 0);
  pts.push(new Vector2(r, w));
  // Lathe revolves around Y; rotate so the axle is Z.
  return new LatheGeometry(pts, 36).rotateX(Math.PI / 2);
}

/** Arched mudguard hugging the top of a wheel: extruded ring sector along the axle (Z). */
function fenderGeometry() {
  const inner = DESIGN.wheelRadius + 0.016;
  const outer = inner + 0.022;
  const a0 = (32 * Math.PI) / 180;
  const a1 = Math.PI - a0;
  const shape = new Shape();
  shape.absarc(0, 0, outer, a0, a1, false);
  shape.absarc(0, 0, inner, a1, a0, true);
  shape.closePath();
  const depth = DESIGN.wheelWidth + 0.004;
  const geo = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 20 });
  return geo.translate(0, 0, -depth / 2);
}

export const RG = {
  // body
  chassis: rbox(0.66, 0.15, 0.38, 0.05),
  shell: rbox(0.58, 0.25, 0.42, 0.085, 4),
  deck: rbox(0.4, 0.05, 0.36, 0.022),
  hood: rbox(0.2, 0.05, 0.3, 0.022),
  sidePanel: rbox(0.2, 0.15, 0.024, 0.012),
  fender: fenderGeometry(),
  deckVent: rbox(0.012, 0.008, 0.16, 0.004, 1),
  bezel: rbox(0.03, 0.13, 0.3, 0.02),
  screen: rbox(0.012, 0.1, 0.26, 0.014),
  bumper: rbox(0.07, 0.075, 0.44, 0.03),
  ledBar: rbox(0.016, 0.026, 0.24, 0.011),
  rearPanel: rbox(0.03, 0.13, 0.3, 0.018),
  vent: new BoxGeometry(0.006, 0.012, 0.2),
  port: rbox(0.014, 0.03, 0.05, 0.006, 2),
  lineModule: rbox(0.07, 0.022, 0.14, 0.008, 2),
  sonarPod: cylX(0.02, 0.022, 20),
  sonarRing: new TorusGeometry(0.02, 0.0035, 6, 20).rotateY(Math.PI / 2),
  screw: cylZ(0.007, 0.006, 8),
  emblemHex: new RingGeometry(0.03, 0.042, 6),
  emblemCore: new CircleGeometry(0.013, 4),
  /** LED "eye": upward arch (∩) facing +X. */
  eye: new TorusGeometry(0.022, 0.0068, 8, 18, Math.PI).rotateY(Math.PI / 2),
  dot: new SphereGeometry(0.006, 8, 6),

  // head
  neckBase: new CylinderGeometry(0.07, 0.078, 0.03, 28),
  arm: rbox(0.075, 0.13, 0.075, 0.025),
  joint: cylZ(0.042, 0.1, 24),
  jointCap: cylZ(0.03, 0.104, 20),
  housing: rbox(0.17, 0.135, 0.17, 0.045, 4),
  headCap: rbox(0.12, 0.028, 0.13, 0.012),
  lensSurround: new CylinderGeometry(0.058, 0.064, 0.045, 32).rotateZ(Math.PI / 2),
  lensGlass: new CylinderGeometry(0.046, 0.046, 0.012, 32).rotateZ(Math.PI / 2),
  lensGlow: new CircleGeometry(0.033, 32).rotateY(Math.PI / 2),
  pupil: new CircleGeometry(0.013, 20).rotateY(Math.PI / 2),
  glint: new CircleGeometry(0.007, 12).rotateY(Math.PI / 2),
  sideSensor: rbox(0.055, 0.04, 0.03, 0.01, 2),

  // wheels
  tyre: tyreGeometry(),
  /** Tread lug: local X is radial after placement, Y tangential. */
  lug: new BoxGeometry(0.02, 0.034, DESIGN.wheelWidth * 0.84),
  sideLed: rbox(0.12, 0.012, 0.012, 0.005, 2),
  hub: cylZ(DESIGN.wheelRadius * 0.64, DESIGN.wheelWidth * 0.86, 28),
  hubRing: new TorusGeometry(DESIGN.wheelRadius * 0.46, 0.008, 8, 36),
  hubCap: cylZ(DESIGN.wheelRadius * 0.26, 0.02, 6),
  hubBolt: cylZ(0.008, 0.012, 6),
} as const;
