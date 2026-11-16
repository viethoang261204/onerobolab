import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { type PerspectiveCamera, Vector3 } from 'three';
import { useSettingsStore } from '../../settings/settings-store';

export interface CameraFocus {
  /** 'overview' = whole journey; 'selected' = lean towards a world. */
  readonly mode: 'overview' | 'selected';
  readonly point: { readonly x: number; readonly y: number; readonly z: number } | null;
}

interface WorldMapCameraProps {
  focus: CameraFocus;
  /** Centre of the whole route (overview target). */
  center: { x: number; z: number };
  /** Screen space covered by HTML panels (px), so the target lands in the visible area. */
  insets: { left: number; right: number };
}

/** View direction: from the front, looking down ~38°. */
const DIR = new Vector3(0, 0.6, 0.8).normalize();
const DIST = { overview: 32, selected: 26 } as const;
const PAN_LIMIT = { x: 9, z: 9 } as const;
const ZOOM_LIMIT = [0.62, 1.25] as const;

/**
 * Map camera: a fixed viewing angle (no free orbit), with gentle drag-to-pan
 * and wheel zoom inside limits. Selecting a world eases the view towards it;
 * entering a world flies in close. Reduced motion snaps instead of easing.
 */
export function WorldMapCamera({ focus, center, insets }: WorldMapCameraProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const pan = useRef({ x: 0, z: 0 });
  const zoom = useRef(1);
  const target = useRef(new Vector3(center.x, 0, center.z));
  const first = useRef(true);

  // A new focus recentres (drops manual pan) so the chosen world is in view.
  useEffect(() => {
    pan.current = { x: 0, z: 0 };
  }, [focus.mode, focus.point?.x, focus.point?.z]);

  // Drag = pan, wheel = zoom (both clamped).
  useEffect(() => {
    const el = gl.domElement;
    let drag: { x: number; y: number } | null = null;
    const unitsPerPx = () => (2 * camera.position.distanceTo(target.current) * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, el.clientHeight);
    const down = (e: PointerEvent) => {
      if (e.button === 0) drag = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const k = unitsPerPx();
      pan.current.x = Math.max(-PAN_LIMIT.x, Math.min(PAN_LIMIT.x, pan.current.x - (e.clientX - drag.x) * k));
      pan.current.z = Math.max(-PAN_LIMIT.z, Math.min(PAN_LIMIT.z, pan.current.z - (e.clientY - drag.y) * k * 1.3));
      drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      drag = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom.current = Math.max(ZOOM_LIMIT[0], Math.min(ZOOM_LIMIT[1], zoom.current * Math.exp(e.deltaY * 0.0012)));
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl, camera]);

  const desired = useRef(new Vector3());
  const desiredTarget = useRef(new Vector3());
  useFrame((_, delta) => {
    const p = focus.point;
    const dist = DIST[focus.mode] * zoom.current;
    const t = desiredTarget.current;
    // Selecting a world leans the view towards it (subtly — the journey stays in frame).
    if (focus.mode === 'selected' && p) t.set(center.x + (p.x - center.x) * 0.45, p.y * 0.5, center.z + (p.z - center.z) * 0.45);
    else t.set(center.x, 0, center.z);
    // Shift so the target sits in the middle of the area not covered by panels.
    const unitsPerPx = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, size.height);
    t.x += ((insets.right - insets.left) / 2) * unitsPerPx + pan.current.x;
    t.z += pan.current.z;
    desired.current.copy(t).addScaledVector(DIR, dist);

    const snap = first.current || useSettingsStore.getState().reduceMotion;
    first.current = false;
    const k = snap ? 1 : 1 - Math.exp(-3.2 * Math.min(delta, 0.1));
    target.current.lerp(t, k);
    camera.position.lerp(desired.current, k);
    camera.lookAt(target.current);
  });

  return null;
}
