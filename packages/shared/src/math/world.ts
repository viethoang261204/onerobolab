import type { Vec2 } from '../types/geometry.ts';
import type { MoverEntity, SignalCycle, TrafficLightEntity } from '../types/map.ts';

/** A traffic light's colour. */
export type SignalPhase = 'red' | 'green' | 'yellow';

/** Seconds of one full red → green → yellow cycle. */
export const cycleLength = (c: SignalCycle): number => c.red + c.green + c.yellow;

/**
 * Light colour at simulation time `t` (s). The cycle runs red → green →
 * yellow and starts `offset` seconds in. Pure and deterministic, so the
 * sensor, the mission rules and the renderer always agree.
 */
export function signalPhase(light: Pick<TrafficLightEntity, 'cycle' | 'offset'>, t: number): SignalPhase {
  const total = cycleLength(light.cycle);
  if (total <= 0) return 'green';
  const k = (((t + light.offset) % total) + total) % total;
  if (k < light.cycle.red) return 'red';
  if (k < light.cycle.red + light.cycle.green) return 'green';
  return 'yellow';
}

/** Seconds until the light next turns green (0 when it is green now). */
export function secondsUntilGreen(light: Pick<TrafficLightEntity, 'cycle' | 'offset'>, t: number): number {
  const total = cycleLength(light.cycle);
  if (total <= 0) return 0;
  const k = (((t + light.offset) % total) + total) % total;
  if (k < light.cycle.red) return light.cycle.red - k;
  if (k < light.cycle.red + light.cycle.green) return 0;
  return total - k;
}

/** Where a patrolling obstacle is at time `t`: from → to in half the period, then back. */
export function moverPosition(m: Pick<MoverEntity, 'from' | 'to' | 'period' | 'offset'>, t: number): Vec2 {
  if (m.period <= 0) return m.from;
  const k = ((((t + m.offset) % m.period) + m.period) % m.period) / m.period;
  const s = k < 0.5 ? k * 2 : 2 - k * 2;
  return { x: m.from.x + (m.to.x - m.from.x) * s, z: m.from.z + (m.to.z - m.from.z) * s };
}
