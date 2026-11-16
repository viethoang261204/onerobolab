import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { NeutralToneMapping } from 'three';
import { LevelRegistry } from '../../../content/levels/registry';
import type { LevelDefinition } from '../../../content/levels/types';
import { EnvironmentScene } from '../../simulator/environments/EnvironmentScene';
import { ShowcaseRobot } from '../../world-map/components/ShowcaseRobot';
import { levelMapQuery } from '../level-info';
import { usePreviewStore } from './preview-store';

const W = 480;
const H = 300;
/** Frames to let the scene settle (reflection bake, shadows) before capturing. */
const SETTLE_FRAMES = 8;

/** Captures the canvas after a few frames and reports the image. */
function Capture({ levelId }: { levelId: string }) {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  const sent = useRef(false);
  useFrame(() => {
    if (sent.current) return;
    frames.current++;
    if (frames.current < SETTLE_FRAMES) return;
    sent.current = true;
    let url: string | null = null;
    try {
      url = gl.domElement.toDataURL('image/jpeg', 0.82);
    } catch {
      url = null;
    }
    usePreviewStore.getState().done(levelId, url);
  });
  return null;
}

function PreviewCamera({ level }: { level: LevelDefinition }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const span = Math.max(level.map.size.x, level.map.size.z);
    const s = level.map.start;
    camera.position.set(s.x - span * 0.28, span * 0.52, s.z + span * 0.72);
    camera.lookAt(s.x * 0.4, 0, s.z * 0.4);
  }, [camera, level]);
  return null;
}

/**
 * Off-screen renderer for environment previews. Mounted only while previews
 * are queued; renders one level at a time with the same `EnvironmentScene`
 * the simulator uses (no particles), then unmounts.
 */
export default function PreviewRenderer() {
  const current = usePreviewStore((s) => s.queue[0]);
  const level = current ? LevelRegistry.get(current) : undefined;
  useEffect(() => {
    if (current && !level) usePreviewStore.getState().done(current, null);
  }, [current, level]);
  if (!level) return null;
  const map = levelMapQuery(level);
  const start = level.map.start;
  return (
    <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: W, height: H, pointerEvents: 'none' }}>
      <Canvas
        key={level.id}
        dpr={1}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: NeutralToneMapping }}
        camera={{ fov: 38, near: 0.05, far: 200 }}
        shadows="soft"
        style={{ width: W, height: H }}
      >
        <EnvironmentScene level={level} map={map} quality="medium" reduceMotion preview />
        <group position={[start.x, 0, start.z]}>
          <ShowcaseRobot loopRadius={0} scale={1} heading={start.heading} />
        </group>
        <PreviewCamera level={level} />
        <Capture levelId={level.id} />
      </Canvas>
    </div>
  );
}
