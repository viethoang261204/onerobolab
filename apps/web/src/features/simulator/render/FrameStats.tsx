import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh, Object3D } from 'three';
import { useUiStore } from '../../../stores/ui-store';

const SAMPLE_SECONDS = 0.5;

declare global {
  interface Window {
    /** Dev-only renderer stats for performance checks (draw calls, triangles). */
    __onerobolabRenderInfo?: { calls: number; triangles: number; geometries: number; textures: number; programs: number };
    /** Dev-only: triangles per mesh group (geometry type × material), largest first — finds what blows the budget. */
    __onerobolabTriangleReport?: () => readonly { name: string; triangles: number; shadow: boolean }[];
  }
}

/** Publishes FPS to the store twice per second (not per frame) to avoid re-renders. */
export function FrameStats() {
  const setFps = useUiStore((s) => s.setFps);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const acc = useRef({ frames: 0, time: 0 });

  useFrame((_, delta) => {
    const a = acc.current;
    a.frames += 1;
    a.time += delta;
    if (a.time >= SAMPLE_SECONDS) {
      setFps(Math.round(a.frames / a.time));
      a.frames = 0;
      a.time = 0;
      if (import.meta.env.DEV) {
        window.__onerobolabTriangleReport = () => triangleReport(scene);
        const { render, memory, programs } = gl.info;
        window.__onerobolabRenderInfo = {
          calls: render.calls,
          triangles: render.triangles,
          geometries: memory.geometries,
          textures: memory.textures,
          programs: programs?.length ?? 0,
        };
      }
    }
  });

  return null;
}

/** Triangles drawn per mesh (instanced meshes × instance count), grouped by geometry and material type. */
function triangleReport(root: Object3D) {
  const groups = new Map<string, { name: string; triangles: number; shadow: boolean }>();
  root.traverseVisible((o) => {
    const m = o as Mesh & { isInstancedMesh?: boolean; count?: number };
    if (!m.isMesh || !m.geometry) return;
    const g = m.geometry;
    const tris = (g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3;
    const n = m.isInstancedMesh ? (m.count ?? 1) : 1;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    const name = `${g.type}:${tris}|${mat?.type ?? '?'}${m.castShadow ? '|shadow' : ''}`;
    const e = groups.get(name) ?? { name, triangles: 0, shadow: m.castShadow };
    e.triangles += tris * n;
    groups.set(name, e);
  });
  return [...groups.values()].sort((a, b) => b.triangles - a.triangles);
}
