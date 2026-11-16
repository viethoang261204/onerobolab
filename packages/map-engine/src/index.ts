/**
 * @robolab/map-engine — validates map definitions and answers geometric
 * queries about them (floor surface, checkpoints, finish, bounds).
 */
export { createMapEngine, validateMap, MapValidationError } from './map-engine';
export { PathBuilder } from './maps/path-builder';
export { DEMO_ARENA } from './maps/demo-arena';
export { RESCUE_SUPPLIES } from './maps/rescue-supplies';
export type { MapEngine, MapQuery, MapValidationIssue, SurfaceSample } from '@robolab/shared';
