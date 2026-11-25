import { useFrame } from '@react-three/fiber';
import type { MapQuery } from '@robolab/shared';
import { useEffect, useMemo, useRef } from 'react';
import { getMissionForMap } from '../../data/content-registry';
import { logToConsole } from '../../stores/console-store';
import { useSimulationStore } from '../../stores/simulation-store';
import type { RobotRuntime } from './robot/RobotMovement';
import { AudioManager } from '../audio/audio-manager';
import { currentLevel, recordAttempt, useLevelStore, type RunFacts } from '../levels/level-store';
import { effectsBus } from './effects/effects-bus';
import { collisionHint, collisionMessage, describeCommand, describeResult, failureMessage, ruleFailure } from './runtime/describe';
import { runController } from './runtime/run-controller';
import { useRuntimeStore } from './runtime/runtime-store';
import type { RuntimeEvent } from '@robolab/simulation';
import { SimulationRuntime } from '@robolab/simulation';
import { publishWorld } from './runtime/world-view';

/** UI snapshot rate while running (Hz). */
const SNAPSHOT_HZ = 8;

/**
 * Hosts the framework-free `SimulationRuntime` inside the render loop:
 * advances it with real frame time (fixed-step inside), turns runtime events
 * into console lines / store updates, and publishes throttled snapshots.
 */
