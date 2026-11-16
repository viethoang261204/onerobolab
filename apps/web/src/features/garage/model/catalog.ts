import type { AccessoryId, AnimationId, DecalId, DecalPlacement, PartId, PatternId, RobotModelId, WheelStyleId } from './robot-config';

/*
 * What can be chosen in the garage (pure data). Items may carry an unlock
 * rule tied to the journey; `unlocks.ts` evaluates them against progress.
 */

export type UnlockRule =
  | { readonly type: 'free' }
  /** The world with this order is open (reached). */
  | { readonly type: 'world'; readonly world: number }
  /** This many missions completed. */
  | { readonly type: 'missions'; readonly count: number };

const FREE: UnlockRule = { type: 'free' };

export interface ModelInfo {
  readonly id: RobotModelId;
  readonly name: string;
  readonly role: string;
  /** Parts this model has, in panel order (label per model: "Legs" for the biped). */
  readonly parts: readonly { readonly id: PartId; readonly label: string }[];
  readonly decalPlacements: readonly DecalPlacement[];
  readonly unlock: UnlockRule;
}

const STANDARD_PARTS = [
  { id: 'body', label: 'Body' },
  { id: 'head', label: 'Head' },
  { id: 'trim', label: 'Frame' },
  { id: 'accent', label: 'Panels' },
  { id: 'wheels', label: 'Wheels' },
  { id: 'led', label: 'LEDs' },
] as const;

export const MODELS: readonly ModelInfo[] = [
  { id: 'rover', name: 'Rover', role: 'Friendly explorer on four wheels', parts: STANDARD_PARTS, decalPlacements: ['side-left', 'side-right', 'top', 'front'], unlock: FREE },
  { id: 'scout', name: 'Scout', role: 'Light and fast, tall sensor mast', parts: STANDARD_PARTS, decalPlacements: ['side-left', 'side-right', 'top'], unlock: FREE },
  {
    id: 'tank',
    name: 'Tank',
    role: 'Heavy industrial robot on tracks',
    parts: [STANDARD_PARTS[0], { id: 'head', label: 'Turret' }, STANDARD_PARTS[2], STANDARD_PARTS[3], { id: 'wheels', label: 'Tracks' }, STANDARD_PARTS[5]],
    decalPlacements: ['side-left', 'side-right', 'front', 'head'],
    unlock: { type: 'world', world: 2 },
  },
  {
    id: 'biped',
    name: 'Biped',
    role: 'Humanoid helper that walks and waves',
    parts: [{ id: 'body', label: 'Torso' }, STANDARD_PARTS[1], STANDARD_PARTS[2], { id: 'accent', label: 'Arms' }, { id: 'wheels', label: 'Legs' }, STANDARD_PARTS[5]],
    decalPlacements: ['front', 'head'],
    unlock: { type: 'world', world: 3 },
  },
];

export const modelInfo = (id: RobotModelId): ModelInfo => MODELS.find((m) => m.id === id) ?? MODELS[0]!;

/** Paint palette (spec order) — plus a custom colour picker in the UI. */
export const PALETTE: readonly { readonly name: string; readonly hex: string }[] = [
  { name: 'White', hex: '#f3f5fa' },
  { name: 'Black', hex: '#1a1d26' },
  { name: 'Gray', hex: '#64748b' },
  { name: 'Navy', hex: '#223055' },
  { name: 'Blue', hex: '#2d6bf0' },
  { name: 'Cyan', hex: '#22d3ee' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#facc15' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
];

/** Ready-made two-tone looks (a quick start). */
export const COMBOS: readonly { readonly name: string; readonly colors: Readonly<Partial<Record<PartId, string>>> }[] = [
  { name: 'White + Cyan', colors: { body: '#f3f5fa', head: '#f3f5fa', accent: '#22d3ee', trim: '#223055', led: '#22d3ee' } },
  { name: 'Black + Red', colors: { body: '#1a1d26', head: '#1a1d26', accent: '#ef4444', trim: '#334155', led: '#ef4444' } },
  { name: 'Blue + Yellow', colors: { body: '#2d6bf0', head: '#f3f5fa', accent: '#facc15', trim: '#1e3a8a', led: '#facc15' } },
  { name: 'Purple + Pink', colors: { body: '#8b5cf6', head: '#f3f5fa', accent: '#ec4899', trim: '#3b0764', led: '#f472b6' } },
];

export const PATTERNS: readonly { readonly id: PatternId; readonly name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'stripes', name: 'Stripes' },
  { id: 'camo', name: 'Camo' },
  { id: 'digital', name: 'Digital' },
  { id: 'carbon', name: 'Carbon' },
  { id: 'flame', name: 'Flame' },
  { id: 'circuit', name: 'Circuit' },
  { id: 'warning', name: 'Warning' },
  { id: 'gradient', name: 'Gradient' },
];

export const DECALS: readonly { readonly id: DecalId; readonly name: string }[] = [
  { id: 'logo', name: 'Onespace' },
  { id: 'star', name: 'Star' },
  { id: 'lightning', name: 'Lightning' },
  { id: 'rocket', name: 'Rocket' },
  { id: 'shield', name: 'Shield' },
  { id: 'gear', name: 'Gear' },
  { id: 'number', name: 'Number' },
  { id: 'initials', name: 'Initials' },
];

export const PLACEMENT_LABEL: Readonly<Record<DecalPlacement, string>> = {
  'side-left': 'Left side',
  'side-right': 'Right side',
  front: 'Front',
  top: 'Top',
  head: 'Head',
};

export interface AccessoryInfo {
  readonly id: AccessoryId;
  readonly name: string;
  readonly unlock: UnlockRule;
}

export const ACCESSORIES: readonly AccessoryInfo[] = [
  { id: 'antenna', name: 'Antenna', unlock: FREE },
  { id: 'head-light', name: 'Head Light', unlock: FREE },
  { id: 'flag', name: 'Small Flag', unlock: FREE },
  { id: 'side-sensor', name: 'Sensor Pack', unlock: { type: 'world', world: 2 } },
  { id: 'backpack', name: 'Explorer Pack', unlock: { type: 'missions', count: 5 } },
  { id: 'solar-panel', name: 'Solar Panel', unlock: { type: 'world', world: 3 } },
  { id: 'tool-arm', name: 'Tool Arm', unlock: { type: 'world', world: 4 } },
  { id: 'mini-drone', name: 'Mini Drone', unlock: { type: 'world', world: 5 } },
  { id: 'shield', name: 'Lava Shield', unlock: { type: 'world', world: 6 } },
];

export const WHEEL_STYLES: readonly { readonly id: WheelStyleId; readonly name: string; readonly unlock: UnlockRule }[] = [
  { id: 'standard', name: 'Standard', unlock: FREE },
  { id: 'all-terrain', name: 'Canyon Wheels', unlock: { type: 'world', world: 2 } },
  { id: 'snow', name: 'Snow Tires', unlock: { type: 'world', world: 3 } },
];

export const ANIMATIONS: readonly { readonly id: AnimationId; readonly name: string; readonly hint: string }[] = [
  { id: 'idle', name: 'Idle', hint: 'Gentle breathing' },
  { id: 'wave', name: 'Wave', hint: 'Say hello' },
  { id: 'scan', name: 'Scan', hint: 'Look around with sensors' },
  { id: 'celebrate', name: 'Celebrate', hint: 'Happy hop' },
  { id: 'drive', name: 'Drive', hint: 'Show off the wheels' },
  { id: 'victory', name: 'Victory', hint: 'Mission complete spin' },
];
