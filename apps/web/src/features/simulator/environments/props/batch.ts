import type { InstanceItem } from '../../environment/Instanced';
import type { GEO } from '../../environment/shapes';

/** Shared unit geometries (see `environment/shapes.ts`). */
export type GeoKey = keyof typeof GEO;

/**
 * Named environment materials (see `props/materials.ts`). `tint*` materials
 * are white and coloured per instance.
 */
export type MatKey =
  | 'tint'
  | 'tintFlat'
  | 'tintMetal'
  | 'tintGlossy'
  | 'wood'
  | 'woodDark'
  | 'trunk'
  | 'rock'
  | 'concrete'
  | 'metal'
  | 'metalDark'
  | 'glass'
  | 'ice'
  | 'hazard'
  | 'glowCyan'
  | 'glowGreen'
  | 'glowAmber'
  | 'glowRed'
  | 'glowWarm'
  | 'glowPurple'
  | 'lava'
  /** Natural look: leafy canopy (tinted per instance) and textured bark / planks. */
  | 'foliage'
  | 'bark'
  | 'planks'
  /** Soft dark blob on the ground under a prop (ambient-occlusion look, no shadow map needed). */
  | 'contact';

export interface BatchPart {
  readonly geometry: GeoKey;
  readonly material: MatKey;
  readonly shadow: boolean;
  readonly items: InstanceItem[];
}

/**
 * Collects prop instances from many builders and groups them by
 * geometry × material × shadow — one instanced draw call per group, however
 * many trees, lamps or crates an environment places.
 */
export class PropBatch {
  private readonly map = new Map<string, BatchPart>();

  add(geometry: GeoKey, material: MatKey, item: InstanceItem, shadow = true): void {
    const key = `${geometry}|${material}|${shadow ? 1 : 0}`;
    let part = this.map.get(key);
    if (!part) this.map.set(key, (part = { geometry, material, shadow, items: [] }));
    part.items.push(item);
  }

  get parts(): readonly BatchPart[] {
    return [...this.map.values()];
  }

  /** Total instances (for budgets / tests). */
  get size(): number {
    let n = 0;
    for (const p of this.map.values()) n += p.items.length;
    return n;
  }
}
