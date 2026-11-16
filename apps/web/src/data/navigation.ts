import { Bot, Compass, GraduationCap, House, MonitorPlay } from 'lucide-react';
import type { NavItem } from '../types/ui';

/** Main navigation. `soon` items are shown disabled with a tooltip. */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'simulator', label: 'Simulator', icon: MonitorPlay },
  { id: 'robots', label: 'Robots', icon: Bot },
  { id: 'learn', label: 'Learn', icon: GraduationCap },
];

