import { messagesFor, type Locale } from '../../i18n/i18n';
import { garageMessages } from '../garage.messages';
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
export function unlockHint(rule: UnlockRule, ctx: UnlockContext, locale?: Locale): string {
  const m = messagesFor(garageMessages, locale);
  if (rule.type === 'free') return m.unlockAvailable;
  if (rule.type === 'world') {
    const name = ctx.worldNames.get(rule.world);
    return m.unlockWorld(name !== undefined ? { world: rule.world, name } : { world: rule.world });
  }
  return m.unlockMissions({ count: rule.count, done: Math.min(ctx.missionsCompleted, rule.count) });
}
