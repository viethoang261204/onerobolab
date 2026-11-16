/*
 * The student's personal robot: a plain, serialisable configuration (the
 * same JSON goes to localStorage today and to the backend later). Rendering
 * reads it (`RobotAvatar`, the simulator robot); nothing here imports React
 * or three.js.
 */

export type RobotModelId = 'rover' | 'scout' | 'tank' | 'biped';

/**
 * Paintable parts. Every model maps its meshes onto these:
 *   body   main shell        head    head / sensor housing
 *   trim   chassis, frame    accent  panels, stripes
 *   wheels tyres / tracks / legs    led  eyes, light bars (emissive)
 */
export type PartId = 'body' | 'head' | 'trim' | 'accent' | 'wheels' | 'led';
export const PART_IDS: readonly PartId[] = ['body', 'head', 'trim', 'accent', 'wheels', 'led'];

export type PatternId = 'none' | 'stripes' | 'camo' | 'digital' | 'carbon' | 'flame' | 'circuit' | 'warning' | 'gradient';
export type DecalId = 'logo' | 'star' | 'lightning' | 'rocket' | 'shield' | 'gear' | 'number' | 'initials';
/** Where a decal sits (each model supports a subset). */
export type DecalPlacement = 'side-left' | 'side-right' | 'front' | 'top' | 'head';
export type AccessoryId = 'antenna' | 'backpack' | 'flag' | 'solar-panel' | 'side-sensor' | 'head-light' | 'tool-arm' | 'shield' | 'mini-drone';
export type WheelStyleId = 'standard' | 'all-terrain' | 'snow';
export type AnimationId = 'idle' | 'wave' | 'scan' | 'celebrate' | 'drive' | 'victory';

export interface DecalConfig {
  readonly id: DecalId;
  readonly placement: DecalPlacement;
  readonly color: string;
  /** Number / initials (max 3 characters). */
  readonly text?: string;
}

export interface RobotConfiguration {
  readonly version: 1;
  readonly name: string;
  readonly model: RobotModelId;
  readonly colors: Readonly<Record<PartId, string>>;
  /** Surface pattern per part (missing = none). */
  readonly patterns: Readonly<Partial<Record<PartId, PatternId>>>;
  readonly decals: readonly DecalConfig[];
  readonly accessories: readonly AccessoryId[];
  readonly wheelStyle: WheelStyleId;
  readonly animation: AnimationId;
}

export const DEFAULT_COLORS: Readonly<Record<PartId, string>> = {
  body: '#f3f5fa',
  head: '#f3f5fa',
  trim: '#223055',
  accent: '#2d6bf0',
  wheels: '#1a1d26',
  led: '#22d3ee',
};

export const DEFAULT_CONFIG: RobotConfiguration = {
  version: 1,
  name: 'My Robot',
  model: 'rover',
  colors: DEFAULT_COLORS,
  patterns: {},
  decals: [],
  accessories: [],
  wheelStyle: 'standard',
  animation: 'idle',
};

/** At most one decal per placement, and a few in total. */
export const MAX_DECALS = 3;

const MODELS: readonly RobotModelId[] = ['rover', 'scout', 'tank', 'biped'];
const PATTERNS: readonly PatternId[] = ['none', 'stripes', 'camo', 'digital', 'carbon', 'flame', 'circuit', 'warning', 'gradient'];
const DECALS: readonly DecalId[] = ['logo', 'star', 'lightning', 'rocket', 'shield', 'gear', 'number', 'initials'];
const PLACEMENTS: readonly DecalPlacement[] = ['side-left', 'side-right', 'front', 'top', 'head'];
const ACCESSORIES: readonly AccessoryId[] = ['antenna', 'backpack', 'flag', 'solar-panel', 'side-sensor', 'head-light', 'tool-arm', 'shield', 'mini-drone'];
const WHEELS: readonly WheelStyleId[] = ['standard', 'all-terrain', 'snow'];
const ANIMATIONS: readonly AnimationId[] = ['idle', 'wave', 'scan', 'celebrate', 'drive', 'victory'];

const HEX = /^#[0-9a-f]{6}$/i;
const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const color = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Clean decal text: letters/digits only, upper case, max 3. */
export const decalText = (s: string) => s.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 3);

/**
 * Any stored / received value → a valid configuration (unknown values fall
 * back to defaults, never throw). The single entry point for persisted data.
 */
export function normalizeConfig(raw: unknown): RobotConfiguration {
  const r = obj(raw);
  const c = obj(r.colors);
  const p = obj(r.patterns);
  const colors = Object.fromEntries(PART_IDS.map((part) => [part, color(c[part], DEFAULT_COLORS[part])])) as Record<PartId, string>;
  const patterns: Partial<Record<PartId, PatternId>> = {};
  for (const part of PART_IDS) {
    const v = pick(PATTERNS, p[part], 'none');
    if (v !== 'none' && part !== 'led') patterns[part] = v;
  }
  const seen = new Set<DecalPlacement>();
  const decals: DecalConfig[] = [];
  for (const d of Array.isArray(r.decals) ? r.decals : []) {
    const o = obj(d);
    const id = pick(DECALS, o.id, 'star');
    const placement = pick(PLACEMENTS, o.placement, 'side-left');
    if (!DECALS.includes(o.id as DecalId) || seen.has(placement) || decals.length >= MAX_DECALS) continue;
    seen.add(placement);
    const text = typeof o.text === 'string' ? decalText(o.text) : '';
    decals.push({ id, placement, color: color(o.color, '#ffffff'), ...(text && (id === 'number' || id === 'initials') ? { text } : {}) });
  }
  const accessories = [...new Set((Array.isArray(r.accessories) ? r.accessories : []).filter((a): a is AccessoryId => ACCESSORIES.includes(a as AccessoryId)))];
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 24) : DEFAULT_CONFIG.name;
  return {
    version: 1,
    name,
    model: pick(MODELS, r.model, 'rover'),
    colors,
    patterns,
    decals,
    accessories,
    wheelStyle: pick(WHEELS, r.wheelStyle, 'standard'),
    animation: pick(ANIMATIONS, r.animation, 'idle'),
  };
}

/** Structural equality (for "unsaved changes"). */
export const sameConfig = (a: RobotConfiguration, b: RobotConfiguration) => JSON.stringify(normalizeConfig(a)) === JSON.stringify(normalizeConfig(b));
