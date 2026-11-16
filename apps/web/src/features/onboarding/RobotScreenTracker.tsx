import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import type { PoseSource } from './types';
import { robotScreen } from './robot-screen';
import { useOnboardingStore } from './onboarding-store';

/**
 * Projects the robot to screen space while the tour needs it (inside the
 * Canvas). Writes to a plain registry — no React state per frame.
 */
export function RobotScreenTracker({ getPose }: { getPose: PoseSource }) {
  const { camera, gl } = useThree();
  const v = useRef(new Vector3());
  useFrame(() => {
    if (useOnboardingStore.getState().step === null) return;
    const p = getPose();
    const r = gl.domElement.getBoundingClientRect();
    v.current.set(p.x, 0.18, p.z).project(camera);
    robotScreen.set({ x: r.left + ((v.current.x + 1) / 2) * r.width, y: r.top + ((1 - v.current.y) / 2) * r.height });
  });
  return null;
}
