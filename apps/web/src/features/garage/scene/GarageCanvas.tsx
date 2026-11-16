import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { type ComponentRef, useEffect, useMemo, useRef } from 'react';
import { NeutralToneMapping } from 'three';
import { DEFAULT_ROBOT_ID, getRobot } from '../../../data/content-registry';
import { QUALITY_DPR } from '../../settings/quality';
import { useSettingsStore } from '../../settings/settings-store';
import { seededRandom } from '../../simulator/environment/geometry';
import { PropBatch } from '../../simulator/environments/props/batch';
import { BatchMesh } from '../../simulator/environments/props/BatchMesh';
import { crate } from '../../simulator/environments/props/builders';
import { DESIGN } from '../../simulator/robot/RobotTypes';
import type { AnimationId, PartId, RobotConfiguration } from '../model/robot-config';
import { RobotAvatar } from '../render/RobotAvatar';

export interface GarageCanvasProps {
  config: RobotConfiguration;
  highlight: PartId | null;
  animation: AnimationId;
  autoRotate: boolean;
  /** Bumped by the page to reset the camera. */
  resetKey: number;
}

/** Robot size in the garage: design units → about two scene units tall. */
const ROBOT_SCALE = 1.95;
const TARGET: [number, number, number] = [0, 0.86, 0];
const CAMERA: [number, number, number] = [3.9, 2.2, 4.1];

/**
 * The workshop, kept quiet so the robot is the hero: a dark bay, a few
 * out-of-focus shelves and crates, two soft light strips — and the display
 * turntable under studio lights.
 */
function Workshop() {
  const props = useMemo(() => {
    const b = new PropBatch();
    const r = seededRandom(9);
    // Shelving along the back wall.
    for (const x of [-4.6, 4.6]) {
      for (const y of [0, 1.1, 2.2]) b.add('boxFloor', 'metalDark', { p: [x, y, -4.2], s: [2.4, 0.06, 0.8] }, false);
      for (const dx of [-1.15, 1.15]) b.add('boxFloor', 'metalDark', { p: [x + dx, 0, -4.2], s: [0.06, 2.6, 0.8] }, false);
      for (let i = 0; i < 5; i++) crate(b, x - 0.9 + i * 0.45, 1.16, -4.2, 0.36, r() * 0.3, i % 2 ? '#c98a4b' : '#475569');
    }
    // Crates and a tool cart near the floor edges.
    for (const [x, z] of [
      [-3.2, -1.6],
      [-3.6, -1.1],
      [3.4, -1.8],
    ] as const)
      crate(b, x, 0, z, 0.55, r() * 0.6, '#334155');
    b.add('boxFloor', 'tint', { p: [3.4, 0, -0.6], s: [0.9, 0.8, 0.5], color: '#1e293b' }, false);
    b.add('boxFloor', 'glowAmber', { p: [3.4, 0.62, -0.34], s: [0.8, 0.03, 0.02] }, false);
    return b;
  }, []);
  return (
    <group>
      {/* Floor and walls */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[14, 48]} />
        <meshStandardMaterial color="#141c30" roughness={0.85} metalness={0.1} />
      </mesh>
      <gridHelper args={[20, 40, '#22304d', '#1a2540']} position-y={0.002} />
      <mesh position={[0, 3.2, -5]}>
        <planeGeometry args={[24, 7]} />
        <meshStandardMaterial color="#0f1729" roughness={0.9} />
      </mesh>
      {[-1.6, 1.6].map((x) => (
        <mesh key={x} position={[x, 4.2, -4.97]}>
          <planeGeometry args={[2.6, 0.05]} />
          <meshBasicMaterial color="#38bdf8" toneMapped={false} />
        </mesh>
      ))}
      <BatchMesh batch={props} shadows={false} />
    </group>
  );
}

/** Display turntable: plinth, metal top, a single thin light ring. */
function Turntable() {
  return (
    <group>
      <mesh position-y={0.09} receiveShadow castShadow>
        <cylinderGeometry args={[1.2, 1.32, 0.18, 64]} />
        <meshStandardMaterial color="#1f2a44" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position-y={0.185} receiveShadow>
        <cylinderGeometry args={[1.1, 1.1, 0.012, 64]} />
        <meshStandardMaterial color="#2b3a5c" roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh position-y={0.1} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.24, 1.27, 72]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

/**
 * The garage viewer (lazy chunk): the student's robot on a turntable under
 * studio lighting. Drag rotates, scroll zooms, double-click resets; optional
 * slow auto-rotate.
 */
export default function GarageCanvas({ config, highlight, animation, autoRotate, resetKey }: GarageCanvasProps) {
  const quality = useSettingsStore((s) => s.quality);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const toMetres = useMemo(() => getRobot(DEFAULT_ROBOT_ID).wheelRadius / DESIGN.wheelRadius, []);
  const shadows = quality === 'high' ? 2048 : 1024;

  useEffect(() => {
    const c = controls.current;
    if (!c || resetKey === 0) return;
    c.object.position.set(...CAMERA);
    c.target.set(...TARGET);
    c.update();
  }, [resetKey]);

  return (
    <Canvas
      shadows={quality !== 'low'}
      dpr={QUALITY_DPR[quality]}
      gl={{ antialias: true, toneMapping: NeutralToneMapping }}
      camera={{ fov: 32, near: 0.1, far: 60, position: CAMERA }}
      onDoubleClick={() => {
        const c = controls.current;
        if (!c) return;
        c.object.position.set(...CAMERA);
        c.target.set(...TARGET);
        c.update();
      }}
      aria-label="Your robot in the garage. Drag to rotate, scroll to zoom, double-click to reset the view."
    >
      <color attach="background" args={['#0b1222']} />
      <fog attach="fog" args={['#0b1222', 7, 16]} />
      <hemisphereLight args={['#cfe0ff', '#1a2238', 0.9]} />
      {/* Key light (the only shadow caster), a cool rim and a warm fill. */}
      <directionalLight
        position={[3, 6, 4]}
        intensity={2.1}
        castShadow={quality !== 'low'}
        shadow-mapSize={[shadows, shadows]}
        shadow-bias={-0.0004}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
      />
      <directionalLight position={[-3, 3, -4]} intensity={1.2} color="#7fb2ff" />
      <pointLight position={[-2.2, 1.6, 2.4]} intensity={6} distance={7} color="#ffd9a8" />

      <Workshop />
      <Turntable />
      <group position-y={0.19} scale={ROBOT_SCALE / toMetres}>
        <RobotAvatar config={config} highlight={highlight} animation={animation} heading={-0.5} />
      </group>

      <OrbitControls
        ref={controls}
        target={TARGET}
        enablePan={false}
        minDistance={2.4}
        maxDistance={9}
        minPolarAngle={0.35}
        maxPolarAngle={1.48}
        autoRotate={autoRotate && !reduceMotion}
        autoRotateSpeed={0.8}
        enableDamping
      />
    </Canvas>
  );
}
