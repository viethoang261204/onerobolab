import { Settings, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NAV_ITEMS } from '../../data/navigation';
import { signOut } from '../../features/account/session-actions';
import { useStudentSession } from '../../features/account/session-store';
import { useLevelStore } from '../../features/levels/level-store';
import { useOnboardingStore } from '../../features/onboarding/onboarding-store';
import { navigate, useRouterStore } from '../../features/router/router-store';
import { paths, type Route } from '../../features/router/routes';
import { SettingsPanel } from '../../features/settings/SettingsPanel';
import { playerStats } from '../../features/world-map/world-progress';
import type { NavId } from '../../types/ui';
import { cn } from '../../utils/cn';
import { Tooltip } from '../common/Tooltip';
import { BrandLogo } from './BrandLogo';
import { UserBadge } from './UserBadge';

/** Header controls share one height (40 px) and one look: quiet surface, hover changes the fill only. */
const control = 'flex h-10 items-center rounded-[var(--radius-control)] border border-white/10 bg-white/[0.04] text-[#dbe4f3] transition-colors duration-[var(--dur-fast)] hover:bg-white/[0.09] hover:text-white';
const iconButton = cn(control, 'w-10 justify-center');

const activeFor = (route: Route): NavId | null =>
  route.name === 'home' ? 'home' : route.name === 'world' ? 'explore' : route.name === 'simulator' || route.name === 'studio' ? 'simulator' : route.name === 'robots' ? 'robots' : null;

/** The signed-in student + player stats (server totals: XP → level, stars). */
function usePlayer() {
  const progress = useLevelStore((s) => s.progress);
  const user = useStudentSession((s) => s.user);
  return useMemo(() => {
    const stats = playerStats(progress, new Date());
    return { stats, user, profile: { name: user?.displayName ?? 'Explorer', level: stats.level, xpProgress: stats.xpProgress } };
  }, [progress, user]);
}

/**
 * Global header on every page. Navigation is route-driven: Home, Explore
 * (world map), Simulator, Robots (garage), Learn (guided tour in Code Studio).
 */
export function TopNavigation() {
  const route = useRouterStore((s) => s.route);
  const active = activeFor(route);
  const requestTour = useOnboardingStore((s) => s.request);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { stats, profile, user } = usePlayer();

  // Close the settings popover on outside click / Escape.
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: PointerEvent) => !settingsRef.current?.contains(e.target as Node) && setSettingsOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSettingsOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  const onNav = (id: NavId) => {
    if (id === 'home') navigate(paths.home());
    else if (id === 'explore') navigate(paths.worldMap());
    else if (id === 'simulator') navigate(paths.simulator());
    else if (id === 'robots') navigate(paths.robots());
    else if (id === 'learn') {
      requestTour('studio');
      navigate(paths.studio());
    }
  };

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-6 border-b border-white/[0.07] bg-[#0a1424] px-6 max-[1100px]:gap-3 max-[1100px]:px-4">
      <BrandLogo />

      <nav aria-label="Main" className="ml-6 flex items-center gap-1 max-xl:ml-2">
        {NAV_ITEMS.map(({ id, label, icon: Icon, soon }) => {
          const isActive = id === active;
          const button = (
            <button
              key={id}
              type="button"
              onClick={() => onNav(id)}
              disabled={soon}
              aria-current={isActive ? 'page' : undefined}
              aria-label={soon ? `${label} (coming soon)` : label}
              className={cn(
                'flex h-10 items-center gap-2 rounded-[var(--radius-control)] px-3.5 text-[15px] transition-colors duration-[var(--dur-fast)] max-[1100px]:px-3',
                isActive ? 'bg-white/[0.09] font-semibold text-white' : soon ? 'cursor-not-allowed text-faint' : 'text-[#aab7cc] hover:bg-white/[0.05] hover:text-white',
              )}
            >
              <Icon size={18} strokeWidth={2} className="shrink-0" aria-hidden="true" />
              <span className="max-lg:hidden">{label}</span>
            </button>
          );
          return soon ? (
            <Tooltip key={id} label="More robots are coming soon">
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Tooltip label="Stars earned across all missions">
          <button
            type="button"
            onClick={() => navigate(paths.worldMap())}
            aria-label={`Progress: ${stats.stars} of ${stats.maxStars} stars. Open the world map`}
            className={cn(control, 'gap-2 px-3 max-[1180px]:hidden')}
          >
            <Star size={16} className="shrink-0 fill-[#facc15] text-[#facc15]" aria-hidden="true" />
            <span className="tabular text-[14px] font-semibold text-white">
              {stats.stars}
              <span className="text-muted"> / {stats.maxStars}</span>
            </span>
          </button>
        </Tooltip>
        <div ref={settingsRef} className="relative">
          <Tooltip label="Sound, quality, accessibility">
            <button type="button" className={cn(iconButton, settingsOpen && 'bg-white/[0.09] text-white')} aria-label="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}>
              <Settings size={18} aria-hidden="true" />
            </button>
          </Tooltip>
          {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        </div>
        <UserBadge user={profile} username={user?.username ?? ''} xp={stats.xp} onSignOut={() => void signOut()} />
      </div>
    </header>
  );
}
