import type { ColliderKind } from '@robolab/physics-engine';
import type { CommandArgs } from '@robolab/robot-engine';
import type { CargoColor, EntityId, MissionFailureReason, MissionState, RuntimeValue, Statement } from '@robolab/shared';
import type { SensorSummary } from './RuntimeState';

export type ExecutionMode = 'userProgram' | 'demo';

/** Everything the runtime reports. The UI subscribes; nothing here knows about React. */
export type RuntimeEvent =
  | { readonly type: 'programStarted'; readonly mode: ExecutionMode }
  | { readonly type: 'programStopped' }
  | { readonly type: 'programFinished'; readonly reason: 'end' | 'stopBlock' }
  | { readonly type: 'commandStarted'; readonly statement: Statement; readonly args: CommandArgs }
  | { readonly type: 'commandFinished'; readonly statement: Statement; readonly args: CommandArgs }
  | { readonly type: 'variableChanged'; readonly name: string; readonly value: RuntimeValue }
  | { readonly type: 'sensorChanged'; readonly sensors: SensorSummary }
  | { readonly type: 'collision'; readonly kind: ColliderKind; readonly entityId: EntityId | 'boundary'; readonly blockId: string | null }
  | { readonly type: 'checkpointReached'; readonly order: number }
  | { readonly type: 'goalReached' }
  | { readonly type: 'missionChanged'; readonly mission: MissionState }
  | { readonly type: 'missionComplete' }
  | { readonly type: 'missionFailed'; readonly reason: MissionFailureReason }
  | { readonly type: 'runtimeError'; readonly message: string; readonly blockId: string | null }
  | { readonly type: 'gateOpened'; readonly entityId: EntityId }
  | { readonly type: 'cargoPicked'; readonly itemId: string; readonly color: CargoColor | null }
  | { readonly type: 'cargoDropped'; readonly itemId: string; readonly zoneId: EntityId | null; readonly correct: boolean; readonly x: number; readonly z: number }
  | { readonly type: 'reset' };

export type RuntimeListener = (event: RuntimeEvent) => void;

/** Minimal synchronous event emitter. */
export class RuntimeEvents {
  private listeners = new Set<RuntimeListener>();

  on(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: RuntimeEvent): void {
    for (const l of this.listeners) l(event);
  }
}
