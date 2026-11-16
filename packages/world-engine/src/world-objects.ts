import {
  signalPhase,
  Vec2Math,
  type CargoDrop,
  type CargoItem,
  type EntityId,
  type MapQuery,
  type Pose2D,
  type SensorColor,
  type Vec2,
  type WorldSnapshot,
} from '@robolab/shared';

/** How far in front of the robot's centre it picks up and sets down crates (m). */
export const REACH = 0.25;
/** A crate stack counts as "in front of the robot" within this distance of the reach point (m). */
export const PICK_RADIUS = 0.22;

export type PickResult = { readonly ok: true; readonly item: CargoItem } | { readonly ok: false; readonly message: string };
export type DropResult = { readonly ok: true; readonly drop: CargoDrop; readonly at: Vec2 } | { readonly ok: false; readonly message: string };

/** A crate on the floor (or in a zone), for the renderer. */
export interface PlacedCrate {
  readonly item: CargoItem;
  readonly at: Vec2;
  readonly drop: CargoDrop;
}

/** The point the robot's gripper reaches. */
export const reachPoint = (pose: Pose2D): Vec2 => Vec2Math.localToWorld(pose, { x: REACH, z: 0 });

/**
 * Interactive mission objects, driven by the simulation runtime once per
 * tick and by the program's `pick` / `drop` statements:
 *
 *   gates    – a gate opens after the robot has rested inside its trigger
 *              area for `holdSeconds` (the runtime then removes its collider)
 *   cargo    – stacks of crates; `pick` takes the next crate from the stack
 *              in front of the robot, `drop` sets the carried crate down in
 *              front of it (inside a delivery zone, or on the floor)
 *   signals  – live floor colours: traffic light tiles show the light's
 *              colour, a stack's tile shows its next crate's colour
 *
 * Pure and deterministic (no clock of its own: time comes from the runtime).
 */
export class WorldObjects {
  private stackItems = new Map<EntityId, CargoItem[]>();
  private carrying: CargoItem | null = null;
  private placed: PlacedCrate[] = [];
  private openGates: EntityId[] = [];
  private held = new Map<EntityId, number>();

  constructor(private readonly map: MapQuery) {
    this.reset();
  }

  /** Is there anything interactive on this map? */
  get active(): boolean {
    return this.map.entitiesOfType('cargo').length > 0 || this.map.entitiesOfType('gate').length > 0 || this.map.entitiesOfType('trafficLight').length > 0;
  }

  reset(): void {
    this.stackItems = new Map(this.map.entitiesOfType('cargo').map((c) => [c.id, [...c.items]]));
    this.carrying = null;
    this.placed = [];
    this.openGates = [];
    this.held = new Map();
  }

  /**
   * Gate scanners for one tick of `dt` seconds. Returns the gates that opened
   * on this tick.
   */
  update(dt: number, pose: Pose2D, resting: boolean): EntityId[] {
    const opened: EntityId[] = [];
    const p = { x: pose.x, z: pose.z };
    for (const g of this.map.entitiesOfType('gate')) {
      if (this.openGates.includes(g.id)) continue;
      const inside = resting && Vec2Math.isPointInArea(g.trigger, p);
      const t = inside ? (this.held.get(g.id) ?? 0) + dt : 0;
      this.held.set(g.id, t);
      if (inside && t >= g.holdSeconds - 1e-9) {
        this.openGates.push(g.id);
        opened.push(g.id);
      }
    }
    return opened;
  }

  /** Take the next crate from the stack in front of the robot. */
  pick(pose: Pose2D): PickResult {
    if (this.carrying) return { ok: false, message: 'The robot is already carrying a crate. Drop it first.' };
    const reach = reachPoint(pose);
    let best: { id: EntityId; d: number } | null = null;
    for (const c of this.map.entitiesOfType('cargo')) {
      const d = Vec2Math.distance(reach, c.position);
      if (d <= PICK_RADIUS && (this.stackItems.get(c.id)?.length ?? 0) > 0 && (!best || d < best.d)) best = { id: c.id, d };
    }
    if (!best) return { ok: false, message: 'There is no crate in front of the robot. Drive right up to the cargo shelf, facing it.' };
    const item = this.stackItems.get(best.id)!.shift()!;
    this.carrying = item;
    return { ok: true, item };
  }

  /** Set the carried crate down in front of the robot. */
  drop(pose: Pose2D): DropResult {
    const item = this.carrying;
    if (!item) return { ok: false, message: 'The robot isn’t carrying a crate. Use “pick up” first.' };
    const at = reachPoint(pose);
    const zone = this.map.entitiesOfType('zone').find((z) => z.kind === 'delivery' && Vec2Math.isPointInArea(z.area, at)) ?? null;
    const correct = !!zone && (!zone.color || zone.color === item.color);
    const drop: CargoDrop = { itemId: item.id, zoneId: zone?.id ?? null, correct };
    this.carrying = null;
    this.placed.push({ item, at, drop });
    return { ok: true, drop, at };
  }

  /** Floor colour that overrides the painted map at `point` (time `t`), or null. */
  surfaceColor(point: Vec2, t: number): SensorColor | null {
    for (const l of this.map.entitiesOfType('trafficLight')) if (Vec2Math.isPointInArea(l.signal, point)) return signalPhase(l, t);
    for (const c of this.map.entitiesOfType('cargo')) {
      if (!c.tile || !Vec2Math.isPointInArea(c.tile, point)) continue;
      return this.stackItems.get(c.id)?.[0]?.color ?? null;
    }
    return null;
  }

  /** Crates still waiting in a stack (first = next). */
  stack(id: EntityId): readonly CargoItem[] {
    return this.stackItems.get(id) ?? [];
  }

  get carried(): CargoItem | null {
    return this.carrying;
  }

  get placedCrates(): readonly PlacedCrate[] {
    return this.placed;
  }

  isGateOpen(id: EntityId): boolean {
    return this.openGates.includes(id);
  }

  snapshot(): WorldSnapshot {
    return { carrying: this.carrying?.id ?? null, drops: this.placed.map((p) => p.drop), openGates: [...this.openGates] };
  }
}
