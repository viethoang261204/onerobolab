import { create } from 'zustand';
import { ONBOARDING_TOURS, type TourId } from '../../content/tutorials/onboarding';
import { Analytics } from '../analytics/analytics';
import { browserStorage } from '../persistence/storage';

const KEY: Record<TourId, string> = { studio: 'roboverse.onboarded.studio.v1', simulator: 'roboverse.onboarded.v1' };
const storage = browserStorage();

interface OnboardingState {
  /** Tour showing now (null = none). */
  tour: TourId | null;
  /** Current step index, or null when no tour is showing. */
  step: number | null;
  /** Tour requested from another page; started when that screen mounts. */
  pending: TourId | null;
  /** Ask for a tour from anywhere (e.g. "Learn" in the header). */
  request: (tour: TourId) => void;
  /** Called by a screen after mount: starts a requested tour, or its first-visit tour. */
  onScreenReady: (tour: TourId) => void;
  /** Start automatically on the first visit only. */
  maybeStart: (tour: TourId) => void;
  start: (tour: TourId) => void;
  next: () => void;
  skip: () => void;
}

/** First-visit spotlight tours (replay any time from Help / Learn). */
export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  tour: null,
  step: null,
  pending: null,
  request: (pending) => set({ pending }),
  onScreenReady: (tour) => {
    if (get().pending === tour) set({ pending: null, tour, step: 0 });
    else get().maybeStart(tour);
  },
  maybeStart: (tour) => {
    if (!storage.getItem(KEY[tour])) set({ tour, step: 0 });
  },
  start: (tour) => set({ tour, step: 0 }),
  next: () => {
    const { step, tour } = get();
    if (step === null || !tour) return;
    if (step + 1 >= ONBOARDING_TOURS[tour].length) {
      storage.setItem(KEY[tour], '1');
      Analytics.track('onboarding_completed', { tour });
      set({ step: null, tour: null });
    } else set({ step: step + 1 });
  },
  skip: () => {
    const { tour, step } = get();
    if (tour) storage.setItem(KEY[tour], '1');
    Analytics.track('onboarding_skipped', { tour: tour ?? '', step: step ?? 0 });
    set({ step: null, tour: null });
  },
}));
