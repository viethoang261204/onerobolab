import {
  and,
  back,
  backBy,
  call,
  changeVar,
  detour,
  fwdBy,
  getVar,
  goTo,
  math,
  mission,
  or,
  repeatBy,
  robotX,
  robotY,
  setVar,
  setVarTo,
  whileDo,
  brk,
  colorIs,
  cmp,
  forever,
  fwd,
  ifElse,
  ifThen,
  left,
  lineSeen,
  not,
  obstacle,
  pick,
  drop,
  repeat,
  right,
  speed,
  step,
  stop,
  until,
  waitS,
  type Spec,
} from '../programming/test-utils';

/** A reference program: the main script, its variables and functions. */
export interface Solution {
  readonly stack: readonly Spec[];
  readonly variables?: readonly string[];
  readonly functions?: Readonly<Record<string, readonly Spec[]>>;
}

const distance: Spec = { t: 'sensor.distance' };
/** Into a bay on the left and back out. */
const inAndOut = [left(90), fwd(60), back(60), right(90)];
const evacuate = (v: string) => ifThen(and(cmp(mission(`risk_${v}`), '>', 5), cmp(mission(`people_${v}`), '>', 0)), inAndOut);
const crossTrack = [whileDo(cmp(distance, '>', 50), [waitS(0.1)]), whileDo(cmp(distance, '<', 50), [waitS(0.1)])];

/** Reference solutions (tests only — levels never ship their answers). */
export const SOLUTIONS: Readonly<Record<string, Solution>> = {
  'starter-01': { stack: [step(3), left(90), step(2), stop()] },
  'starter-02': { stack: [step(2), left(90), step(2), right(90), step(3), right(90), step(1), stop()] },
  'starter-03': { stack: [step(1), left(90), step(1), right(90), step(2), right(90), step(1), left(90), step(1), left(90), step(3), stop()] },
  'starter-04': {
    stack: [step(2), repeat(3, [left(90), step(2), back(120), right(90), step(1)]), step(2)],
  },
  'starter-05': { stack: [step(2), waitS(4), step(3), left(90), step(1), waitS(6), step(3)] },
  'starter-06': { stack: [step(2), left(90), step(2), right(90), step(1), right(90), step(2), left(90), step(3), left(90), step(2)] },
  'starter-07': { stack: [step(2), left(90), ifElse(obstacle, [right(90), step(4), left(90), step(4), left(90), step(2)], [step(4), right(90), step(2)])] },
  'starter-08': { stack: [repeat(3, [pick(), right(180), step(3), drop(), left(180), step(3)]), right(90), step(2)] },
  'starter-09': {
    stack: [repeat(4, [ifElse(colorIs('red'), [pick(), right(180), step(3), drop(), left(180), step(3)], [pick(), left(90), step(2), drop(), back(120), right(90)])]), right(90), step(2)],
  },
  'starter-10': { stack: [until(cmp(distance, '<', 30), [fwd(5)]), waitS(2), step(2)] },
  'starter-11': { stack: [forever([ifElse(colorIs('red'), [waitS(0.1)], [ifElse(colorIs('yellow'), [speed(30), fwd(5)], [speed(100), fwd(5)])])])] },
  'starter-12': { stack: [forever([ifElse(lineSeen, [right(15), fwd(3)], [left(15), fwd(3)])])] },
  'starter-13': {
    stack: [
      forever([
        ifElse(obstacle, detour(60, 100), [ifElse(colorIs('red'), [right(90), fwd(80)], [ifElse(colorIs('blue'), [left(90), fwd(80)], [ifElse(lineSeen, [right(15), fwd(3)], [left(15), fwd(3)])])])]),
      ]),
    ],
  },
  'starter-14': { stack: [forever([ifThen(or(colorIs('blue'), obstacle), [back(20), left(90), fwd(50), right(90), fwd(100), right(90), fwd(50), left(90)]), fwd(5)])] },
  'starter-15': {
    stack: [setVarTo('d', math('add', math('multiply', mission('segments'), 40), 60)), fwdBy(getVar('d')), waitS(2), fwdBy(math('subtract', 420, getVar('d')))],
    variables: ['d'],
  },
  'starter-16': { stack: [setVarTo('d', math('multiply', mission('target'), 80)), fwdBy(getVar('d')), left(90), fwd(60), back(60), right(90), backBy(getVar('d'))], variables: ['d'] },
  'starter-17': {
    stack: [
      setVar('k', 1),
      repeatBy(mission('count'), [fwdBy(math('multiply', getVar('k'), 70)), left(90), fwd(30), pick(), back(30), right(90), backBy(math('multiply', getVar('k'), 70)), right(90), drop(), left(90), changeVar('k', 1)]),
    ],
    variables: ['k'],
  },
  'starter-18': { stack: [fwd(70), forever([left(90), ifThen(cmp(distance, '>', 60), [brk()]), right(90), fwd(70)]), fwd(60)] },
  'starter-19': {
    stack: [
      fwdBy(math('subtract', mission('x1'), robotX)),
      left(90),
      fwdBy(math('subtract', mission('y1'), robotY)),
      right(90),
      fwdBy(math('subtract', mission('x2'), robotX)),
      left(90),
      fwdBy(math('subtract', mission('y2'), robotY)),
      right(90),
      fwdBy(math('subtract', -240, robotX)),
      left(90),
      fwdBy(math('subtract', -140, robotY)),
    ],
  },
  'starter-20': { stack: [fwd(100), evacuate('a'), fwd(120), evacuate('b'), fwd(120), evacuate('c'), fwd(125)] },
  'starter-21': {
    stack: [speed(100), repeat(10, [ifElse(colorIs('red'), [call('to_motors')], [call('to_sensors')])]), right(90), fwd(120)],
    functions: {
      to_motors: [pick(), right(180), fwd(170), drop(), left(180), fwd(170)],
      to_sensors: [pick(), left(90), fwd(120), drop(), back(120), right(90)],
    },
  },
  'starter-22': { stack: [speed(100), forever([right(90), whileDo(cmp(distance, '<', 40), [left(90)]), fwd(80)])] },
  'starter-23': {
    stack: [
      fwd(100), left(90), fwd(140), back(140), right(90),
      fwd(140), pick(), left(90), fwd(205), drop(), back(205), right(90),
      pick(), left(90), fwd(205), drop(),
      goTo(78, 65), whileDo(not(colorIs('green')), [waitS(0.1)]), fwd(152),
    ],
  },
  'starter-24': {
    stack: [speed(100), fwd(115), ...crossTrack, fwd(160), ...crossTrack, fwd(170), pick(), back(25), left(90), fwd(110), whileDo(not(colorIs('green')), [waitS(0.1)]), fwd(175), drop()],
  },
};
