/**
 * The command model the compiler produces and the runtime executes is the
 * shared RoboLab IR (`@robolab/shared` program types): typed, serializable,
 * React-free. Control flow (repeat / forever / if) stays as runtime commands
 * so conditions are evaluated live and loops are never expanded.
 */
export type {
  Expression,
  IfStatement as IfCommand,
  MoveStatement as MoveCommand,
  Program as CompiledProgram,
  RepeatStatement as RepeatCommand,
  SetSpeedStatement as SetSpeedCommand,
  SetVariableStatement as SetVariableCommand,
  Statement as RobotCommand,
  StopStatement as StopCommand,
  TurnStatement as TurnCommand,
  WaitStatement as WaitCommand,
  WhileStatement as ForeverCommand,
} from '@robolab/shared';
