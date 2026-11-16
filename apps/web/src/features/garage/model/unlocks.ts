import type { UnlockRule } from './catalog';

/** What the journey has unlocked so far (derived from progress; see `garageProgress`). */
export interface UnlockContext {
  /** Orders of worlds that are open (reached). */
  readonly openWorlds: ReadonlySet<number>;
  readonly missionsCompleted: number;
  /** World order → name, for the "unlock at" text. */
  readonly worldNames: ReadonlyMap<number, string>;
}

export const isUnlocked = (rule: UnlockRule, ctx: UnlockContext): boolean =>
  rule.type === 'free' || (rule.type === 'world' ? ctx.openWorlds.has(rule.world) : ctx.missionsCompleted >= rule.count);

/** "Reach World 2 · Canyon Circuit" / "Complete 5 missions (3/5)". */
export function unlockHint(rule: UnlockRule, ctx: UnlockContext): string {
  if (rule.type === 'free') return 'Available';
  if (rule.type === 'world') {
    const name = ctx.worldNames.get(rule.world);
    return `Reach World ${rule.world}${name ? ` · ${name}` : ''}`;
  }
  return `Complete ${rule.count} missions (${Math.min(ctx.missionsCompleted, rule.count)}/${rule.count})`;
}
