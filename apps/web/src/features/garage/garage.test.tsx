import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/i18n';
import type { ProgressData } from '../levels/progress';
import { memoryStorage } from '../persistence/storage';
import { parseRoute, paths } from '../router/routes';
import { CustomizationPanel } from './components/CustomizationPanel';
import { ACCESSORIES, MODELS, modelInfo } from './model/catalog';
import { DEFAULT_CONFIG, MAX_DECALS, normalizeConfig, sameConfig } from './model/robot-config';
import { isUnlocked, unlockHint } from './model/unlocks';
import { DECAL_ANCHORS, MOUNTS } from './render/mounts';
import { previewConfig, useGarageStore, type GarageCategory } from './state/garage-store';
import { localRobotPersistence, MAX_ROBOTS, normalizeCollection, setRobotPersistence, useRobotStore } from './state/robot-store';
import { unlockContext } from './state/unlock-context';

const render = (el: ReactElement) => renderToString(el).replace(/<!-- -->/g, '');
const EMPTY: ProgressData = { version: 1, levels: {}, lastLevelId: null };
const done = { completed: true, bestStars: 3, bestTime: 10, attempts: 1, completedAt: '2026-09-01T10:00:00.000Z' };
const starterDone: ProgressData = { ...EMPTY, levels: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`starter-${String(i + 1).padStart(2, '0')}`, done])) };

beforeEach(() => {
  useGarageStore.getState().open(0, DEFAULT_CONFIG);
  useGarageStore.setState({ category: 'robot' });
});

