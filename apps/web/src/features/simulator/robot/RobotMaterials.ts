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
    white: new MeshPhysicalMaterial({ color: '#f3f5fa', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    head: new MeshPhysicalMaterial({ color: '#f3f5fa', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    dark: new MeshStandardMaterial({ color: '#223055', roughness: 0.5, metalness: 0.15 }),
    darkGloss: new MeshPhysicalMaterial({ color: '#25345c', roughness: 0.28, metalness: 0.2, clearcoat: 0.7 }),
    blue: new MeshPhysicalMaterial({ color: '#2d6bf0', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    rubber: new MeshStandardMaterial({ color: '#1a1d26', roughness: 0.92, metalness: 0 }),
    hub: new MeshStandardMaterial({ color: '#2a3350', roughness: 0.4, metalness: 0.45 }),
    metal: new MeshStandardMaterial({ color: '#b9c3d6', roughness: 0.3, metalness: 0.7 }),
    screen: new MeshPhysicalMaterial({ color: '#060b18', roughness: 0.12, metalness: 0.2, clearcoat: 1 }),
    lensGlass: new MeshPhysicalMaterial({ color: '#0a1830', roughness: 0.05, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
    cyanAccent: emissive('#22d3ee', 0.9),
    purple: emissive('#8b5cf6', 1.2),
    vent: new MeshStandardMaterial({ color: '#0d1426', roughness: 0.8, side: DoubleSide }),
    // animated
    eyes: emissive('#22d3ee', 1.8),
    frontLed: emissive('#22d3ee', 1.4),
    accentLed: emissive('#38e1ff', 1.1),
    lens: emissive('#3fe0ff', 2.2),
  };
}

/** One material set per robot, disposed on unmount. */
export function useRobotMaterials(): RobotMaterials {
  const mats = useMemo(createRobotMaterials, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}
