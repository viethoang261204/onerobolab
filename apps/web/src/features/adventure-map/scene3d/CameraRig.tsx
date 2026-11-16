import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import type { PerspectiveCamera } from 'three';
import { useSettingsStore } from '../../settings/settings-store';
import type { AdventureLayout, Pt } from '../adventure.types';
import { approach, cameraPosition, clampCam, FOCUS_DISTANCE, overviewDistance, panBy, unitsPerPixel, zoomBy, type CamState } from '../camera';

/** Camera controls the page uses (sidebar "Continue", map buttons). */
export interface MapCamera {
  /** Fly to a map point; `zoom` > 1 comes closer (default: the focus distance). */
  focus: (p: Pt, zoom?: number) => void;
  zoomBy: (factor: number) => void;
  /** The whole island in view. */
  overview: () => void;
}

/** Where the rig publishes its controls. */
export interface CameraHandle {
  current: MapCamera | null;
}

interface CameraRigProps {
  layout: AdventureLayout;
  /** Where the camera opens (the current mission). */
  start: Pt;
  /** Element that receives drag / wheel / keys (the map viewport, including the marker layer). */
  surface: RefObject<HTMLDivElement | null>;
  api: CameraHandle;
  /** Pixels covered by the HUD on the left: the target centres in the rest. */
  inset: number;
  /** Ground height (the camera looks at the terrain under the target). */
  heightAt: (x: number, z: number) => number;
}

const DRAG_THRESHOLD = 5;

/**
 * Fixed-angle camera over the island: drag pans, wheel / pinch zooms towards
 * the pointer, arrow keys and +/- work on the focused map. Moves ease in the
 * frame loop (snap with reduced motion); nothing goes through React state.
 */
export function CameraRig({ layout, start, surface, api, inset, heightAt }: CameraRigProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const b = layout.bounds;
  // Arrive a little further out, then settle in ("zooming into the world").
  const cur = useRef<CamState>(clampCam({ x: start.x, z: start.y, distance: FOCUS_DISTANCE * 1.45 }, b));
  const goal = useRef<CamState>(clampCam({ x: start.x, z: start.y, distance: FOCUS_DISTANCE }, b));
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const lookY = useRef(Math.max(0, heightAt(start.x, start.y)));
  const insetRef = useRef(inset);
  insetRef.current = inset;

  useEffect(() => {
    api.current = {
      focus: (p, zoom = 1) => {
        goal.current = clampCam({ x: p.x, z: p.y, distance: FOCUS_DISTANCE / zoom }, b);
      },
      zoomBy: (f) => {
        goal.current = zoomBy(goal.current, f, { x: 0, y: 0 }, sizeRef.current, b);
      },
      overview: () => {
        goal.current = clampCam({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 + 1.5, distance: overviewDistance(sizeRef.current, b) }, b);
      },
    };
    // Dev only: lets QA scripts and the debug overlay drive the camera.
    if (import.meta.env.DEV) (window as unknown as { __onerobolabMapCamera?: MapCamera | null }).__onerobolabMapCamera = api.current;
    return () => {
      api.current = null;
    };
  }, [api, b]);

  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let last: { x: number; y: number } | null = null;
    let pinch = 0;
    let dragging = false;
    let downAt: { x: number; y: number } | null = null;

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return; // markers and controls click normally
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last = { x: e.clientX, y: e.clientY };
      downAt = last;
      if (pointers.size === 2) {
        const [p, q] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        pinch = Math.hypot(p.x - q.x, p.y - q.y);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [p, q] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (pinch > 0) {
          const next = zoomBy(cur.current, d / pinch, { x: 0, y: 0 }, sizeRef.current, b);
          cur.current = goal.current = next;
        }
        pinch = d;
        return;
      }
      if (!last || !downAt) return;
      if (!dragging && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        el.setPointerCapture(e.pointerId);
        el.dataset.dragging = '1';
      }
      const next = panBy(cur.current, e.clientX - last.x, e.clientY - last.y, sizeRef.current, b);
      cur.current = goal.current = next;
      last = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        last = null;
        downAt = null;
        dragging = false;
        delete el.dataset.dragging;
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      // Measured from where the target is drawn (the centre of the area right of the HUD).
      const anchor = { x: e.clientX - r.left - r.width / 2 - insetRef.current / 2, y: e.clientY - r.top - r.height / 2 };
      goal.current = zoomBy(goal.current, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0013)), anchor, sizeRef.current, b);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== el) return;
      const step = 60;
      const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      const m = moves[e.key];
      if (m) {
        e.preventDefault();
        goal.current = panBy(goal.current, m[0], m[1], sizeRef.current, b);
      } else if (e.key === '+' || e.key === '=') goal.current = zoomBy(goal.current, 1.25, { x: 0, y: 0 }, sizeRef.current, b);
      else if (e.key === '-' || e.key === '_') goal.current = zoomBy(goal.current, 0.8, { x: 0, y: 0 }, sizeRef.current, b);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('keydown', onKey);
    };
  }, [surface, b]);

  useFrame((_, dt) => {
    const calm = useSettingsStore.getState().reduceMotion;
    const c = (cur.current = calm ? goal.current : approach(cur.current, goal.current, Math.min(dt, 0.1)));
    const ground = Math.max(0, heightAt(c.x, c.z));
    lookY.current = calm ? ground : lookY.current + (ground - lookY.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 3));
    // Shift left by half the HUD so the target sits in the middle of the visible map.
    const shift = -(insetRef.current / 2) * unitsPerPixel(c.distance, sizeRef.current);
    const [x, y, z] = cameraPosition(c);
    camera.position.set(x + shift, y + lookY.current, z);
    camera.lookAt(c.x + shift, lookY.current, c.z);
  });
  return null;
}
