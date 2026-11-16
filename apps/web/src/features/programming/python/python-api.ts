import type { BlockType } from '../blocks/block-types';

/** One entry of the Python reference: what to type, what it does. */
export interface PythonCommand {
  readonly code: string;
  /** Text inserted at the cursor (a line for statements, an expression for values). */
  readonly insert: string;
  readonly help: string;
  readonly kind: 'action' | 'value' | 'structure';
}

/**
 * The OneRoboLab Python API, by the block each command stands for — the
 * reference panel lists only what the level allows (same toolbox rules).
 */
export const PYTHON_API: Partial<Record<BlockType, readonly PythonCommand[]>> = {
  'motion.step': [{ code: 'robot.step(n)', insert: 'robot.step(1)', help: 'Move forward n grid cells (1 cell = 60 cm).', kind: 'action' }],
  'motion.forward': [{ code: 'robot.move_forward(cm)', insert: 'robot.move_forward(20)', help: 'Drive straight ahead.', kind: 'action' }],
  'motion.backward': [{ code: 'robot.move_backward(cm)', insert: 'robot.move_backward(20)', help: 'Drive straight back.', kind: 'action' }],
  'motion.turnLeft': [{ code: 'robot.turn_left(degrees)', insert: 'robot.turn_left(90)', help: 'Spin to the left on the spot.', kind: 'action' }],
  'motion.turnRight': [{ code: 'robot.turn_right(degrees)', insert: 'robot.turn_right(90)', help: 'Spin to the right on the spot.', kind: 'action' }],
  'motion.stop': [{ code: 'robot.stop()', insert: 'robot.stop()', help: 'Stop the robot and end the program.', kind: 'action' }],
  'motion.speed': [{ code: 'robot.set_speed(percent)', insert: 'robot.set_speed(100)', help: 'How fast the robot drives (0–100).', kind: 'action' }],
  'motion.goTo': [{ code: 'robot.go_to(x, y)', insert: 'robot.go_to(0, 0)', help: 'Turn towards a point (cm) and drive straight to it.', kind: 'action' }],
  'action.pick': [{ code: 'robot.pick_up()', insert: 'robot.pick_up()', help: 'Pick up the crate in front of the robot.', kind: 'action' }],
  'action.drop': [{ code: 'robot.drop()', insert: 'robot.drop()', help: 'Set the carried crate down in front of the robot.', kind: 'action' }],
  'control.wait': [{ code: 'robot.wait(seconds)', insert: 'robot.wait(1)', help: 'Pause before the next line.', kind: 'action' }],
  'control.repeat': [{ code: 'for _ in range(n):', insert: 'for _ in range(3):\n    ', help: 'Repeat the indented lines n times.', kind: 'structure' }],
  'control.forever': [{ code: 'while True:', insert: 'while True:\n    ', help: 'Repeat the indented lines forever (until break).', kind: 'structure' }],
  'control.while': [{ code: 'while condition:', insert: 'while robot.distance() > 30:\n    ', help: 'Repeat as long as the condition is true.', kind: 'structure' }],
  'control.until': [{ code: 'while not condition:', insert: 'while not robot.on_line():\n    ', help: 'Repeat until the condition becomes true.', kind: 'structure' }],
  'control.break': [{ code: 'break', insert: 'break', help: 'Leave the loop and carry on after it.', kind: 'structure' }],
  'control.if': [{ code: 'if condition:', insert: 'if robot.obstacle_ahead():\n    ', help: 'Run the indented lines only when the condition is true.', kind: 'structure' }],
  'control.ifElse': [{ code: 'elif … / else:', insert: 'else:\n    ', help: 'Choose between groups of lines.', kind: 'structure' }],
  'sensor.distance': [{ code: 'robot.distance()', insert: 'robot.distance()', help: 'Centimetres to the nearest thing in front.', kind: 'value' }],
  'sensor.obstacle': [{ code: 'robot.obstacle_ahead()', insert: 'robot.obstacle_ahead()', help: 'True when something is close in front.', kind: 'value' }],
  'sensor.line': [{ code: 'robot.on_line()', insert: 'robot.on_line()', help: 'True when the robot is over the black line.', kind: 'value' }],
  'sensor.color': [{ code: 'robot.color() == "red"', insert: 'robot.color() == "red"', help: 'The floor colour under the robot.', kind: 'value' }],
  'sensor.robotX': [{ code: 'robot.x()', insert: 'robot.x()', help: 'Where the robot is, left ↔ right (cm).', kind: 'value' }],
  'sensor.robotY': [{ code: 'robot.y()', insert: 'robot.y()', help: 'Where the robot is, down ↔ up (cm).', kind: 'value' }],
  'mission.value': [{ code: 'mission.name', insert: 'mission.', help: 'A number the mission gives you for this run.', kind: 'value' }],
  'variable.set': [{ code: 'name = value', insert: 'count = 0', help: 'Store a number in a variable.', kind: 'action' }],
  'variable.change': [{ code: 'name += value', insert: 'count += 1', help: 'Add to (or with -= take from) a variable.', kind: 'action' }],
  'logic.and': [{ code: 'a and b', insert: ' and ', help: 'Both must be true.', kind: 'value' }],
  'logic.or': [{ code: 'a or b', insert: ' or ', help: 'At least one must be true.', kind: 'value' }],
  'logic.not': [{ code: 'not a', insert: 'not ', help: 'Flips true and false.', kind: 'value' }],
  'math.random': [{ code: 'random.randint(a, b)', insert: 'random.randint(1, 6)', help: 'A random whole number.', kind: 'value' }],
  'function.define': [{ code: 'def name():', insert: 'def my_task():\n    ', help: 'Give a group of lines a name.', kind: 'structure' }],
  'function.call': [{ code: 'name()', insert: 'my_task()', help: 'Run a function you defined.', kind: 'action' }],
};

/** The commands a level's toolbox allows, in toolbox order. */
export function pythonCommands(allowed: readonly BlockType[] | 'all'): PythonCommand[] {
  const types = allowed === 'all' ? (Object.keys(PYTHON_API) as BlockType[]) : allowed;
  const out: PythonCommand[] = [];
  for (const t of types) for (const c of PYTHON_API[t] ?? []) if (!out.includes(c)) out.push(c);
  return out;
}
