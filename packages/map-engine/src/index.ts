/**
 * @robolab/map-engine — validates map definitions and answers geometric
 * queries about them (floor surface, checkpoints, finish, bounds).
 */
export { createMapEngine, validateMap, MapValidationError } from './map-engine.ts';
export { PathBuilder } from './maps/path-builder.ts';
export { DEMO_ARENA } from './maps/demo-arena.ts';
export { RESCUE_SUPPLIES } from './maps/rescue-supplies.ts';
export type { MapEngine, MapQuery, MapValidationIssue, SurfaceSample } from '@robolab/shared';
