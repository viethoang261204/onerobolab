import type { ArgDef, BlockCategoryId, BlockDef, BlockType, DropdownOption } from './block-types.ts';

export interface CategoryDef {
  readonly id: BlockCategoryId;
  readonly label: string;
  /** CSS colour (design token). */
  readonly color: string;
  /** Blocks shown in this category's palette, in order. */
  readonly palette: readonly BlockType[];
}

const n = (label: string, def: number, extra: Omit<Extract<ArgDef, { kind: 'number' }>, 'kind' | 'default' | 'label'> = {}): ArgDef => ({
  kind: 'number',
  label,
  default: def,
  ...extra,
});

const COLORS: readonly DropdownOption[] = ['red', 'green', 'blue', 'yellow', 'black', 'white'].map((c) => ({ value: c, label: c }));
const COMPARE: readonly DropdownOption[] = [
  { value: '<', label: '<' },
  { value: '=', label: '=' },
  { value: '>', label: '>' },
  { value: '<=', label: '≤' },
  { value: '>=', label: '≥' },
  { value: '!=', label: '≠' },
];
const SENSORS: readonly DropdownOption[] = [
  { value: 'distance', label: 'distance' },
  { value: 'line', label: 'line' },
  { value: 'color', label: 'color' },
  { value: 'touch', label: 'touch' },
];

