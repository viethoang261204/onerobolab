import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import { Vector3 } from 'three';
import { useSettingsStore } from '../../settings/settings-store';
import { islandBob, screenAnchors } from '../scene/screen-anchors';

const v = new Vector3();

/** Projects registered DOM anchors onto the canvas every frame (transform only). */
export function AnchorProjector() {
  useFrame(({ camera, size, clock }) => {
    const calm = useSettingsStore.getState().reduceMotion;
    const t = clock.elapsedTime;
    for (const a of screenAnchors.values()) {
      const bob = a.bobWith !== undefined && !calm ? islandBob(a.bobWith, t) : 0;
      v.set(a.x, a.y + bob, a.z).project(camera);
      if (v.z > 1) {
        a.el.style.visibility = 'hidden';
        continue;
      }
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      a.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      a.el.style.visibility = 'visible';
    }
  });
  // Labels stay hidden until the canvas has placed them once.
  useEffect(
    () => () => {
      for (const a of screenAnchors.values()) a.el.style.visibility = 'hidden';
    },
    [],
  );
  return null;
}
