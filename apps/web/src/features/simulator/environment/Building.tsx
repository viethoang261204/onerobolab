import { useFrame } from '@react-three/fiber';
import { memo, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import type { Triple } from './Instanced';
import { MAT } from './materials';
import { GEO } from './shapes';

export type BuildingVariant = 'controlTower' | 'commTower' | 'terminal' | 'supplyStation' | 'skyTower' | 'ringGate' | 'beacon';

interface BuildingProps {
  variant: BuildingVariant;
  position: Triple;
  rotation?: number;
  scale?: number;
  /** Background buildings skip shadow casting. */
  castShadow?: boolean;
}

/** Slowly spinning child group (holograms, dishes). */
function Spinner({ speed, children, y = 0 }: { speed: number; children: ReactNode; y?: number }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed;
  });
  return (
    <group ref={ref} position-y={y}>
      {children}
    </group>
  );
}

function ControlTower({ cs }: { cs: boolean }) {
  return (
    <>
      <mesh geometry={GEO.cylinderFloor} material={MAT.metal} scale={[0.5, 0.2, 0.5]} castShadow={cs} receiveShadow />
      <mesh geometry={GEO.cylinderFloor} material={MAT.white} scale={[0.3, 1.1, 0.3]} castShadow={cs} />
      <mesh geometry={GEO.cylinderFloor} material={MAT.cyanGlow} scale={[0.31, 0.04, 0.31]} position-y={0.55} />
      <mesh geometry={GEO.cylinderFloor} material={MAT.white} scale={[0.62, 0.08, 0.62]} position-y={1.1} castShadow={cs} />
      <mesh geometry={GEO.cylinderFloor} material={MAT.glass} scale={[0.56, 0.2, 0.56]} position-y={1.18} castShadow={cs} />
      <mesh geometry={GEO.cylinderFloor} material={MAT.white} scale={[0.66, 0.06, 0.66]} position-y={1.38} castShadow={cs} />
      <mesh geometry={GEO.coneFloor} material={MAT.metal} scale={[0.5, 0.18, 0.5]} position-y={1.44} />
      <mesh geometry={GEO.cylinderFloor} material={MAT.metalDark} scale={[0.02, 0.35, 0.02]} position-y={1.6} />
      <mesh geometry={GEO.sphere} material={MAT.purpleGlow} scale={0.06} position-y={1.97} />
    </>
  );
}

function CommTower({ cs }: { cs: boolean }) {
  return (
    <>
      <mesh geometry={GEO.hexFloor} material={MAT.metal} scale={[0.34, 0.12, 0.34]} castShadow={cs} receiveShadow />
      <mesh geometry={GEO.coneFloor} material={MAT.white} scale={[0.2, 1.8, 0.2]} castShadow={cs} />
      <mesh geometry={GEO.torus} material={MAT.cyanGlow} scale={0.18} rotation-x={Math.PI / 2} position-y={0.7} />
      <mesh geometry={GEO.torus} material={MAT.cyanGlow} scale={0.13} rotation-x={Math.PI / 2} position-y={1.1} />
      <Spinner speed={0.4} y={1.25}>
        <mesh geometry={GEO.sphere} material={MAT.white} scale={[0.26, 0.26, 0.08]} position={[0.1, 0, 0]} rotation-y={Math.PI / 2} castShadow={cs} />
      </Spinner>
      <mesh geometry={GEO.sphere} material={MAT.purpleGlow} scale={0.05} position-y={1.82} />
    </>
  );
}

function Terminal({ cs }: { cs: boolean }) {
  return (
    <>
      <mesh geometry={GEO.boxFloor} material={MAT.metal} scale={[0.2, 0.03, 0.26]} castShadow={cs} receiveShadow />
      <mesh geometry={GEO.boxFloor} material={MAT.white} scale={[0.12, 0.22, 0.18]} castShadow={cs} />
      <mesh geometry={GEO.box} material={MAT.metalDark} scale={[0.02, 0.14, 0.22]} position={[0.07, 0.3, 0]} rotation-z={0.35} castShadow={cs} />
      <mesh geometry={GEO.box} material={MAT.cyanGlow} scale={[0.006, 0.11, 0.18]} position={[0.083, 0.305, 0]} rotation-z={0.35} />
      <mesh geometry={GEO.boxFloor} material={MAT.cyanGlow} scale={[0.125, 0.012, 0.185]} position-y={0.08} />
    </>
  );
}

