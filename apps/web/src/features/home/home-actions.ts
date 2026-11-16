import { Compass, GraduationCap, MonitorPlay, Repeat2 } from 'lucide-react';
import { useOnboardingStore } from '../onboarding/onboarding-store';
import { navigate } from '../router/router-store';
import { paths } from '../router/routes';
import type { HomeAction, HomeActionId } from './home.types';

/** Home quick actions — each routes to functionality that already exists. */
export const HOME_ACTIONS: readonly HomeAction[] = [
  { id: 'explore', label: 'Explore World', description: 'Pick a world and your next mission', icon: Compass, color: '#22d3ee' },
  { id: 'simulator', label: 'Open Code Studio', description: 'Keep programming your current mission', icon: MonitorPlay, color: '#3b82f6' },
  { id: 'practice', label: 'Practice Freely', description: 'Replay any mission you have unlocked', icon: Repeat2, color: '#8b5cf6' },
  { id: 'learn', label: 'Learn Robotics', description: 'Guided tour of the editor and robot', icon: GraduationCap, color: '#22c55e' },
];

export function runHomeAction(id: HomeActionId): void {
  switch (id) {
    case 'explore':
      navigate(paths.worldMap());
      break;
    case 'simulator':
      navigate(paths.studio());
      break;
    case 'practice':
      // The world map is the mission picker: every unlocked mission can be replayed there.
      navigate(paths.worldMap());
      break;
    case 'learn':
      useOnboardingStore.getState().request('studio');
      navigate(paths.studio());
      break;
  }
}