describe('robot configuration', () => {
  it('normalises anything stored into a valid robot (never throws)', () => {
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(normalizeConfig('garbage')).toEqual(DEFAULT_CONFIG);
    const c = normalizeConfig({
      model: 'tank',
      colors: { body: '#FF0000', head: 'red', wheels: '#123456' },
      patterns: { body: 'camo', led: 'flame', head: 'unknown' },
      decals: [
        { id: 'star', placement: 'top', color: '#ffffff' },
        { id: 'number', placement: 'top', color: '#000000', text: '7' },
        { id: 'initials', placement: 'front', color: '#00ff00', text: 'a-b-c-d' },
        { id: 'nope', placement: 'head' },
      ],
      accessories: ['antenna', 'antenna', 'jetpack'],
      wheelStyle: 'hover',
      animation: 'wave',
    });
    expect(c.model).toBe('tank');
    expect(c.colors).toMatchObject({ body: '#ff0000', head: DEFAULT_CONFIG.colors.head, wheels: '#123456' });
    expect(c.patterns).toEqual({ body: 'camo' }); // LEDs have no pattern, unknown ids dropped
    expect(c.decals.map((d) => [d.placement, d.id, d.text])).toEqual([
      ['top', 'star', undefined],
      ['front', 'initials', 'ABC'],
    ]);
    expect(c.accessories).toEqual(['antenna']);
    expect(c.wheelStyle).toBe('standard');
    expect(c.animation).toBe('wave');
    expect(normalizeConfig(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });

  it('every model has its own parts, mounts and decal anchors for its placements', () => {
    for (const m of MODELS) {
      expect(m.parts.map((p) => p.id).sort()).toEqual(['accent', 'body', 'head', 'led', 'trim', 'wheels']);
      expect(MOUNTS[m.id]).toBeDefined();
      for (const p of m.decalPlacements) expect(DECAL_ANCHORS[m.id][p], `${m.id} ${p}`).toBeDefined();
    }
    expect(modelInfo('biped').parts.find((p) => p.id === 'wheels')?.label).toBe('Legs');
  });
});

describe('garage editing', () => {
  it('paints each part independently, with hover preview on the selected part only', () => {
    const g = useGarageStore.getState();
    g.selectPart('body');
    g.paint('#2d6bf0');
    g.selectPart('head');
    g.paint('#f3f5fa');
    g.paint('#1a1d26', 'wheels');
    g.paint('#f97316', 'accent');
    g.paint('#22d3ee', 'led');
    const d = useGarageStore.getState().draft;
    expect(d.colors).toEqual({ body: '#2d6bf0', head: '#f3f5fa', trim: DEFAULT_CONFIG.colors.trim, accent: '#f97316', wheels: '#1a1d26', led: '#22d3ee' });

    useGarageStore.getState().previewColor('#ef4444');
    const shown = previewConfig(useGarageStore.getState());
    expect(shown.colors.head).toBe('#ef4444');
    expect(shown.colors.body).toBe('#2d6bf0');
    expect(useGarageStore.getState().draft.colors.head).toBe('#f3f5fa'); // not applied
  });

  it('undo / redo / reset (reset is undoable and keeps the name)', () => {
    const g = useGarageStore.getState();
    g.rename('Sparky');
    g.paint('#ef4444', 'body');
    g.setPattern('stripes', 'body');
    expect(useGarageStore.getState().past).toHaveLength(3);
    useGarageStore.getState().undo();
    expect(useGarageStore.getState().draft.patterns.body).toBeUndefined();
    useGarageStore.getState().redo();
    expect(useGarageStore.getState().draft.patterns.body).toBe('stripes');
    useGarageStore.getState().reset();
    expect(useGarageStore.getState().draft).toEqual({ ...DEFAULT_CONFIG, name: 'Sparky' });
    useGarageStore.getState().undo();
    expect(useGarageStore.getState().draft.colors.body).toBe('#ef4444');
    // No-op edits don't pollute history.
    const n = useGarageStore.getState().past.length;
    useGarageStore.getState().paint('#ef4444', 'body');
    expect(useGarageStore.getState().past).toHaveLength(n);
  });

  it('decals: one per placement, at most three, and a model switch drops decals it has no room for', () => {
    const g = useGarageStore.getState();
    g.setDecal('side-left', { id: 'star', color: '#ffffff' });
    g.setDecal('side-left', { id: 'rocket', color: '#ffffff' });
    g.setDecal('top', { id: 'number', color: '#000000', text: '42' });
    g.setDecal('front', { id: 'logo', color: '#22d3ee' });
    g.setDecal('side-right', { id: 'gear', color: '#ffffff' });
    const decals = useGarageStore.getState().draft.decals;
    expect(decals).toHaveLength(MAX_DECALS);
    expect(decals.find((d) => d.placement === 'side-left')).toBeUndefined(); // oldest replaced
    expect(decals.find((d) => d.placement === 'top')?.text).toBe('42');
    useGarageStore.getState().setModel('biped');
    expect(useGarageStore.getState().draft.decals.map((d) => d.placement)).toEqual(['front']);
  });

  it('accessories toggle; animations are part of the robot', () => {
    const g = useGarageStore.getState();
    g.toggleAccessory('antenna');
    g.toggleAccessory('flag');
    g.toggleAccessory('antenna');
    g.setAnimation('celebrate');
    expect(useGarageStore.getState().draft).toMatchObject({ accessories: ['flag'], animation: 'celebrate' });
  });
});

describe('saved robots', () => {
  it('are stored per student, the active one is the personal robot, and bad data is repaired', () => {
    const storage = memoryStorage();
    setRobotPersistence(localRobotPersistence(storage));
    const s = useRobotStore.getState();
    s.setNamespace('student-a');
    s.saveRobot(0, { ...DEFAULT_CONFIG, name: 'Alpha', model: 'scout' });
    s.saveRobot(1, { ...DEFAULT_CONFIG, name: 'Beta' });
    expect(useRobotStore.getState()).toMatchObject({ active: 1 });
    useRobotStore.getState().setActive(0);

    useRobotStore.getState().setNamespace('student-b');
    expect(useRobotStore.getState().robots.map((r) => r.name)).toEqual(['My Robot']); // nobody else's robots
    useRobotStore.getState().setNamespace('student-a');
    expect(useRobotStore.getState().robots.map((r) => r.name)).toEqual(['Alpha', 'Beta']);
    expect(useRobotStore.getState().active).toBe(0);

    expect(normalizeCollection({ robots: Array.from({ length: 9 }, () => ({})), active: 99 })).toMatchObject({ active: 0 });
    expect(normalizeCollection({ robots: Array.from({ length: 9 }, () => ({})) }).robots).toHaveLength(MAX_ROBOTS);
    expect(sameConfig(DEFAULT_CONFIG, normalizeConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG))))).toBe(true);
    useRobotStore.getState().setNamespace(null);
  });
});

