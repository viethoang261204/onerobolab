import { RobotBody } from '@robolab/simulation';
import type { RobotVisualSource } from './RobotTypes';

/**
 * The simulator's robot: the framework-free `RobotBody` (kinematics, motors,
 * status, sensors — `@robolab/simulation`) as the renderer's visual source.
 * `Robot.tsx` reads `state` in `useFrame`; nothing goes through React state.
 */
export class RobotRuntime extends RobotBody implements RobotVisualSource {}
