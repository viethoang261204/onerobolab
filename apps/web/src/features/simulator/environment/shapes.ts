import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';

/**
 * Shared unit geometries, scaled per mesh/instance. Low-poly by design;
 * one GPU buffer each for the whole world.
 */
export const GEO = {
  box: new BoxGeometry(1, 1, 1),
  /** Unit box resting on y = 0 (height 1). */
  boxFloor: new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cylinder: new CylinderGeometry(0.5, 0.5, 1, 16),
  cylinderFloor: new CylinderGeometry(0.5, 0.5, 1, 16).translate(0, 0.5, 0),
  cylinderLow: new CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0),
  hexFloor: new CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0),
  coneFloor: new ConeGeometry(0.5, 1, 12).translate(0, 0.5, 0),
  coneLow: new ConeGeometry(0.5, 1, 7).translate(0, 0.5, 0),
  sphere: new SphereGeometry(0.5, 20, 14),
  icosa: new IcosahedronGeometry(0.5, 0),
  puff: new IcosahedronGeometry(0.5, 1),
  dodeca: new DodecahedronGeometry(0.5, 0),
  octa: new OctahedronGeometry(0.5, 0),
  disc: new CircleGeometry(0.5, 40).rotateX(-Math.PI / 2),
  ring: new RingGeometry(0.42, 0.5, 48).rotateX(-Math.PI / 2),
  torus: new TorusGeometry(0.5, 0.06, 10, 48),
  /** Open-ended cylinder for light beams (base at y = 0). */
  beam: new CylinderGeometry(0.5, 0.5, 1, 32, 1, true).translate(0, 0.5, 0),
} as const;