describe('unlocks follow the journey', () => {
  it('a fresh student has the basics; finishing Starter Island opens World 2 items', () => {
    const fresh = unlockContext(EMPTY);
    const tank = modelInfo('tank').unlock;
    expect(isUnlocked(modelInfo('rover').unlock, fresh)).toBe(true);
    expect(isUnlocked(tank, fresh)).toBe(false);
    expect(unlockHint(tank, fresh)).toBe('Reach World 2 · Canyon Circuit');
    const sensor = ACCESSORIES.find((a) => a.id === 'side-sensor')!.unlock;
    expect(isUnlocked(sensor, fresh)).toBe(false);
    const later = unlockContext(starterDone);
    expect(isUnlocked(tank, later)).toBe(true);
    expect(isUnlocked(sensor, later)).toBe(true);
    const pack = ACCESSORIES.find((a) => a.id === 'backpack')!.unlock;
    expect(unlockHint(pack, unlockContext({ ...EMPTY, levels: { 'starter-01': done, 'starter-02': done, 'starter-03': done } }))).toBe('Complete 5 missions (3/5)');
    expect(isUnlocked(pack, later)).toBe(true);
  });
});

describe('garage page', () => {
  it('has its own route', () => {
    expect(parseRoute('/robots')).toEqual({ name: 'robots' });
    expect(parseRoute(paths.robots())).toEqual({ name: 'robots' });
  });

  it('each category shows only its own controls, locks in words', () => {
    const ctx = unlockContext(EMPTY);
    const html = (c: GarageCategory) => render(<CustomizationPanel ctx={ctx} category={c} />);
    const robot = html('robot');
    expect(robot).toContain('Robot model');
    expect(robot).toContain('Tank — locked. Reach World 2 · Canyon Circuit');
    expect(robot).not.toContain('Patterns');
    const paint = html('paint');
    expect(paint).toContain('Paint · Body');
    expect(paint).toContain('White + Cyan');
    expect(paint).toContain('aria-label="Custom colour"');
    expect(html('patterns')).toContain('Carbon');
    expect(html('patterns')).not.toContain('>LEDs<'); // no patterns on lights
    expect(html('decals')).toContain('Left side');
    expect(html('accessories')).toContain('Lava Shield — locked. Reach World 6 · Lava Core');
    expect(html('animations')).toContain('Victory');
  });

  it('Vietnamese locale translates garage controls, catalog display names and unlock hints', () => {
    setLocale('vi');
    try {
      const ctx = unlockContext(EMPTY);
      const html = (c: GarageCategory) => render(<CustomizationPanel ctx={ctx} category={c} />);
      expect(html('robot')).toContain('Mẫu robot');
      expect(html('robot')).toContain('Tank — đã khoá. Đến Thế giới 2 · Canyon Circuit');
      expect(html('paint')).toContain('Sơn màu · Thân');
      expect(html('paint')).toContain('Trắng + Xanh ngọc');
      expect(html('patterns')).toContain('Sợi carbon');
      expect(html('decals')).toContain('Bên trái');
      expect(html('accessories')).toContain('Khiên dung nham — đã khoá. Đến Thế giới 6 · Lava Core');
      expect(html('animations')).toContain('Chiến thắng');
    } finally {
      setLocale('en');
    }
  });
});
