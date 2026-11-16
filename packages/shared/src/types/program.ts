import type { SensorId } from './ids';
import type { SensorColor } from './sensor';

/**
 * RoboLab Intermediate Representation (IR).
 *
 * Blockly workspaces compile to a `Program`; the Robot Engine interprets it.
 * The IR is plain JSON: serializable, diffable, testable and independent of
 * Blockly. Units are SI (m, s, rad); speeds are fractions 0–1 of max speed.
 */
export interface Program {
  readonly irVersion: 1;
  readonly variables: readonly string[];
  readonly body: readonly Statement[];
}

/** Source location for highlighting the executing block in the editor. */
export interface SourceRef {
  readonly blockId: string;
}

interface StatementBase {
  readonly source?: SourceRef;
}

export type MoveDirection = 'forward' | 'backward';
export type TurnDirection = 'left' | 'right';

export interface MoveStatement extends StatementBase {
  readonly op: 'move';
  readonly direction: MoveDirection;
  /** Distance in metres. */
  readonly distance: Expression;
  /** Speed 0–1 as a fraction of max wheel speed; omitted = current program speed. */
  readonly speed?: Expression;
}

export interface TurnStatement extends StatementBase {
  readonly op: 'turn';
  readonly direction: TurnDirection;
  /** Angle in radians. */
  readonly angle: Expression;
  /** Omitted = current program speed. */
  readonly speed?: Expression;
}

/** Set the program speed (0–1 of max wheel speed) used by later moves/turns. */
export interface SetSpeedStatement extends StatementBase {
  readonly op: 'setSpeed';
  readonly speed: Expression;
}

/** Start driving continuously; returns immediately (non-blocking). */
export interface DriveStatement extends StatementBase {
  readonly op: 'drive';
  readonly direction: MoveDirection;
  readonly speed: Expression;
}

/** Stop the motors and end the program. */
export interface StopStatement extends StatementBase {
  readonly op: 'stop';
}

export interface WaitStatement extends StatementBase {
  readonly op: 'wait';
  /** Seconds of simulation time. */
  readonly seconds: Expression;
}

export interface RepeatStatement extends StatementBase {
  readonly op: 'repeat';
  readonly times: Expression;
  readonly body: readonly Statement[];
}

export interface WhileStatement extends StatementBase {
  readonly op: 'while';
  readonly condition: Expression;
  readonly body: readonly Statement[];
}

export interface IfStatement extends StatementBase {
  readonly op: 'if';
  readonly condition: Expression;
  readonly then: readonly Statement[];
  readonly else?: readonly Statement[];
}

export interface SetVariableStatement extends StatementBase {
  readonly op: 'setVar';
  readonly name: string;
  readonly value: Expression;
}

export interface ChangeVariableStatement extends StatementBase {
  readonly op: 'changeVar';
  readonly name: string;
  readonly delta: Expression;
}

/** Pick up the crate in front of the robot (blocking, a short arm animation). */
export interface PickStatement extends StatementBase {
  readonly op: 'pick';
}

/** Set the carried crate down in front of the robot. */
export interface DropStatement extends StatementBase {
  readonly op: 'drop';
}

/** Leave the innermost repeat / while loop. */
export interface BreakStatement extends StatementBase {
  readonly op: 'break';
}

/**
 * Turn towards a point and drive straight to it (student coordinates:
 * x = world x, y = −z, both in metres).
 */
export interface GoToStatement extends StatementBase {
  readonly op: 'goTo';
  readonly x: Expression;
  readonly y: Expression;
}

export type Statement =
  | MoveStatement
  | TurnStatement
  | DriveStatement
  | StopStatement
  | SetSpeedStatement
  | WaitStatement
  | RepeatStatement
  | WhileStatement
  | IfStatement
  | SetVariableStatement
  | ChangeVariableStatement
  | PickStatement
  | DropStatement
  | BreakStatement
  | GoToStatement;

export type StatementOp = Statement['op'];

export type CompareOperator = '<' | '<=' | '>' | '>=' | '==' | '!=';
export type ArithmeticOperator = '+' | '-' | '*' | '/';

export type Expression =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'color'; readonly value: SensorColor }
  | { readonly kind: 'variable'; readonly name: string }
  | {
      readonly kind: 'arithmetic';
      readonly op: ArithmeticOperator;
      readonly left: Expression;
      readonly right: Expression;
    }
  | {
      readonly kind: 'compare';
      readonly op: CompareOperator;
      readonly left: Expression;
      readonly right: Expression;
    }
  | {
      readonly kind: 'logic';
      readonly op: 'and' | 'or';
      readonly left: Expression;
      readonly right: Expression;
    }
  | { readonly kind: 'not'; readonly operand: Expression }
  /** Distance reading in metres (Infinity when nothing is in range). */
  | { readonly kind: 'sensorDistance'; readonly sensor: SensorId }
  /** true when the line sensor is over a line. */
  | { readonly kind: 'sensorLine'; readonly sensor: SensorId }
  | { readonly kind: 'sensorColor'; readonly sensor: SensorId }
  | { readonly kind: 'sensorTouch'; readonly sensor: SensorId }
  /** true when something is within OBSTACLE_DISTANCE ahead or the bumper is pressed. */
  | { readonly kind: 'sensorObstacle' }
  /** A number the mission gives the program for this run (`mission.target`). */
  | { readonly kind: 'missionData'; readonly key: string }
  /** The robot's position in student coordinates (m): x = world x, y = −world z. */
  | { readonly kind: 'robotX' }
  | { readonly kind: 'robotY' }
  /** Whole number from min to max (inclusive), from the run's seeded generator. */
  | { readonly kind: 'random'; readonly min: Expression; readonly max: Expression };

export type ExpressionKind = Expression['kind'];

export type RuntimeValue = number | boolean | SensorColor;

export type ProgramRunState = 'idle' | 'running' | 'paused' | 'finished' | 'error';

/** Execution status exposed to the UI (debug panel, block highlighting). */
export interface ProgramStatus {
  readonly state: ProgramRunState;
  readonly activeBlockId: string | null;
  readonly variables: Readonly<Record<string, RuntimeValue>>;
  readonly executedStatements: number;
  readonly error: string | null;
}