const DEFS: readonly BlockDef[] = [
  // Events
  { type: 'event.start', category: 'events', shape: 'hat', template: ['when program starts'], args: {}, hasNext: true, help: 'Your program begins here. Snap blocks underneath.', keywords: ['start', 'begin', 'run'] },
  {
    type: 'event.button',
    category: 'events',
    shape: 'hat',
    template: ['when button', { arg: 'button' }, 'pressed'],
    args: { button: { kind: 'dropdown', default: 'A', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }] } },
    hasNext: true,
    help: 'Runs the blocks below when a robot button is pressed.',
  },
  {
    type: 'event.sensor',
    category: 'events',
    shape: 'hat',
    template: ['when', { arg: 'sensor' }, 'detects something'],
    args: { sensor: { kind: 'dropdown', default: 'distance', options: SENSORS } },
    hasNext: true,
    help: 'Runs the blocks below when a sensor notices something.',
    keywords: ['sensor'],
  },

  // Movement
  { type: 'motion.step', category: 'movement', shape: 'statement', template: ['step forward', { arg: 'steps' }], args: { steps: n('steps', 1, { min: 0, max: 50 }) }, hasNext: true, help: 'Move forward by grid cells (1 step = 60 cm).', keywords: ['step', 'grid', 'move'] },
  { type: 'motion.forward', category: 'movement', shape: 'statement', template: ['move forward', { arg: 'distance' }], args: { distance: n('distance', 20, { min: 0, max: 1000, unit: 'cm' }) }, hasNext: true, help: 'Drive straight ahead.', keywords: ['move', 'drive', 'go'] },
  { type: 'motion.backward', category: 'movement', shape: 'statement', template: ['move backward', { arg: 'distance' }], args: { distance: n('distance', 20, { min: 0, max: 1000, unit: 'cm' }) }, hasNext: true, help: 'Drive straight back.', keywords: ['move', 'reverse'] },
  { type: 'motion.turnLeft', category: 'movement', shape: 'statement', template: ['turn left', { arg: 'angle' }], args: { angle: n('angle', 90, { min: -360, max: 360, unit: '°' }) }, hasNext: true, help: 'Spin to the left on the spot.', keywords: ['move', 'rotate'] },
  { type: 'motion.turnRight', category: 'movement', shape: 'statement', template: ['turn right', { arg: 'angle' }], args: { angle: n('angle', 90, { min: -360, max: 360, unit: '°' }) }, hasNext: true, help: 'Spin to the right on the spot.', keywords: ['move', 'rotate'] },
  { type: 'motion.stop', category: 'movement', shape: 'statement', template: ['stop'], args: {}, hasNext: true, help: 'Stop the robot and end the program.', keywords: ['move', 'halt', 'brake', 'end'] },
  { type: 'motion.speed', category: 'movement', shape: 'statement', template: ['set speed to', { arg: 'speed' }], args: { speed: n('speed', 50, { min: 0, max: 100, unit: '%' }) }, hasNext: true, help: 'How fast the robot drives (0–100 %).', keywords: ['move', 'fast', 'slow'] },
  {
    type: 'motion.goTo',
    category: 'movement',
    shape: 'statement',
    template: ['go to x', { arg: 'x' }, 'y', { arg: 'y' }],
    args: { x: n('x', 0, { min: -1000, max: 1000, unit: 'cm' }), y: n('y', 0, { min: -1000, max: 1000, unit: 'cm' }) },
    hasNext: true,
    help: 'Turn towards a point on the map and drive straight to it.',
    keywords: ['move', 'coordinates', 'position', 'navigate'],
  },
  { type: 'action.pick', category: 'movement', shape: 'statement', template: ['pick up crate'], args: {}, hasNext: true, help: 'Pick up the crate in front of the robot.', keywords: ['cargo', 'grab', 'take', 'gripper'] },
  { type: 'action.drop', category: 'movement', shape: 'statement', template: ['drop crate'], args: {}, hasNext: true, help: 'Set the carried crate down in front of the robot.', keywords: ['cargo', 'place', 'put', 'deliver', 'gripper'] },

  // Control
  { type: 'control.wait', category: 'control', shape: 'statement', template: ['wait', { arg: 'seconds' }], args: { seconds: n('time', 1, { min: 0, max: 600, unit: 's' }) }, hasNext: true, help: 'Pause before the next block.', keywords: ['delay', 'pause', 'sleep'] },
  { type: 'control.repeat', category: 'control', shape: 'c', template: ['repeat', { arg: 'count' }, 'times'], args: { count: n('count', 3, { min: 0, max: 1000, integer: true }) }, slots: [{ name: 'body', label: null }], hasNext: true, help: 'Run the blocks inside several times.', keywords: ['loop'] },
  { type: 'control.forever', category: 'control', shape: 'c', template: ['repeat forever'], args: {}, slots: [{ name: 'body', label: null }], hasNext: true, help: 'Run the blocks inside again and again (until a “break out of loop”).', keywords: ['loop', 'always'] },
  { type: 'control.while', category: 'control', shape: 'c', template: ['repeat while', { arg: 'condition' }], args: { condition: { kind: 'boolean' } }, slots: [{ name: 'body', label: null }], hasNext: true, help: 'Run the blocks inside as long as the condition is true.', keywords: ['loop', 'while', 'condition'] },
  { type: 'control.until', category: 'control', shape: 'c', template: ['repeat until', { arg: 'condition' }], args: { condition: { kind: 'boolean' } }, slots: [{ name: 'body', label: null }], hasNext: true, help: 'Run the blocks inside until the condition becomes true.', keywords: ['loop', 'until', 'condition'] },
  { type: 'control.break', category: 'control', shape: 'statement', template: ['break out of loop'], args: {}, hasNext: false, help: 'Leave the loop this block is in and carry on after it.', keywords: ['loop', 'exit', 'stop', 'break'] },
  { type: 'control.if', category: 'control', shape: 'c', template: ['if', { arg: 'condition' }, 'then'], args: { condition: { kind: 'boolean' } }, slots: [{ name: 'then', label: null }], hasNext: true, help: 'Run the blocks inside only when the condition is true.', keywords: ['condition', 'logic'] },
  {
    type: 'control.ifElse',
    category: 'control',
    shape: 'c',
    template: ['if', { arg: 'condition' }, 'then'],
    args: { condition: { kind: 'boolean' } },
    slots: [
      { name: 'then', label: null },
      { name: 'else', label: 'else' },
    ],
    hasNext: true,
    help: 'Choose between two groups of blocks.',
    keywords: ['condition', 'logic', 'else'],
  },

  // Sensors
  { type: 'sensor.distance', category: 'sensors', shape: 'reporter', template: ['distance (cm)'], args: {}, output: 'number', hasNext: false, help: 'How far away the nearest object is.', keywords: ['sensor', 'read', 'ultrasonic'] },
  { type: 'sensor.line', category: 'sensors', shape: 'boolean', template: ['line detected?'], args: {}, output: 'boolean', hasNext: false, help: 'True when the robot is over the black line.', keywords: ['sensor', 'detect', 'track'] },
  { type: 'sensor.color', category: 'sensors', shape: 'boolean', template: ['color is', { arg: 'color' }, '?'], args: { color: { kind: 'dropdown', default: 'red', options: COLORS } }, output: 'boolean', hasNext: false, help: 'True when the floor under the robot has this colour.', keywords: ['sensor', 'read', 'colour'] },
  { type: 'sensor.obstacle', category: 'sensors', shape: 'boolean', template: ['obstacle ahead?'], args: {}, output: 'boolean', hasNext: false, help: 'True when something is close in front of the robot.', keywords: ['sensor', 'detect', 'bump'] },
  { type: 'sensor.value', category: 'sensors', shape: 'reporter', template: [{ arg: 'sensor' }, 'sensor value'], args: { sensor: { kind: 'dropdown', default: 'distance', options: SENSORS } }, output: 'number', hasNext: false, help: 'The raw number a sensor measures.', keywords: ['sensor', 'read'] },
  { type: 'sensor.robotX', category: 'sensors', shape: 'reporter', template: ['robot x (cm)'], args: {}, output: 'number', hasNext: false, help: 'Where the robot is, left ↔ right on the map.', keywords: ['position', 'coordinates', 'gps'] },
  { type: 'sensor.robotY', category: 'sensors', shape: 'reporter', template: ['robot y (cm)'], args: {}, output: 'number', hasNext: false, help: 'Where the robot is, down ↔ up on the map.', keywords: ['position', 'coordinates', 'gps'] },

  // Logic
  {
    type: 'logic.compare',
    category: 'logic',
    shape: 'boolean',
    template: [{ arg: 'a' }, { arg: 'op' }, { arg: 'b' }],
    args: { a: n('left value', 0), op: { kind: 'dropdown', default: '<', options: COMPARE }, b: n('right value', 20) },
    output: 'boolean',
    hasNext: false,
    help: 'Compare two numbers.',
    keywords: ['compare', 'less', 'greater', 'equal'],
  },
  { type: 'logic.and', category: 'logic', shape: 'boolean', template: [{ arg: 'a' }, 'and', { arg: 'b' }], args: { a: { kind: 'boolean' }, b: { kind: 'boolean' } }, output: 'boolean', hasNext: false, help: 'True when both conditions are true.' },
  { type: 'logic.or', category: 'logic', shape: 'boolean', template: [{ arg: 'a' }, 'or', { arg: 'b' }], args: { a: { kind: 'boolean' }, b: { kind: 'boolean' } }, output: 'boolean', hasNext: false, help: 'True when at least one condition is true.' },
  { type: 'logic.not', category: 'logic', shape: 'boolean', template: ['not', { arg: 'a' }], args: { a: { kind: 'boolean' } }, output: 'boolean', hasNext: false, help: 'Flips true and false.' },

  // Math
  { type: 'math.add', category: 'math', shape: 'reporter', template: [{ arg: 'a' }, '+', { arg: 'b' }], args: { a: n('first number', 1), b: n('second number', 1) }, output: 'number', hasNext: false, help: 'Add two numbers.', keywords: ['plus', 'sum'] },
  { type: 'math.subtract', category: 'math', shape: 'reporter', template: [{ arg: 'a' }, '−', { arg: 'b' }], args: { a: n('first number', 5), b: n('second number', 1) }, output: 'number', hasNext: false, help: 'Subtract two numbers.', keywords: ['minus'] },
  { type: 'math.multiply', category: 'math', shape: 'reporter', template: [{ arg: 'a' }, '×', { arg: 'b' }], args: { a: n('first number', 2), b: n('second number', 3) }, output: 'number', hasNext: false, help: 'Multiply two numbers.', keywords: ['times'] },
  { type: 'math.divide', category: 'math', shape: 'reporter', template: [{ arg: 'a' }, '÷', { arg: 'b' }], args: { a: n('first number', 10), b: n('second number', 2) }, output: 'number', hasNext: false, help: 'Divide two numbers.' },
  { type: 'math.random', category: 'math', shape: 'reporter', template: ['random', { arg: 'from' }, 'to', { arg: 'to' }], args: { from: n('smallest number', 1), to: n('largest number', 10) }, output: 'number', hasNext: false, help: 'A random whole number in a range.' },

  // Variables
  { type: 'variable.set', category: 'variables', shape: 'statement', template: ['set', { arg: 'name' }, 'to', { arg: 'value' }], args: { name: { kind: 'variable' }, value: n('value', 0) }, hasNext: true, help: 'Store a number in a variable.' },
  { type: 'variable.change', category: 'variables', shape: 'statement', template: ['change', { arg: 'name' }, 'by', { arg: 'delta' }], args: { name: { kind: 'variable' }, delta: n('amount', 1) }, hasNext: true, help: 'Add to (or subtract from) a variable.' },
  { type: 'variable.get', category: 'variables', shape: 'reporter', template: [{ arg: 'name' }], args: { name: { kind: 'variable' } }, output: 'number', hasNext: false, help: 'The number stored in a variable.' },
  { type: 'mission.value', category: 'variables', shape: 'reporter', template: ['mission', { arg: 'key' }], args: { key: { kind: 'dataKey' } }, output: 'number', hasNext: false, help: 'A number the mission gives you for this run.', keywords: ['data', 'mission', 'target', 'parameter'] },

  // Functions
  { type: 'function.define', category: 'functions', shape: 'hat', template: ['define', { arg: 'name' }], args: { name: { kind: 'text', default: 'my_task', label: 'function name' } }, hasNext: true, help: 'Give a group of blocks a name. Run it with “run …”.', keywords: ['function', 'def', 'procedure', 'my block'] },
  { type: 'function.call', category: 'functions', shape: 'statement', template: ['run', { arg: 'name' }], args: { name: { kind: 'functionName' } }, hasNext: true, help: 'Run the blocks of a function you defined.', keywords: ['function', 'call', 'procedure'] },
];

