import type { Rank } from '@robolab/scoring-engine';

/** Rank label and chip colours (flat, no glow). */
export const RANK_STYLE: Record<Exclude<Rank, 'none'>, { label: string; chip: string }> = {
  bronze: { label: 'Bronze', chip: 'bg-[#b45309]/25 text-[#fdba74]' },
  silver: { label: 'Silver', chip: 'bg-white/15 text-[#e2e8f0]' },
  gold: { label: 'Gold', chip: 'bg-[#facc15]/20 text-[#fde047]' },
  platinum: { label: 'Platinum', chip: 'bg-cyan/20 text-[#a5f3fc]' },
};
