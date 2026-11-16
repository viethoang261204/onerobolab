/**
 * @robolab/shared — the only package every other package may depend on.
 * Contains data types, engine contracts and deterministic math. No runtime
 * dependencies, no DOM, no rendering.
 */
export * from './types/ids';
export type * from './types/geometry';
export * from './types/sensor';
export type * from './types/robot';
export type * from './types/map';
export type * from './types/program';
export type * from './types/mission';
export type * from './types/scoring';
export * from './types/simulation';

export type * from './contracts/map-engine';
export type * from './contracts/physics-engine';
export type * from './contracts/sensor-engine';
export type * from './contracts/robot-engine';
export type * from './contracts/compiler';
export type * from './contracts/mission-engine';
export type * from './contracts/scoring-engine';
export type * from './contracts/simulation';

export * from './math/scalar';
export * from './math/world';
export * as Vec2Math from './math/vec2';