const BY_TYPE: ReadonlyMap<BlockType, BlockDef> = new Map(DEFS.map((d) => [d.type, d]));

export function getBlockDef(type: BlockType): BlockDef {
  const def = BY_TYPE.get(type);
  if (!def) throw new Error(`Unknown block type: ${type}`);
  return def;
}

export const isBlockType = (value: string): value is BlockType => BY_TYPE.has(value as BlockType);

export const CATEGORIES: readonly CategoryDef[] = [
  { id: 'events', label: 'Events', color: 'var(--color-cat-events)', palette: ['event.start', 'event.button', 'event.sensor'] },
  {
    id: 'movement',
    label: 'Movement',
    color: 'var(--color-cat-movement)',
    palette: ['motion.forward', 'motion.backward', 'motion.turnLeft', 'motion.turnRight', 'motion.stop', 'motion.speed', 'motion.goTo', 'action.pick', 'action.drop'],
  },
  {
    id: 'control',
    label: 'Control',
    color: 'var(--color-cat-control)',
    palette: ['control.wait', 'control.repeat', 'control.forever', 'control.while', 'control.until', 'control.break', 'control.if', 'control.ifElse'],
  },
  { id: 'sensors', label: 'Sensors', color: 'var(--color-cat-sensors)', palette: ['sensor.distance', 'sensor.line', 'sensor.color', 'sensor.obstacle', 'sensor.value', 'sensor.robotX', 'sensor.robotY'] },
  { id: 'logic', label: 'Logic', color: 'var(--color-cat-logic)', palette: ['control.if', 'control.ifElse', 'logic.compare', 'logic.and', 'logic.or', 'logic.not'] },
  { id: 'math', label: 'Math', color: 'var(--color-cat-math)', palette: ['math.add', 'math.subtract', 'math.multiply', 'math.divide', 'math.random'] },
  { id: 'variables', label: 'Variables', color: 'var(--color-cat-variables)', palette: ['variable.set', 'variable.change', 'variable.get', 'mission.value'] },
  { id: 'functions', label: 'Functions', color: 'var(--color-cat-functions)', palette: ['function.define', 'function.call'] },
];

