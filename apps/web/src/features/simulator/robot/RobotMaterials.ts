import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import type { AnimatedMaterials } from './RobotTypes';

/**
 * Robot material set. Toy-like glossy plastics (physical clearcoat on the
 * white shell), matte rubber, dark navy structure, and a few emissive
 * accents. Created per robot instance so LED/display animation is
 * independent, and disposed with the robot.
 */
export interface RobotMaterials extends AnimatedMaterials {
  readonly white: MeshPhysicalMaterial;
  /** Head housing + neck arm (painted separately from the body). */
  readonly head: MeshPhysicalMaterial;
  readonly dark: MeshStandardMaterial;
  readonly darkGloss: MeshPhysicalMaterial;
  readonly blue: MeshPhysicalMaterial;
  readonly rubber: MeshStandardMaterial;
  readonly hub: MeshStandardMaterial;
  readonly metal: MeshStandardMaterial;
  readonly screen: MeshPhysicalMaterial;
  readonly lensGlass: MeshPhysicalMaterial;
  readonly cyanAccent: MeshStandardMaterial;
  readonly purple: MeshStandardMaterial;
  readonly vent: MeshStandardMaterial;
}

const emissive = (hex: string, intensity: number) =>
  new MeshStandardMaterial({ color: hex, emissive: new Color(hex), emissiveIntensity: intensity, roughness: 0.35 });

export function createRobotMaterials(): RobotMaterials {
  return {
    white: new MeshPhysicalMaterial({ color: '#12A6A1', roughness: 0.48, clearcoat: 0.24, clearcoatRoughness: 0.4 }),
    head: new MeshPhysicalMaterial({ color: '#12A6A1', roughness: 0.48, clearcoat: 0.24, clearcoatRoughness: 0.4 }),
    dark: new MeshStandardMaterial({ color: '#17324D', roughness: 0.62, metalness: 0.04 }),
    darkGloss: new MeshPhysicalMaterial({ color: '#17324D', roughness: 0.42, metalness: 0.06, clearcoat: 0.28 }),
    blue: new MeshPhysicalMaterial({ color: '#FFC857', roughness: 0.46, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    rubber: new MeshStandardMaterial({ color: '#17324D', roughness: 0.88, metalness: 0 }),
    hub: new MeshStandardMaterial({ color: '#12A6A1', roughness: 0.52, metalness: 0.12 }),
    metal: new MeshStandardMaterial({ color: '#FFC857', roughness: 0.48, metalness: 0.12 }),
    screen: new MeshPhysicalMaterial({ color: '#060b18', roughness: 0.12, metalness: 0.2, clearcoat: 1 }),
    lensGlass: new MeshPhysicalMaterial({ color: '#0a1830', roughness: 0.05, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
    cyanAccent: emissive('#12A6A1', 0.55),
    purple: emissive('#F26B5B', 0.75),
    vent: new MeshStandardMaterial({ color: '#0d1426', roughness: 0.8, side: DoubleSide }),
    // animated
    eyes: emissive('#12A6A1', 1.25),
    frontLed: emissive('#FFC857', 0.9),
    accentLed: emissive('#12A6A1', 0.65),
    lens: emissive('#12A6A1', 1.5),
  };
}

/** One material set per robot, disposed on unmount. */
export function useRobotMaterials(): RobotMaterials {
  const mats = useMemo(createRobotMaterials, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}
