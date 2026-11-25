import type { BlockCategoryId } from '@robolab/blocks';
import { Braces, Calculator, Flag, Move, Radar, Repeat, Split, Variable, type LucideIcon } from 'lucide-react';

/** Toolbox icon per block category (the category data itself lives in `@robolab/blocks`). */
export const CATEGORY_ICONS: Readonly<Record<BlockCategoryId, LucideIcon>> = {
  events: Flag,
  movement: Move,
  control: Repeat,
  sensors: Radar,
  logic: Split,
  math: Calculator,
  variables: Variable,
  functions: Braces,
};
