import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { type Group, Vector3 } from 'three';
import { useSettingsStore } from '../../settings/settings-store';
import type { Placement } from '../scene/journey-layout';
import { islandBob } from '../scene/screen-anchors';
import { RobotAvatar } from '../../garage/render/RobotAvatar';
import { usePersonalRobot } from '../../garage/state/robot-store';

interface RobotTravellerProps {
  /** Island the robot stands on (selected world, else the current one). */
  target: { readonly id: string; readonly order: number; readonly placement: Placement; readonly selected: boolean } | null;
}

/** Flight time between islands (s). */
const HOP = 1.1;
const from = new Vector3();
const to = new Vector3();

/**
 * The student's robot on the Explore map: parked on the chosen world, and
 * when another world is picked it hops there along an arc (instant with
 * reduced motion). Follows the island's gentle bob and scale.
 */
export function RobotTraveller({ target }: RobotTravellerProps) {
  const group = useRef<Group>(null);
  const hop = useRef<{ id: string | null; t: number }>({ id: null, t: 1 });
  const robot = usePersonalRobot();

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g || !target) return;
    const calm = useSettingsStore.getState().reduceMotion;
    const p = target.placement;
    const scale = p.scale * (target.selected ? 1.08 : 1);
    to.set(p.x, p.y + (calm ? 0 : islandBob(target.order, clock.elapsedTime)), p.z);

    if (hop.current.id !== target.id) {
      // New destination: take off from where the robot is now (first time: appear there).
      const first = hop.current.id === null;
      hop.current = { id: target.id, t: first || calm ? 1 : 0 };
      from.copy(first ? to : g.position);
    }
    const h = hop.current;
    h.t = Math.min(1, h.t + Math.min(delta, 0.1) / HOP);
    const e = h.t < 0.5 ? 4 * h.t ** 3 : 1 - (-2 * h.t + 2) ** 3 / 2;
    g.position.lerpVectors(from, to, e);
    g.position.y += Math.sin(Math.PI * h.t) * 2.2;
    g.scale.setScalar(g.scale.x + (scale - g.scale.x) * (calm ? 1 : 1 - Math.exp(-8 * Math.min(delta, 0.1))));
  });

  if (!target) return null;
  return (
    <group ref={group}>
      {/* The student's own robot (garage), at the showcase scale. */}
      <group scale={1.8}>
        <RobotAvatar config={robot} animation="idle" heading={-0.9} />
      </group>
    </group>
  );
}
