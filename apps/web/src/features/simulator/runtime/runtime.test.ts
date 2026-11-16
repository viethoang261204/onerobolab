import { createMapEngine, RESCUE_SUPPLIES } from '@robolab/map-engine';
import { RESCUE_MISSION } from '@robolab/mission-engine';
import { CollisionWorld } from '@robolab/physics-engine';
import { ROVER } from '@robolab/robot-engine';
import { SensorSuite } from '@robolab/sensor-engine';
import { normalizeAngle } from '@robolab/shared';
import { describe, expect, it } from 'vitest';
import { compileProgram } from '../../programming/compiler/compiler';
import { buildProgram, distanceBelow, forever, fwd, ifThen, left, obstacle, repeat, right, stop, type Spec } from '../../programming/test-utils';
import { RobotRuntime } from '../robot/RobotMovement';
import type { RuntimeEvent } from './RuntimeEvents';
import { SimulationRuntime } from './SimulationRuntime';

const map = createMapEngine().load(RESCUE_SUPPLIES);
const spawn = RESCUE_SUPPLIES.start;

function setup() {
  const robot = new RobotRuntime(ROVER, spawn);
  const sim = new SimulationRuntime({ map, robot, mission: RESCUE_MISSION, seed: 3 });
  const events: RuntimeEvent[] = [];
  const active: (string | null)[] = [];
  sim.events.on((e) => events.push(e));
  return { robot, sim, events, active };
}

function run(stack: Spec[], maxSeconds = 120) {
  const env = setup();
  const compiled = compileProgram(buildProgram(stack), ROVER);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  env.sim.runProgram(compiled.program);
  for (let i = 0; i < maxSeconds * 60 && env.sim.state === 'running'; i++) {
    env.sim.step();
    env.active.push(env.sim.snapshot().activeBlockId);
  }
  return env;
}

const types = (events: RuntimeEvent[]) => events.map((e) => e.type);

