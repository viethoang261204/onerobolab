import { useFrame } from '@react-three/fiber';
import { OBSTACLE_DISTANCE, Vec2Math, type LineSensorMount, type MapQuery, type RobotDefinition } from '@robolab/shared';
import { memo, useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, CircleGeometry, CylinderGeometry, type Group, type Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { useSettingsStore } from '../../settings/settings-store';
import { beamTexture } from '../environment/textures';
import type { RobotVisualSource } from './RobotTypes';

interface RobotSensorsProps {
  definition: RobotDefinition;
  source: RobotVisualSource;
  /** Used to show line detection until the Sensor Engine exists. */
  map: MapQuery;
}

const DEFAULT_RAY = 0.8;
/** Lateral spacing of the three line-sensor emitters (m). */
const LINE_SPREAD = 0.019;

/**
 * Sensor visualisation in robot space (metres, not design units):
 *   DistanceSensor – fading cyan cone + bright core ray
 *   LineSensor     – three short rays to the floor; floor dots light up over the track
 * (CameraSensor's field of view is drawn by RobotHead so it follows head motion.)
 *
 * Distance length comes from `source.state.sensors` when a reading exists;
 * line detection samples the map directly for now.
 */
export const RobotSensors = memo(function RobotSensors({ definition, source, map }: RobotSensorsProps) {
  const distanceMount = definition.sensors.find((s) => s.kind === 'distance');
  const lineMount = definition.sensors.find((s): s is LineSensorMount => s.kind === 'line');

  const res = useMemo(() => {
    const coneGeo = new CylinderGeometry(0.09, 0.004, 1, 24, 1, true).rotateZ(-Math.PI / 2).translate(0.5, 0, 0);
    const rayGeo = new CylinderGeometry(0.0025, 0.0025, 1, 6, 1, true).rotateZ(-Math.PI / 2).translate(0.5, 0, 0);
    const downGeo = new CylinderGeometry(0.0025, 0.0025, 1, 6, 1, true).translate(0, -0.5, 0);
    const dotGeo = new CircleGeometry(0.012, 16).rotateX(-Math.PI / 2);
    const beam = (opacity: number) =>
      new MeshBasicMaterial({ color: '#22d3ee', map: beamTexture(), transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });
    const dotMats = [0, 1, 2].map(() => new MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.5, depthWrite: false }));
    // Scrolling copy of the beam texture for the "travelling pulse" on the ray.
    const rayTex = beamTexture().clone();
    rayTex.needsUpdate = true;
    const rayMat = new MeshBasicMaterial({ color: '#22d3ee', map: rayTex, transparent: true, opacity: 0.75, blending: AdditiveBlending, depthWrite: false });
    const hitGeo = new SphereGeometry(0.012, 12, 8);
    const hitMat = new MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.9, depthWrite: false });
    return { coneGeo, rayGeo, downGeo, dotGeo, hitGeo, hitMat, rayTex, coneMat: beam(0.16), rayMat, downMat: beam(0.55), dotMats };
  }, []);
  useEffect(
    () => () => {
      [res.coneGeo, res.rayGeo, res.downGeo, res.dotGeo, res.hitGeo, res.hitMat, res.rayTex, res.coneMat, res.rayMat, res.downMat, ...res.dotMats].forEach((o) => o.dispose());
    },
    [res],
  );

  const distanceGroup = useRef<Group>(null);
  const dots = useRef<(Mesh | null)[]>([]);
  const hit = useRef<Mesh>(null);

  useFrame((frame, delta) => {
    const state = source.state;
    // Distance: stretch to the measured distance, or a default preview length.
    const reading = distanceMount ? state.sensors[distanceMount.id] : undefined;
    const measured = reading?.kind === 'distance' && reading.distance !== null ? reading.distance : null;
    const length = measured ?? DEFAULT_RAY;
    distanceGroup.current?.scale.set(length, 1, 1);
    // Warning state: amber when something is near, red when it's an obstacle.
    const tone = measured === null ? '#22d3ee' : measured < OBSTACLE_DISTANCE ? '#f43f5e' : measured < OBSTACLE_DISTANCE * 2 ? '#f59e0b' : '#22d3ee';
    res.coneMat.color.set(tone);
    res.rayMat.color.set(tone);
    res.hitMat.color.set(tone);
    if (hit.current) {
      hit.current.visible = measured !== null;
      hit.current.position.x = length;
      hit.current.scale.setScalar(1 + Math.sin(frame.clock.elapsedTime * 6) * 0.25);
    }
    if (!useSettingsStore.getState().reduceMotion) res.rayTex.offset.y = (res.rayTex.offset.y - delta * 1.4) % 1;

    // Line: brighten dots that sit over a painted line.
    if (lineMount) {
      for (let i = 0; i < 3; i++) {
        const local = { x: lineMount.offset.x, z: (i - 1) * LINE_SPREAD };
        const world = Vec2Math.localToWorld(state.pose, local);
        const on = map.surfaceAt(world).lineIntensity > 0.5;
        const mat = res.dotMats[i];
        if (mat) {
          mat.color.set(on ? '#4ade80' : '#22d3ee');
          mat.opacity = on ? 0.95 : 0.35;
        }
        dots.current[i]?.scale.setScalar(on ? 1.3 : 1);
      }
    }
  });

  return (
    <group>
      {distanceMount && (
        <group position={[distanceMount.offset.x, distanceMount.offset.y, distanceMount.offset.z]} rotation-y={distanceMount.yaw}>
          <group ref={distanceGroup}>
            <mesh geometry={res.coneGeo} material={res.coneMat} renderOrder={3} />
            <mesh geometry={res.rayGeo} material={res.rayMat} renderOrder={3} />
          </group>
          <mesh ref={hit} geometry={res.hitGeo} material={res.hitMat} renderOrder={4} />
        </group>
      )}
      {lineMount &&
        res.dotMats.map((dotMat, i) => (
          <group key={i} position={[lineMount.offset.x, 0, (i - 1) * LINE_SPREAD]}>
            <mesh geometry={res.downGeo} material={res.downMat} position-y={0.052} scale={[1, 0.047, 1]} renderOrder={3} />
            <mesh
              ref={(m) => {
                dots.current[i] = m;
              }}
              geometry={res.dotGeo}
              material={dotMat}
              position-y={0.006}
              renderOrder={3}
            />
          </group>
        ))}
    </group>
  );
});
