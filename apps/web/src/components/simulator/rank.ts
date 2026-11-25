import type { Rank } from '@robolab/scoring-engine';
import { messagesFor } from '../../features/i18n/i18n';
import { simulatorMessages } from './simulator.messages';

/** Rank chip colours (flat, no glow). */
export const RANK_STYLE: Record<Exclude<Rank, 'none'>, { chip: string }> = {
  bronze: { chip: 'bg-[#b45309]/25 text-[#fdba74]' },
  silver: { chip: 'bg-white/15 text-[#e2e8f0]' },
  gold: { chip: 'bg-[#facc15]/20 text-[#fde047]' },
  platinum: { chip: 'bg-cyan/20 text-[#a5f3fc]' },
};

/** Rank name in the current language. */
export function rankLabel(rank: Exclude<Rank, 'none'>): string {
  const m = messagesFor(simulatorMessages);
  return { bronze: m.rankBronze, silver: m.rankSilver, gold: m.rankGold, platinum: m.rankPlatinum }[rank];
}
