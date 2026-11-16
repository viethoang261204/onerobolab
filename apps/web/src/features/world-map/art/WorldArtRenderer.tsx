import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { NeutralToneMapping } from 'three';
import { WorldRegistry } from '../../../content/worlds/registry';
import { WorldIsland } from '../components/WorldIsland';
import { useWorldArtStore } from './world-art-store';

const W = 560;
const H = 400;
const SETTLE_FRAMES = 6;

function Capture({ artKey }: { artKey: string }) {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  const sent = useRef(false);
  useFrame(() => {
    if (sent.current || ++frames.current < SETTLE_FRAMES) return;
    sent.current = true;
    let url: string | null = null;
    try {
      url = gl.domElement.toDataURL('image/png');
    } catch {
      url = null;
    }
    useWorldArtStore.getState().done(artKey, url);
  });
  return null;
}

/**
 * Off-screen renderer for world artwork (lazy; mounted only while artwork is
 * queued). One island at a time, three-quarter view, transparent background,
 * warm key light — the card supplies its own backdrop.
 */
export default function WorldArtRenderer() {
  const current = useWorldArtStore((s) => s.queue[0]);
  const [worldId, state] = current?.split(':') ?? [];
  const world = worldId ? WorldRegistry.get(worldId) : undefined;
  useEffect(() => {
    if (current && !world) useWorldArtStore.getState().done(current, null);
  }, [current, world]);
  if (!current || !world) return null;
  const p = world.mapPosition;
  return (
    <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: W, height: H, pointerEvents: 'none' }}>
      <Canvas
        key={current}
        dpr={1}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, toneMapping: NeutralToneMapping }}
        camera={{ fov: 30, near: 0.1, far: 60, position: [3.7, 3.4, 5.1] }}
        onCreated={({ camera }) => camera.lookAt(0, -0.45, 0)}
        style={{ width: W, height: H }}
      >
        <hemisphereLight args={['#dbe8ff', '#2a3560', 1.15]} />
        <directionalLight position={[5, 9, 6]} intensity={2.1} color="#fff1dc" />
        <directionalLight position={[-6, 3, -5]} intensity={0.7} color="#9fb8ff" />
        {/* The island sits at its map position; bring it to the origin. */}
        <group position={[-p.x, -p.y, -p.z]}>
          <WorldIsland world={world} locked={state === 'locked'} interactive={false} pad={false} />
        </group>
        <Capture artKey={current} />
      </Canvas>
    </div>
  );
}
