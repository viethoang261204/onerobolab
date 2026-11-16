import type { LucideIcon } from 'lucide-react';

export type HomeActionId = 'explore' | 'simulator' | 'practice' | 'learn';

/** A Home quick-action tile (behaviour lives in `runHomeAction`). */
export interface HomeAction {
  readonly id: HomeActionId;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
  /** CSS accent colour. */
  readonly color: string;
}
