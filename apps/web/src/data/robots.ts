import type { RobotOption } from '../types/ui';

/** Robots shown in the selector. Only models with a `definitionId` are simulated today. */
export const ROBOT_OPTIONS: readonly RobotOption[] = [
  { id: 'rover', name: 'Rover', role: 'Educational rover', glyph: 'rover', definitionId: 'rover' },
  { id: 'digger', name: 'Digger', role: 'Excavator', glyph: 'excavator', definitionId: null },
  { id: 'titan', name: 'Titan', role: 'Heavy robot', glyph: 'tank', definitionId: null },
  { id: 'scout', name: 'Scout', role: 'Scout robot', glyph: 'scout', definitionId: null },
  { id: 'forge', name: 'Forge', role: 'Industrial arm', glyph: 'arm', definitionId: null },
  { id: 'hover', name: 'Hover', role: 'Drone', glyph: 'drone', definitionId: null },
];
