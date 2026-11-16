/**
 * OneRoboLab block program data model — the single source of truth for the
 * editor. Plain serializable data: no JSX, no functions. UI 5 compiles this
 * graph (validator → compiler → robot IR).
 *
 * Structure:
 *   - Statement stacks are linked lists via `next`.
 *   - C-blocks hold the *first* block of each nested stack in `slots`.
 *   - Value inputs (numbers/conditions) may hold a reporter block id in
 *     `inputs`; when empty, the literal in `fields` is used.
 *   - `roots` are the stacks placed on the workspace; roots[0] is always the
 *     "When program starts" block.
 */

export type BlockId = string;

export type BlockCategoryId = 'events' | 'movement' | 'control' | 'sensors' | 'logic' | 'math' | 'variables' | 'functions';

export type BlockType =
  | 'event.start'
  | 'event.button'
  | 'event.sensor'
  | 'motion.step'
  | 'motion.forward'
  | 'motion.backward'
  | 'motion.turnLeft'
  | 'motion.turnRight'
  | 'motion.stop'
  | 'motion.speed'
  | 'motion.goTo'
  | 'action.pick'
  | 'action.drop'
  | 'control.wait'
  | 'control.repeat'
  | 'control.forever'
  | 'control.while'
  | 'control.until'
  | 'control.break'
  | 'control.if'
  | 'control.ifElse'
  | 'sensor.distance'
  | 'sensor.line'
  | 'sensor.color'
  | 'sensor.obstacle'
  | 'sensor.value'
  | 'sensor.robotX'
  | 'sensor.robotY'
  | 'mission.value'
  | 'logic.compare'
  | 'logic.and'
  | 'logic.or'
  | 'logic.not'
  | 'math.add'
  | 'math.subtract'
  | 'math.multiply'
  | 'math.divide'
  | 'math.random'
  | 'variable.set'
  | 'variable.change'
  | 'variable.get'
  | 'function.define'
  | 'function.call';

/**
 * hat       – starts a script (no block above)
 * statement – one action in a stack
 * c         – wraps nested stacks (repeat, if…)
 * reporter  – round value block (number)
 * boolean   – hexagonal yes/no block (condition)
 */
export type BlockShape = 'hat' | 'statement' | 'c' | 'reporter' | 'boolean';

export type ValueType = 'number' | 'boolean';

export interface DropdownOption {
  readonly value: string;
  readonly label: string;
}

export type ArgDef =
  | {
      readonly kind: 'number';
      readonly default: number;
      readonly min?: number;
      readonly max?: number;
      readonly integer?: boolean;
      readonly unit?: string;
      /** Student-facing name used in validation messages ("distance"). */
      readonly label: string;
    }
  | { readonly kind: 'dropdown'; readonly default: string; readonly options: readonly DropdownOption[] }
  /** Empty hexagon socket that takes a boolean block. */
  | { readonly kind: 'boolean' }
  | { readonly kind: 'variable' }
  /** A short name typed by the student (function names). */
  | { readonly kind: 'text'; readonly default: string; readonly label: string }
  /** One of the numbers the current mission provides (`mission.target`). */
  | { readonly kind: 'dataKey' }
  /** One of the functions defined in the program. */
  | { readonly kind: 'functionName' };

/** Text or an argument placeholder in a block's label. */
export type TemplatePart = string | { readonly arg: string };

export interface SlotDef {
  readonly name: string;
  /** Label on the divider arm above this slot (`else`); null for the first slot. */
  readonly label: string | null;
}

export interface BlockDef {
  readonly type: BlockType;
  readonly category: BlockCategoryId;
  readonly shape: BlockShape;
  readonly template: readonly TemplatePart[];
  readonly args: Readonly<Record<string, ArgDef>>;
  readonly slots?: readonly SlotDef[];
  /** Value produced by reporter/boolean blocks. */
  readonly output?: ValueType;
  /** Whether a block can follow this one (false for forever). */
  readonly hasNext: boolean;
  /** One-line, student-friendly explanation (tooltip). */
  readonly help: string;
  /** Extra search words. */
  readonly keywords?: readonly string[];
}

/** Literal field value. `''` means the student cleared a number field. */
export type FieldValue = number | string;

export interface BlockInstance {
  readonly id: BlockId;
  readonly type: BlockType;
  readonly fields: Readonly<Record<string, FieldValue>>;
  readonly inputs: Readonly<Record<string, BlockId | null>>;
  readonly slots: Readonly<Record<string, BlockId | null>>;
  readonly next: BlockId | null;
  readonly comment?: string;
  readonly disabled?: boolean;
}

export interface RootPlacement {
  readonly id: BlockId;
  /** Workspace content coordinates (px at zoom 1). */
  readonly x: number;
  readonly y: number;
}

export interface ProgramState {
  readonly version: 1;
  readonly blocks: Readonly<Record<BlockId, BlockInstance>>;
  readonly roots: readonly RootPlacement[];
  readonly variables: readonly string[];
}

/** A detached block tree (clipboard, palette item, drag payload). */
export interface BlockFragment {
  readonly rootId: BlockId;
  readonly blocks: Readonly<Record<BlockId, BlockInstance>>;
}

/** Where a dragged block (stack) will be connected. */
export type DropTarget =
  | { readonly kind: 'after'; readonly blockId: BlockId }
  | { readonly kind: 'slot'; readonly blockId: BlockId; readonly slot: string }
  | { readonly kind: 'input'; readonly blockId: BlockId; readonly input: string }
  | { readonly kind: 'workspace'; readonly x: number; readonly y: number };

/** How a block is attached to its parent. */
export type ParentRef =
  | { readonly kind: 'root'; readonly index: number }
  | { readonly kind: 'next'; readonly id: BlockId }
  | { readonly kind: 'slot'; readonly id: BlockId; readonly slot: string }
  | { readonly kind: 'input'; readonly id: BlockId; readonly input: string };
