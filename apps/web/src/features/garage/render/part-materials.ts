import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, type Material, MeshPhysicalMaterial, MeshStandardMaterial, type Texture } from 'three';
import { useSettingsStore } from '../../settings/settings-store';
import { PART_IDS, type PartId, type RobotConfiguration } from '../model/robot-config';
import { patternTexture } from './textures';

/** One material per paintable part (models map their meshes onto these). */
export type PartMaterials = Readonly<Record<PartId, MeshPhysicalMaterial | MeshStandardMaterial>>;

/** How a configuration paints a robot: colours, pattern maps, highlighted part. */
export interface RobotPaint {
  readonly colors: Readonly<Record<PartId, string>>;
  readonly maps: Readonly<Partial<Record<PartId, Texture | null>>>;
  readonly highlight: PartId | null;
}

export function paintOf(config: RobotConfiguration, highlight: PartId | null = null): RobotPaint {
  const maps: Partial<Record<PartId, Texture | null>> = {};
  for (const p of PART_IDS) maps[p] = patternTexture(config.patterns[p] ?? 'none');
  // Snow tires: studded tread unless a pattern was chosen for the wheels.
  if (config.wheelStyle === 'snow' && !config.patterns.wheels) maps.wheels = patternTexture('digital');
  return { colors: config.colors, maps, highlight };
}

function create(): PartMaterials {
  const plastic = () => new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  return {
    body: plastic(),
    head: plastic(),
    accent: plastic(),
    trim: new MeshStandardMaterial({ color: '#223055', roughness: 0.45, metalness: 0.2 }),
    wheels: new MeshStandardMaterial({ color: '#1a1d26', roughness: 0.9 }),
    led: new MeshStandardMaterial({ color: '#22d3ee', emissive: new Color('#22d3ee'), emissiveIntensity: 1.6, roughness: 0.3 }),
  };
}

/** Set a material's colour and pattern map (recompiles only when the map appears / disappears). */
export function applyPaint(mat: MeshStandardMaterial, color: string, map: Texture | null | undefined) {
  mat.color.set(color);
  const next = map ?? null;
  if (mat.map !== next) {
    mat.map = next;
    mat.needsUpdate = true;
  }
}

const glow = new Color();

/**
 * Subtle pulse on the highlighted part's materials (the part being
 * customised). Emissive lift, not an outline; still with reduced motion.
 */
export function highlightFrame(materials: readonly Material[], on: boolean, t: number, calm: boolean) {
  const k = on ? (calm ? 0.18 : 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(t * 4))) : 0;
  for (const m of materials) {
    const s = m as MeshStandardMaterial;
    if (!s.emissive) continue;
    glow.setRGB(0.55 * k, 0.85 * k, 1 * k);
    s.emissive.copy(glow);
  }
}

/** Part materials for a procedural model, kept in sync with the paint. */
export function usePartMaterials(paint: RobotPaint): PartMaterials {
  const mats = useMemo(create, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useEffect(() => {
    for (const p of PART_IDS) {
      if (p === 'led') {
        mats.led.color.set(paint.colors.led);
        mats.led.emissive.set(paint.colors.led);
      } else applyPaint(mats[p], paint.colors[p], paint.maps[p]);
    }
  }, [mats, paint]);
  useFrame(({ clock }) => {
    const calm = useSettingsStore.getState().reduceMotion;
    for (const p of PART_IDS) {
      if (p === 'led') {
        mats.led.emissiveIntensity = paint.highlight === 'led' ? 2.4 + (calm ? 0 : Math.sin(clock.elapsedTime * 4) * 0.6) : 1.6;
        continue;
      }
      highlightFrame([mats[p]], paint.highlight === p, clock.elapsedTime, calm);
    }
  });
  return mats;
}
