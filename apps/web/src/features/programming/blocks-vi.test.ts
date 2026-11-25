import { beforeEach, describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  START_ID,
  checkStructure,
  createStarterProgram,
  getBlockDef,
  type BlockType,
  type TemplatePart,
} from '@robolab/blocks';
import {
  BLOCKS_VI,
  CATEGORY_LABELS_VI,
  categoryLabel,
  localizedBlockDef,
  normalizeSearchText,
  searchLocalizedBlocks,
} from './blocks-vi';
import { addBlockFromPalette } from './editor/drag-controller';
import { localizeBlockIssue } from './programming.messages';
import { useProgramStore } from './state/program-store';

const argOrder = (template: readonly TemplatePart[]): string[] =>
  template.filter((p): p is { readonly arg: string } => typeof p !== 'string').map((p) => p.arg);

const ALL_BLOCK_TYPES = Object.keys(BLOCKS_VI) as BlockType[];

describe('blocks-vi localization', () => {
  it('every BlockType has a Vietnamese entry whose template preserves the exact args in the same order', () => {
    // Also verify every block listed in CATEGORIES is covered.
    for (const cat of CATEGORIES) {
      for (const type of cat.palette) {
        expect(BLOCKS_VI[type], `Missing VI entry for palette block ${type}`).toBeDefined();
      }
    }

    for (const type of ALL_BLOCK_TYPES) {
      const en = getBlockDef(type);
      const viEntry = BLOCKS_VI[type];
      expect(viEntry.template, `${type} should define a VI template`).toBeDefined();
      expect(viEntry.template!.length, `${type} VI template must not be empty`).toBeGreaterThan(0);
      expect(viEntry.help?.trim().length, `${type} VI help must not be empty`).toBeGreaterThan(0);

      const vi = localizedBlockDef(type, 'vi');
      expect(argOrder(vi.template), `${type} arg order mismatch`).toEqual(argOrder(en.template));

      // Slots keep identical names & order; non-null labels are localized.
      expect(vi.slots?.map((s) => s.name)).toEqual(en.slots?.map((s) => s.name));
      if (type === 'control.ifElse') {
        expect(vi.slots?.[1]?.label).toBe('không thì');
      }

      // Dropdown values stay identical to English so program serialization is unaffected.
      for (const [argName, enArg] of Object.entries(en.args)) {
        const viArg = vi.args[argName];
        expect(viArg?.kind, `${type}.${argName} kind mismatch`).toBe(enArg.kind);
        if (enArg.kind === 'dropdown' && viArg?.kind === 'dropdown') {
          expect(viArg.options.map((o) => o.value)).toEqual(enArg.options.map((o) => o.value));
        }
      }
    }
  });

  it('every category has a Vietnamese label and preserves English in en locale', () => {
    for (const cat of CATEGORIES) {
      expect(CATEGORY_LABELS_VI[cat.id].trim().length).toBeGreaterThan(0);
      expect(categoryLabel(cat.id, 'vi')).toBe(CATEGORY_LABELS_VI[cat.id]);
      expect(categoryLabel(cat.id, 'en')).toBe(cat.label);
    }
  });

  it('localizedBlockDef returns exact English def for en locale', () => {
    for (const type of ALL_BLOCK_TYPES) {
      expect(localizedBlockDef(type, 'en')).toBe(getBlockDef(type));
    }
  });

  it('normalizes Vietnamese diacritics including đ/Đ', () => {
    expect(normalizeSearchText('Rẽ trái')).toBe('re trai');
    expect(normalizeSearchText('Đặt tốc độ')).toBe('dat toc do');
    expect(normalizeSearchText('Lặp cho đến khi')).toBe('lap cho den khi');
  });

  it('search matches Vietnamese (with & without diacritics) and English, excluding event.start', () => {
    const typesFor = (q: string) => searchLocalizedBlocks(q).flatMap((g) => g.types);

    // Diacritic-free Vietnamese
    expect(typesFor('re trai')).toContain('motion.turnLeft');
    expect(typesFor('rẽ trái')).toContain('motion.turnLeft');
    expect(typesFor('re phai')).toContain('motion.turnRight');
    expect(typesFor('tien')).toContain('motion.forward');
    expect(typesFor('vong lap')).toEqual(expect.arrayContaining(['control.repeat', 'control.forever', 'control.while', 'control.until']));
    expect(typesFor('khoang cach')).toContain('sensor.distance');
    expect(typesFor('thung hang')).toEqual(expect.arrayContaining(['action.pick', 'action.drop']));
    expect(typesFor('dat toc do')).toContain('motion.speed');

    // English still matches
    expect(typesFor('turn left')).toContain('motion.turnLeft');
    expect(typesFor('move')).toEqual(expect.arrayContaining(['motion.forward', 'motion.backward', 'motion.turnLeft', 'motion.turnRight']));
    expect(typesFor('sensor')).toEqual(expect.arrayContaining(['sensor.distance', 'sensor.line', 'sensor.color', 'sensor.obstacle']));

    // Start block is never offered in search
    expect(typesFor('start')).not.toContain('event.start');
    expect(typesFor('bat dau')).not.toContain('event.start');
  });

  it('localizes block validation issues in Vietnamese while keeping English exact', () => {
    const enMsg = 'The speed should be between 0 and 100 %.';
    expect(localizeBlockIssue(enMsg, 'en')).toBe(enMsg);
    expect(localizeBlockIssue(enMsg, 'vi')).toBe('Tốc độ nên nằm từ 0 đến 100 %.');
    expect(localizeBlockIssue('Type a number for distance.', 'vi')).toBe('Nhập một số cho khoảng cách.');
    expect(localizeBlockIssue('Dividing by zero has no answer.', 'vi')).toBe('Không thể chia cho 0.');
    expect(localizeBlockIssue('There are two functions called “patrol”.', 'vi')).toBe('Có hai hàm cùng tên “patrol”.');
  });
});

describe('tap-to-add from toolbox', () => {
  beforeEach(() => {
    useProgramStore.setState({
      program: createStarterProgram(),
      history: { past: [], future: [], lastKey: null, lastAt: 0 },
      selectedId: null,
    });
  });

  it('appends tapped statement blocks to the stack and snaps boolean blocks into a selected if', () => {
    const fwdId = addBlockFromPalette('motion.forward');
    expect(fwdId).toBeTruthy();
    expect(useProgramStore.getState().program.blocks[START_ID]?.next).toBe(fwdId);

    const ifId = addBlockFromPalette('control.if');
    expect(ifId).toBeTruthy();
    expect(useProgramStore.getState().program.blocks[fwdId!]?.next).toBe(ifId);

    // Selecting the if block and tapping a boolean sensor snaps it into `condition`.
    useProgramStore.getState().select(ifId);
    const condId = addBlockFromPalette('sensor.obstacle');
    expect(condId).toBeTruthy();
    expect(useProgramStore.getState().program.blocks[ifId!]?.inputs.condition).toBe(condId);
    expect(checkStructure(useProgramStore.getState().program)).toEqual([]);
  });
});
