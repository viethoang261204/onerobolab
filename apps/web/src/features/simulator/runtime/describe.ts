import type { ColliderKind } from '@robolab/physics-engine';
import type { CommandArgs } from '@robolab/robot-engine';
import { radToDeg, type MissionFailureReason, type Statement } from '@robolab/shared';

const cm = (m = 0) => `${Math.round(m * 1000) / 10} cm`;
const deg = (rad = 0) => `${Math.round(radToDeg(rad) * 10) / 10}°`;
const pct = (f = 0) => `${Math.round(f * 100)} %`;

/** "MOVE FORWARD 30 cm" — how a command is shown in the console. */
export function describeCommand(s: Statement, a: CommandArgs): string | null {
  switch (s.op) {
    case 'move':
      return `${s.direction === 'forward' ? 'MOVE FORWARD' : 'MOVE BACKWARD'} ${cm(a.distance)}`;
    case 'turn':
      return `TURN ${s.direction.toUpperCase()} ${deg(a.angle)}`;
    case 'wait':
      return `WAIT ${Math.round((a.seconds ?? 0) * 100) / 100} s`;
    case 'stop':
      return 'STOP';
    case 'setSpeed':
      return `SET SPEED ${pct(a.speed)}`;
    case 'setVar':
      return `SET ${s.name} = ${a.value}`;
    case 'changeVar':
      return `CHANGE ${s.name} → ${a.value}`;
    default:
      return null; // control flow isn't logged (its inner commands are)
  }
}

/** Result line after a blocking command completes. */
export function describeResult(s: Statement, a: CommandArgs): string | null {
  if (s.op === 'move') return `Distance travelled: ${(a.distance ?? 0).toFixed(2)} m`;
  if (s.op === 'turn') return `Turn complete (${deg(a.angle)})`;
  return null;
}

const THING: Record<ColliderKind, string> = {
  barrier: 'a barrier',
  cone: 'a cone',
  block: 'a block',
  edge: 'the edge of the course',
  gate: 'a closed gate',
  crate: 'a crate that can’t move any further',
  mover: 'a moving obstacle',
};

/** Educational collision message (no stack traces). */
export const collisionMessage = (kind: ColliderKind) =>
  `⚠ Robot stopped — it hit ${THING[kind]}. Try a shorter distance, a different turn, or add an “if obstacle ahead?” check.`;

/** Short explanation for the "Robot stopped" panel; only suggests the sensor block when the level offers it. */
export const collisionHint = (kind: ColliderKind, canSense = true) =>
  kind === 'edge'
    ? 'The robot drove off the edge of the course. Try a shorter distance.'
    : `The robot hit ${THING[kind]}. ${canSense ? 'Try changing the movement distance, or add an “if obstacle ahead?” check.' : 'Try a shorter distance or a different turn.'}`;

export const failureMessage = (reason: MissionFailureReason) =>
  reason === 'collision' || reason === 'outOfBounds'
    ? 'Mission failed: the robot crashed. Press Reset and try again.'
    : reason === 'timeout'
      ? 'Mission failed: out of time.'
      : reason === 'hazard'
        ? 'Mission failed: the robot drove into a danger zone.'
        : reason === 'redLight'
          ? 'Mission failed: the robot crossed on a red light.'
          : reason === 'wrongDelivery'
            ? 'Mission failed: a crate was set down in the wrong place.'
            : reason === 'wrongOrder'
              ? 'Mission failed: the stops were visited in the wrong order.'
              : 'Mission not finished.';

/** Title + explanation for the result panel when a mission rule (not a crash) ends the run. */
export function ruleFailure(reason: MissionFailureReason): { title: string; message: string } | null {
  switch (reason) {
    case 'hazard':
      return { title: 'Danger zone!', message: 'The robot drove into a zone it must avoid. Use the colour sensor to spot the danger before the wheels get there, then turn away.' };
    case 'redLight':
      return { title: 'Red light!', message: 'The robot entered the crossing while the light was red. Wait at the line until it turns green — the colour sensor can read the signal tile.' };
    case 'wrongDelivery':
      return { title: 'Wrong delivery', message: 'A crate was set down outside its delivery zone (or in the zone for another colour). Check where the robot stops before “drop crate”.' };
    case 'wrongOrder':
      return { title: 'Wrong order', message: 'The stops have to be visited in their order: 1, then 2, then 3… Plan the route so the robot reaches them one after another.' };
    case 'timeout':
      return { title: 'Out of time', message: 'The mission has a time limit. Make the route shorter or set a higher speed.' };
    default:
      return null;
  }
}
