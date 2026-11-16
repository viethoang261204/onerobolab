import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { MapDefinition } from '@robolab/shared';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, type InstancedMesh, Matrix4, MeshBasicMaterial, OctahedronGeometry, Quaternion, Vector3 } from 'three';
import type { Quality } from '../../settings/settings-store';
import { effectsBus } from './effects-bus';

const POOL = 72;
const LIFE = 0.9;

interface Particle {
  alive: boolean;
  age: number;
  pos: Vector3;
  vel: Vector3;
  color: Color;
}

/**
 * Lightweight one-shot particle bursts (checkpoint reached, goal) from a
 * fixed pool rendered as ONE instanced mesh, plus a few ambient sparkles.
 * Nothing runs while no particle is alive. Disabled on Low quality and
 * reduced motion.
 */
export function Effects({ quality, reduceMotion, map }: { quality: Quality; reduceMotion: boolean; map: MapDefinition }) {
  const mesh = useRef<InstancedMesh>(null);
  const particles = useRef<Particle[]>(Array.from({ length: POOL }, () => ({ alive: false, age: 0, pos: new Vector3(), vel: new Vector3(), color: new Color() })));
  const active = useRef(0);
  const { geo, mat } = useMemo(
    () => ({ geo: new OctahedronGeometry(0.018, 0), mat: new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }) }),
    [],
  );
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);

  const enabled = quality !== 'low' && !reduceMotion;

  useEffect(() => {
    if (!enabled) return;
    return effectsBus.on((e) => {
      const n = Math.min(e.count ?? 26, POOL);
      let spawned = 0;
      for (const p of particles.current) {
        if (p.alive) continue;
        const a = Math.random() * Math.PI * 2;
        const up = 0.6 + Math.random() * 0.9;
        const out = 0.3 + Math.random() * 0.5;
        p.alive = true;
        p.age = 0;
        p.pos.set(e.x, 0.08, e.z);
        p.vel.set(Math.cos(a) * out, up, Math.sin(a) * out);
        p.color.set(e.color);
        active.current++;
        if (++spawned >= n) break;
      }
    });
  }, [enabled]);

  const m = useRef(new Matrix4());
  const q = useRef(new Quaternion());
  const s = useRef(new Vector3());
  useFrame((_, delta) => {
    const im = mesh.current;
    if (!im || active.current === 0) return;
    const dt = Math.min(delta, 0.05);
    let alive = 0;
    particles.current.forEach((p, i) => {
      if (p.alive) {
        p.age += dt;
        if (p.age >= LIFE) {
          p.alive = false;
          active.current--;
        } else {
          p.vel.y -= 2.2 * dt;
          p.pos.addScaledVector(p.vel, dt);
          alive++;
        }
      }
      const k = p.alive ? 1 - p.age / LIFE : 0;
      s.current.setScalar(k * 1.4);
      im.setMatrixAt(i, m.current.compose(p.pos, q.current, s.current));
      im.setColorAt(i, p.color);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    if (alive === 0) active.current = 0;
  });

  const sparkles = quality === 'high' ? 50 : quality === 'medium' ? 26 : 0;
  return (
    <>
      <instancedMesh ref={mesh} args={[geo, mat, POOL]} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(POOL * 3).fill(1), 3]} />
      </instancedMesh>
      {sparkles > 0 && (
        <Sparkles count={sparkles} scale={[map.size.x, 1.2, map.size.z]} position={[0, 0.7, 0]} size={2.2} speed={reduceMotion ? 0 : 0.25} opacity={0.5} color="#bfefff" />
      )}
    </>
  );
}
