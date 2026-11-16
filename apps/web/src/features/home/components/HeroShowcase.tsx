import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { type Group, NeutralToneMapping } from 'three';
import { WorldRegistry } from '../../../content/worlds/registry';
import { QUALITY_DPR } from '../../settings/quality';
import { useSettingsStore } from '../../settings/settings-store';
import { RobotAvatar } from '../../garage/render/RobotAvatar';
import { usePersonalRobot } from '../../garage/state/robot-store';
import { WorldIsland } from '../../world-map/components/WorldIsland';


/** The student's own robot (garage), playing its chosen animation. */
function PersonalRobot() {
  const robot = usePersonalRobot();
  return <RobotAvatar config={robot} heading={-0.6} />;
}

/** Slow turntable (paused with reduced motion). */
function Turntable({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current && !useSettingsStore.getState().reduceMotion) ref.current.rotation.y += Math.min(delta, 0.1) * 0.12;
  });
  return <group ref={ref}>{children}</group>;
}

/**
 * Hero 3D showcase: the Starter Island (same component as the world map)
 * with the real UI 3 robot driving on it. Transparent canvas over the hero
 * gradient; rendering pauses while scrolled out of view.
 */
export default function HeroShowcase() {
  const quality = useSettingsStore((s) => s.quality);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const world = WorldRegistry.first();
  const p = world.mapPosition;
  return (
    <div ref={host} className="h-full w-full" aria-label="Rover on Starter Island" role="img">
      <Canvas
        dpr={QUALITY_DPR[quality]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: NeutralToneMapping }}
        camera={{ fov: 30, near: 0.1, far: 60, position: [5.2, 3.6, 6.4] }}
        onCreated={({ camera }) => camera.lookAt(0, -0.35, 0)}
      >
        <hemisphereLight args={['#d6e6ff', '#2a2f5a', 1.2]} />
        <directionalLight position={[5, 9, 6]} intensity={2} color="#fff3e0" />
        <directionalLight position={[-6, 3, -4]} intensity={0.6} color="#8b9cff" />
        <Turntable>
          {/* The island component is positioned for the map; centre it here. */}
          <group position={[-p.x, -p.y, -p.z]}>
            <WorldIsland world={world} locked={false} interactive={false}>
              <group scale={2.4}>
                <PersonalRobot />
              </group>
            </WorldIsland>
          </group>
        </Turntable>
      </Canvas>
    </div>
  );
}
