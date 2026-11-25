/**
 * @robolab/shared — the only package every other package may depend on.
 * Contains data types, engine contracts and deterministic math. No runtime
 * dependencies, no DOM, no rendering.
 */
export * from './types/ids.ts';
export type * from './types/geometry.ts';
export * from './types/sensor.ts';
export type * from './types/robot.ts';
export type * from './types/map.ts';
export type * from './types/program.ts';
export type * from './types/mission.ts';
export type * from './types/scoring.ts';
export * from './types/simulation.ts';

export type * from './contracts/map-engine.ts';
export type * from './contracts/physics-engine.ts';
export type * from './contracts/sensor-engine.ts';
export type * from './contracts/robot-engine.ts';
export type * from './contracts/compiler.ts';
export type * from './contracts/mission-engine.ts';
export type * from './contracts/scoring-engine.ts';
export type * from './contracts/simulation.ts';

export * from './math/scalar.ts';
export * from './math/world.ts';
export * as Vec2Math from './math/vec2.ts';
