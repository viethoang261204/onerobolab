/*
 * Explore composition: the worlds laid out as a journey that recedes into the
 * distance — the first world large in the foreground, each next one further
 * back, a little higher and smaller, zig-zagging so every island stays
 * visible. Presentation only (world data keeps its own `mapPosition`).
 */

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Island scale (foreground islands are larger). */
  readonly scale: number;
}

/** Hand-composed slots for the six launch worlds (scene units). */
const SLOTS: readonly Placement[] = [
  { x: -7.9, y: 0, z: 5.3, scale: 1.7 },
  { x: -0.7, y: 0.4, z: 3.1, scale: 1.6 },
  { x: 6.7, y: 0.85, z: 0.5, scale: 1.45 },
  { x: 3.1, y: 1.5, z: -6.5, scale: 1.35 },
  { x: -5.5, y: 2.15, z: -10.3, scale: 1.25 },
  { x: 2.6, y: 3, z: -16.3, scale: 1.3 },
];

/** Where world `order` (1-based) of `count` sits on the journey. */
export function journeyPlacement(order: number, count: number): Placement {
  if (count <= SLOTS.length) {
    const slot = SLOTS[order - 1];
    if (slot) return slot;
  }
  // More worlds than slots: the same receding zig-zag, generated (alternating sides, even depth steps).
  const t = count > 1 ? (order - 1) / (count - 1) : 0;
  const side = order % 2 === 1 ? -1 : 1;
  return { x: side * 4.2 + Math.sin(order * 1.3) * 1.2, y: t * 3, z: 5.3 - (order - 1) * 4.4, scale: 1.65 - t * 0.4 };
}

/** Centre of the journey (camera overview target). */
export function journeyCenter(count: number): { x: number; z: number } {
  const all = Array.from({ length: count }, (_, i) => journeyPlacement(i + 1, count));
  const xs = all.map((p) => p.x);
  const zs = all.map((p) => p.z);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
}