export const categoryOf = (type: BlockType): CategoryDef => {
  const cat = getBlockDef(type).category;
  return CATEGORIES.find((c) => c.id === cat) ?? (CATEGORIES[0] as CategoryDef);
};

/** Readable label for a block ("move forward", "repeat times"), used in search, logs and tooltips. */
export const blockLabel = (type: BlockType): string =>
  getBlockDef(type)
    .template.filter((p): p is string => typeof p === 'string')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Short name for messages: the first words of the label ("repeat", "move forward"). */
export const blockName = (type: BlockType): string => {
  const first = getBlockDef(type).template.find((p): p is string => typeof p === 'string');
  return (first ?? blockLabel(type)).replace(/[?]/g, '').trim();
};

/**
 * Local, instant toolbox search. Matches block labels, keywords and the
 * category name ("move", "sensor", "loop"…). The start block is excluded
 * (a program has exactly one).
 */
export function searchBlocks(query: string): { category: CategoryDef; types: BlockType[] }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<BlockType>();
  const out: { category: CategoryDef; types: BlockType[] }[] = [];
  for (const category of CATEGORIES) {
    const types = category.palette.filter((type) => {
      if (type === 'event.start' || seen.has(type)) return false;
      const def = getBlockDef(type);
      const haystack = [blockLabel(type), category.label, ...(def.keywords ?? [])].join(' ').toLowerCase();
      return haystack.includes(q);
    });
    types.forEach((t) => seen.add(t));
    if (types.length) out.push({ category, types });
  }
  return out;
}