function SupplyStation({ cs }: { cs: boolean }) {
  return (
    <>
      <mesh geometry={GEO.boxFloor} material={MAT.white} scale={[0.9, 0.5, 0.7]} castShadow={cs} receiveShadow />
      <mesh geometry={GEO.boxFloor} material={MAT.metal} scale={[0.96, 0.06, 0.76]} position-y={0.5} castShadow={cs} />
      <mesh geometry={GEO.boxFloor} material={MAT.metalDark} scale={[0.02, 0.34, 0.44]} position={[-0.45, 0, 0]} />
      <mesh geometry={GEO.boxFloor} material={MAT.cyanGlow} scale={[0.022, 0.025, 0.46]} position={[-0.45, 0.36, 0]} />
      <mesh geometry={GEO.boxFloor} material={MAT.blueGlow} scale={[0.02, 0.05, 0.7]} position={[-0.45, 0.43, 0]} />
      {/* rooftop crane */}
      <mesh geometry={GEO.boxFloor} material={MAT.yellow} scale={[0.05, 0.4, 0.05]} position={[0.3, 0.56, 0.22]} castShadow={cs} />
      <mesh geometry={GEO.box} material={MAT.yellow} scale={[0.55, 0.04, 0.04]} position={[0.1, 0.96, 0.22]} castShadow={cs} />
      <mesh geometry={GEO.cylinder} material={MAT.metalDark} scale={[0.008, 0.2, 0.008]} position={[-0.15, 0.86, 0.22]} />
    </>
  );
}

function SkyTower({ cs }: { cs: boolean }) {
  return (
    <>
      <mesh geometry={GEO.cylinderFloor} material={MAT.white} scale={[1.4, 1.2, 1.4]} castShadow={cs} />
      <mesh geometry={GEO.cylinderFloor} material={MAT.white} scale={[0.8, 6, 0.8]} castShadow={cs} />
      {[1.8, 3.2, 4.6].map((y) => (
        <mesh key={y} geometry={GEO.cylinderFloor} material={MAT.cyanGlow} scale={[0.86, 0.14, 0.86]} position-y={y} />
      ))}
      <mesh geometry={GEO.cylinderFloor} material={MAT.glass} scale={[1.6, 0.7, 1.6]} position-y={6} />
      <mesh geometry={GEO.cylinderFloor} material={MAT.white} scale={[1.8, 0.14, 1.8]} position-y={6.7} />
      <mesh geometry={GEO.coneFloor} material={MAT.metal} scale={[0.5, 2.4, 0.5]} position-y={6.84} />
      <mesh geometry={GEO.sphere} material={MAT.purpleGlow} scale={0.2} position-y={9.3} />
    </>
  );
}

function RingGate({ cs }: { cs: boolean }) {
  return (
    <>
      <mesh geometry={GEO.boxFloor} material={MAT.metal} scale={[1.6, 0.4, 0.8]} castShadow={cs} />
      <mesh geometry={GEO.torus} material={MAT.white} scale={[4, 4, 3]} position-y={2.3} castShadow={cs} />
      <mesh geometry={GEO.torus} material={MAT.energy} scale={[3.6, 3.6, 1.5]} position-y={2.3} />
    </>
  );
}

function Beacon() {
  return (
    <>
      <mesh geometry={GEO.cylinderFloor} material={MAT.metal} scale={[0.14, 0.04, 0.14]} />
      <mesh geometry={GEO.cylinderFloor} material={MAT.white} scale={[0.03, 0.34, 0.03]} />
      <Spinner speed={1.2} y={0.42}>
        <mesh geometry={GEO.octa} material={MAT.blueGlow} scale={[0.1, 0.14, 0.1]} />
        <mesh geometry={GEO.torus} material={MAT.cyanGlow} scale={0.2} rotation-x={Math.PI / 2} />
      </Spinner>
    </>
  );
}

/** Stylised futuristic structures built from shared primitives. */
export const Building = memo(function Building({ variant, position, rotation = 0, scale = 1, castShadow = true }: BuildingProps) {
  const cs = castShadow;
  return (
    <group position={position} rotation-y={rotation} scale={scale}>
      {variant === 'controlTower' && <ControlTower cs={cs} />}
      {variant === 'commTower' && <CommTower cs={cs} />}
      {variant === 'terminal' && <Terminal cs={cs} />}
      {variant === 'supplyStation' && <SupplyStation cs={cs} />}
      {variant === 'skyTower' && <SkyTower cs={cs} />}
      {variant === 'ringGate' && <RingGate cs={cs} />}
      {variant === 'beacon' && <Beacon />}
    </group>
  );
});