export function SimulationDriver({ runtime: robot, map, data }: { runtime: RobotRuntime; map: MapQuery; data?: Readonly<Record<string, number>> | undefined }) {
  const sim = useMemo(() => new SimulationRuntime({ map, robot, mission: getMissionForMap(map.definition.id), ...(data && { data }) }), [map, robot, data]);
  const lastPush = useRef(0);

  useEffect(() => {
    runController.attach(sim, robot.definition);
    const store = useRuntimeStore.getState();
    store.apply(sim.snapshot());

    /** What the simulator observed in this run (sent to the server, which judges it). */
    const facts = (): RunFacts => {
      const snap = sim.snapshot();
      return {
        time: snap.time,
        blockCount: useRuntimeStore.getState().blockCount,
        collisions: snap.mission?.collisionCount ?? 0,
        objectivesCompleted: (snap.mission?.objectives ?? []).filter((o) => o.completed).map((o) => o.objectiveId),
      };
    };
    /** Only student programs count (the debug demo never records anything). */
    const isUserRun = () => sim.snapshot().mode === 'userProgram';

    const onEvent = (e: RuntimeEvent) => {
      const push = () => useRuntimeStore.getState().apply(sim.snapshot());
      switch (e.type) {
        case 'programStarted':
          if (e.mode === 'demo') logToConsole('info', 'Demo autopilot started.');
          else recordAttempt();
          AudioManager.play('programStart');
          push();
          break;
        case 'commandStarted': {
          const text = describeCommand(e.statement, e.args);
          if (text) logToConsole('info', text);
          push(); // active block changes immediately (not throttled)
          break;
        }
        case 'commandFinished': {
          const text = describeResult(e.statement, e.args);
          if (text) logToConsole('info', text);
          break;
        }
        case 'checkpointReached': {
          logToConsole('success', `Checkpoint ${e.order} reached!`);
          AudioManager.play('checkpoint');
          const cp = map.entitiesOfType('checkpoint').find((c) => c.order === e.order);
          if (cp) effectsBus.emit({ type: 'burst', x: cp.area.center.x, z: cp.area.center.z, color: '#22d3ee' });
          break;
        }
        case 'goalReached': {
          logToConsole('success', 'GOAL REACHED');
          const g = map.definition.finish.center;
          effectsBus.emit({ type: 'burst', x: g.x, z: g.z, color: '#4ade80', count: 40 });
          break;
        }
        case 'missionChanged':
          useRuntimeStore.getState().apply({ mission: e.mission });
          break;
        case 'missionComplete':
          logToConsole('success', '★ MISSION COMPLETE');
          AudioManager.play('missionComplete');
          push();
          useSimulationStore.getState().settle('finished');
          if (isUserRun()) useLevelStore.getState().completeRun(facts());
          break;
        case 'missionFailed': {
          logToConsole('error', failureMessage(e.reason));
          // Rule breaks (danger zone, red light, wrong delivery / order, time) end the run like a crash.
          const rule = ruleFailure(e.reason);
          if (rule) {
            AudioManager.play('collision');
            push();
            useSimulationStore.getState().settle('error');
            if (isUserRun()) useLevelStore.getState().failRun(rule.title, rule.message, facts(), 'FAILED');
          }
          break;
        }
        case 'gateOpened': {
          logToConsole('success', 'Scanner OK — the gate opens.');
          AudioManager.play('checkpoint');
          const g = map.entitiesOfType('gate').find((x) => x.id === e.entityId);
          if (g) effectsBus.emit({ type: 'burst', x: (g.from.x + g.to.x) / 2, z: (g.from.z + g.to.z) / 2, color: '#facc15' });
          break;
        }
        case 'cargoPicked':
          logToConsole('info', `PICK UP — ${e.color ? `a ${e.color} crate` : 'a crate'}`);
          break;
        case 'cargoDropped':
          if (e.correct) {
            logToConsole('success', 'Crate delivered!');
            AudioManager.play('checkpoint');
            effectsBus.emit({ type: 'burst', x: e.x, z: e.z, color: '#4ade80' });
          } else logToConsole('error', 'The crate was set down outside its delivery zone.');
          break;
        case 'collision':
          logToConsole('error', collisionMessage(e.kind));
          AudioManager.play('collision');
          push();
          useSimulationStore.getState().settle('error');
          {
            const allowed = currentLevel().allowedBlocks;
            if (isUserRun()) useLevelStore.getState().failRun('Robot stopped', collisionHint(e.kind, allowed === 'all' || allowed.includes('sensor.obstacle')), facts(), 'FAILED');
          }
          break;
        case 'runtimeError':
          logToConsole('error', `⚠ Robot stopped — ${e.message}`);
          AudioManager.play('collision');
          push();
          useSimulationStore.getState().settle('error');
          if (isUserRun()) useLevelStore.getState().failRun('Program error', e.message, facts(), 'ERROR');
          break;
        case 'programFinished':
          logToConsole('info', e.reason === 'stopBlock' ? 'Program ended at a STOP block.' : 'Program finished.');
          push();
          useSimulationStore.getState().settle('finished');
          if (sim.snapshot().mission?.status === 'running') {
            logToConsole('info', 'The robot hasn’t reached the goal yet — add more blocks and run again.');
            if (isUserRun()) {
              // Delivery missions: the robot has to come to rest ON the pad.
              const msg = currentLevel().mission.stopInFinish
                ? 'The robot stopped outside the delivery zone. Check the distances — the robot has to stop on the pad.'
                : 'The program ended before the robot reached the goal. Add more blocks or change the numbers, then try again.';
              useLevelStore.getState().incompleteRun(msg, facts());
            }
          }
          break;
        case 'programStopped':
          AudioManager.play('programStop');
          push();
          if (isUserRun()) useLevelStore.getState().stopRun(facts());
          break;
        case 'reset':
          push();
          // A reset in the middle of a run ends it (already-finished runs are ignored).
          useLevelStore.getState().stopRun();
          break;
        case 'variableChanged':
        case 'sensorChanged':
          break; // shown via throttled snapshots
      }
    };
    const off = sim.events.on(onEvent);
    const unpublish = publishWorld(sim);
    return () => {
      off();
      unpublish();
      runController.detach(sim);
    };
  }, [sim, robot]);

  // A new map/robot means a fresh runtime: make sure the UI is back to idle.
  useEffect(() => {
    if (useSimulationStore.getState().status !== 'idle') useSimulationStore.getState().reset();
  }, [sim]);

  useFrame((frame, delta) => {
    sim.advance(delta);
    if (sim.state === 'running') {
      const now = frame.clock.elapsedTime;
      if (now - lastPush.current > 1 / SNAPSHOT_HZ) {
        lastPush.current = now;
        useRuntimeStore.getState().apply(sim.snapshot());
      }
    }
  });

  return null;
}
