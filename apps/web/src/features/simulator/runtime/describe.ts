import type { ColliderKind } from '@robolab/physics-engine';
import type { CommandArgs } from '@robolab/robot-engine';
import { radToDeg, type MissionFailureReason, type Statement } from '@robolab/shared';
import { messagesFor } from '../../i18n/i18n';
import { runtimeMessages } from './runtime.messages';

const cm = (m = 0) => `${Math.round(m * 1000) / 10} cm`;
const deg = (rad = 0) => `${Math.round(radToDeg(rad) * 10) / 10}°`;
const pct = (f = 0) => `${Math.round(f * 100)} %`;

/** "MOVE FORWARD 30 cm" — how a command is shown in the console. */
export function describeCommand(s: Statement, a: CommandArgs): string | null {
  const m = messagesFor(runtimeMessages);
  switch (s.op) {
    case 'move':
      return s.direction === 'forward' ? m.moveForward({ dist: cm(a.distance) }) : m.moveBackward({ dist: cm(a.distance) });
    case 'turn':
      return s.direction === 'left' ? m.turnLeft({ angle: deg(a.angle) }) : m.turnRight({ angle: deg(a.angle) });
    case 'wait':
      return m.wait({ seconds: Math.round((a.seconds ?? 0) * 100) / 100 });
    case 'stop':
      return m.stop;
    case 'setSpeed':
      return m.setSpeed({ pct: pct(a.speed) });
    case 'setVar':
      return m.setVar({ name: s.name, value: String(a.value) });
    case 'changeVar':
      return m.changeVar({ name: s.name, value: String(a.value) });
    default:
      return null; // control flow isn't logged (its inner commands are)
  }
}

/** Result line after a blocking command completes. */
export function describeResult(s: Statement, a: CommandArgs): string | null {
  const m = messagesFor(runtimeMessages);
  if (s.op === 'move') return m.distanceTravelled({ m: (a.distance ?? 0).toFixed(2) });
  if (s.op === 'turn') return m.turnComplete({ angle: deg(a.angle) });
  return null;
}

/** Name of a floor / crate colour for students. */
export const colorName = (c: string): string => messagesFor(runtimeMessages).colorName({ c });

const thing = (kind: ColliderKind): string => {
  const m = messagesFor(runtimeMessages);
  switch (kind) {
    case 'barrier':
      return m.thingBarrier;
    case 'cone':
      return m.thingCone;
    case 'block':
      return m.thingBlock;
    case 'edge':
      return m.thingEdge;
    case 'gate':
      return m.thingGate;
    case 'crate':
      return m.thingCrate;
    case 'mover':
      return m.thingMover;
  }
};

/** Educational collision message (no stack traces). */
export const collisionMessage = (kind: ColliderKind) => messagesFor(runtimeMessages).collisionLog({ thing: thing(kind) });

/** Short explanation for the "Robot stopped" panel; only suggests the sensor block when the level offers it. */
export const collisionHint = (kind: ColliderKind, canSense = true) => {
  const m = messagesFor(runtimeMessages);
  if (kind === 'edge') return m.collisionEdge;
  return canSense ? m.collisionWithSensor({ thing: thing(kind) }) : m.collisionNoSensor({ thing: thing(kind) });
};

export const failureMessage = (reason: MissionFailureReason) => {
  const m = messagesFor(runtimeMessages);
  switch (reason) {
    case 'collision':
    case 'outOfBounds':
      return m.failCrash;
    case 'timeout':
      return m.failTimeout;
    case 'hazard':
      return m.failHazard;
    case 'redLight':
      return m.failRedLight;
    case 'wrongDelivery':
      return m.failWrongDelivery;
    case 'wrongOrder':
      return m.failWrongOrder;
    default:
      return m.failGeneric;
  }
};

/** Title + explanation for the result panel when a mission rule (not a crash) ends the run. */
export function ruleFailure(reason: MissionFailureReason): { title: string; message: string } | null {
  const m = messagesFor(runtimeMessages);
  switch (reason) {
    case 'hazard':
      return { title: m.hazardTitle, message: m.hazardText };
    case 'redLight':
      return { title: m.redLightTitle, message: m.redLightText };
    case 'wrongDelivery':
      return { title: m.wrongDeliveryTitle, message: m.wrongDeliveryText };
    case 'wrongOrder':
      return { title: m.wrongOrderTitle, message: m.wrongOrderText };
    case 'timeout':
      return { title: m.timeoutTitle, message: m.timeoutText };
    default:
      return null;
  }
}