describe('simulation runtime', () => {
  it('10/11/13. drives a square (SET SPEED 50, REPEAT 4 { FORWARD 20, RIGHT 90 }, STOP) and returns home', () => {
    const { robot, sim } = run([{ t: 'motion.speed', f: { speed: 50 } }, repeat(4, [fwd(20), right(90)]), stop()]);
    expect(sim.state).toBe('finished');
    expect(robot.state.pose.x).toBeCloseTo(spawn.x, 4);
    expect(robot.state.pose.z).toBeCloseTo(spawn.z, 4);
    expect(normalizeAngle(robot.state.pose.heading - spawn.heading)).toBeCloseTo(0, 4);
  });

  it('12. wait keeps the robot still for the right time', () => {
    const { sim, robot } = run([{ t: 'control.wait', f: { seconds: 2 } }]);
    expect(sim.state).toBe('finished');
    expect(sim.snapshot().time).toBeGreaterThanOrEqual(2);
    expect(sim.snapshot().time).toBeLessThan(2.1);
    expect(robot.state.pose).toEqual(spawn);
  });

  it('IF distance < 20 cm → STOP responds to the real distance sensor', () => {
    // face the south barrier, then creep forward until the sensor says < 20 cm
    const { sim, robot, events } = run([right(90), forever([ifThen(distanceBelow(20), [stop()]), fwd(2)])]);
    expect(sim.state).toBe('finished');
    expect(types(events)).not.toContain('collision');
    const d = sim.snapshot().sensors.distance ?? Infinity;
    expect(d).toBeLessThan(0.2);
    expect(d).toBeGreaterThan(0.17);
    expect(robot.state.pose.z).toBeGreaterThan(spawn.z + 0.25);
  });

  it('second test program: REPEAT 3 { FORWARD, IF obstacle → STOP, TURN RIGHT 120 } stops at the barrier', () => {
    const { sim, robot, events } = run([right(90), repeat(3, [fwd(35), ifThen(obstacle, [stop()]), right(120)])]);
    expect(sim.state).toBe('finished');
    expect(events.some((e) => e.type === 'programFinished' && e.reason === 'stopBlock')).toBe(true);
    expect(robot.state.pose.z).toBeCloseTo(spawn.z + 0.35, 4);
    // …and without an obstacle it completes all three sides
    const free = run([repeat(3, [fwd(20), ifThen(obstacle, [stop()]), right(120)])]);
    expect(free.events.filter((e) => e.type === 'commandStarted' && e.statement.op === 'turn')).toHaveLength(3);
  });

  it('16. sensors: distance by raycast, obstacle flag, line + offset', () => {
    const world = new CollisionWorld(map);
    const sensors = new SensorSuite();
    sensors.configure(ROVER.sensors);
    // facing cone-1 at (-1.05, 1.4) from 15 cm away
    sensors.sample({ x: -1.05 - 0.045 - 0.15 - 0.165, z: 1.4, heading: 0 }, { physics: world, map });
    expect(sensors.getDistance()).toBeCloseTo(0.15, 6);
    expect(sensors.detectObstacle()).toBe(true);
    sensors.sample({ x: -1.05 - 0.6, z: 1.4, heading: Math.PI }, { physics: world, map });
    expect(sensors.detectObstacle()).toBe(false);
    // on the start line, then 3 cm to its right → line is 3 cm to the robot's left
    sensors.sample(spawn, { physics: world, map });
    expect(sensors.detectLine()).toBe(true);
    sensors.sample({ ...spawn, z: spawn.z + 0.03 }, { physics: world, map });
    expect(sensors.getLineOffset()).toBeCloseTo(0.03, 6);
  });

  it('17. a collision stops the robot with an error on the moving block', () => {
    const { sim, robot, events } = run([right(90), fwd(100, 'crash')]);
    expect(sim.state).toBe('error');
    const hit = events.find((e) => e.type === 'collision');
    expect(hit?.type === 'collision' && hit.kind).toBe('barrier');
    expect(sim.snapshot().errorBlockId).toBe('crash');
    expect(robot.state.pose.z).toBeLessThan(2.5);
    expect(sim.snapshot().mission?.status).toBe('failure');
  });

  it('18/19. the course solution reaches every checkpoint and the goal → mission complete', () => {
    const { sim, events } = run([fwd(260), left(90), fwd(300), right(90), fwd(320)]);
    expect(types(events)).not.toContain('collision');
    expect(events.filter((e) => e.type === 'checkpointReached').map((e) => (e.type === 'checkpointReached' ? e.order : 0))).toEqual([1, 2, 3]);
    expect(types(events)).toContain('goalReached');
    expect(types(events)).toContain('missionComplete');
    expect(sim.state).toBe('success');
    expect(sim.snapshot().mission?.objectives.every((o) => o.completed)).toBe(true);
  });

  it('20. the active block follows execution', () => {
    const { active } = run([fwd(10, 'a'), right(45, 'b'), fwd(10, 'c')]);
    const order = active.filter((id, i, arr) => id && id !== arr[i - 1]);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('14/15. stop halts immediately; reset restores robot, variables and mission', () => {
    const env = setup();
    const compiled = compileProgram(buildProgram([{ t: 'variable.set', f: { name: 'score', value: 7 } }, fwd(100)]), ROVER);
    if (!compiled.ok) throw new Error('compile');
    env.sim.runProgram(compiled.program);
    for (let i = 0; i < 60; i++) env.sim.step();
    env.sim.stop();
    const pose = env.robot.state.pose;
    for (let i = 0; i < 30; i++) env.sim.step();
    expect(env.robot.state.pose).toEqual(pose);
    expect(env.robot.state.motors).toEqual({ left: 0, right: 0 });
    expect(env.sim.snapshot().variables.score).toBe(7);
    env.sim.reset();
    expect(env.robot.state.pose).toEqual(spawn);
    expect(env.sim.state).toBe('idle');
    expect(env.sim.snapshot().variables).toEqual({});
    expect(env.sim.snapshot().mission?.status).toBe('notStarted');
  });

  it('pause and resume', () => {
    const env = setup();
    const compiled = compileProgram(buildProgram([fwd(50)]), ROVER);
    if (!compiled.ok) throw new Error('compile');
    env.sim.runProgram(compiled.program);
    for (let i = 0; i < 30; i++) env.sim.step();
    env.sim.pause();
    const x = env.robot.state.pose.x;
    env.sim.advance(1);
    expect(env.robot.state.pose.x).toBe(x);
    env.sim.resume();
    for (let i = 0; i < 600 && env.sim.state === 'running'; i++) env.sim.step();
    expect(env.robot.state.pose.x).toBeCloseTo(spawn.x + 0.5, 4);
  });

  it('is deterministic', () => {
    const program = [repeat(3, [{ t: 'motion.forward', inputs: { distance: { t: 'math.random', f: { from: 5, to: 30 } } } } as Spec, right(120)])];
    const a = run(program);
    const b = run(program);
    expect(a.robot.state.pose).toEqual(b.robot.state.pose);
    expect(a.sim.snapshot().time).toBe(b.sim.snapshot().time);
  });

  it('demo mode still drives the autopilot to the goal', () => {
    const env = setup();
    env.sim.runDemo();
    for (let i = 0; i < 90 * 60 && env.sim.state === 'running'; i++) env.sim.step();
    expect(env.sim.state).toBe('success');
  });
});
