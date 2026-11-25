import { Menu, Settings, Star, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NAV_ITEMS } from '../../data/navigation';
import { signOut } from '../../features/account/session-actions';
import { useStudentSession } from '../../features/account/session-store';
import { useLevelStore } from '../../features/levels/level-store';
import { useOnboardingStore } from '../../features/onboarding/onboarding-store';
import { formatNumber, useMessages } from '../../features/i18n/i18n';
import { navigate, useRouterStore } from '../../features/router/router-store';
import { paths, type Route } from '../../features/router/routes';
import { SettingsPanel } from '../../features/settings/SettingsPanel';
import { playerStats } from '../../features/world-map/world-progress';
import type { NavId } from '../../types/ui';
import { cn } from '../../utils/cn';
import { Tooltip } from '../common/Tooltip';
import { BrandLogo } from './BrandLogo';
import { navigationMessages } from './navigation.messages';
import { UserBadge } from './UserBadge';

/** Header controls share one height (40 px) and one look: quiet surface, hover changes the fill only. */
const control = 'flex h-11 lg:h-10 items-center rounded-[var(--radius-control)] border border-white/10 bg-white/[0.04] text-[#dbe4f3] transition-colors duration-[var(--dur-fast)] hover:bg-white/[0.09] hover:text-white';
const iconButton = cn(control, 'w-11 lg:w-10 justify-center');

const activeFor = (route: Route): NavId | null =>
  route.name === 'home' ? 'home' : route.name === 'world' ? 'explore' : route.name === 'simulator' || route.name === 'studio' ? 'simulator' : route.name === 'robots' ? 'robots' : null;

/** The signed-in student + player stats (server totals: XP → level, stars). */
function usePlayer() {
  const m = useMessages(navigationMessages);
  const progress = useLevelStore((s) => s.progress);
  const user = useStudentSession((s) => s.user);
  return useMemo(() => {
    const stats = playerStats(progress, new Date());
    return { stats, user, profile: { name: user?.displayName ?? m.explorer, level: stats.level, xpProgress: stats.xpProgress } };
  }, [progress, user, m.explorer]);
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
  const m = useMessages(navigationMessages);
  const [menuOpen, setMenuOpen] = useState(false);
  const labels: Record<NavId, string> = { home: m.navHome, explore: m.navExplore, simulator: m.navSimulator, robots: m.navRobots, learn: m.navLearn };

  // The phone menu sheet closes on Escape and whenever the page changes.
  useEffect(() => setMenuOpen(false), [route]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#0a1424] px-3 sm:px-4 lg:gap-6 lg:px-6">
      <BrandLogo />

      <nav aria-label={m.mainNav} className="ml-2 hidden items-center gap-1 sm:flex xl:ml-6">
        {NAV_ITEMS.map(({ id, icon: Icon, soon }) => {
          const label = labels[id];
          const isActive = id === active;
          const button = (
            <button
              key={id}
              type="button"
              onClick={() => onNav(id)}
              disabled={soon}
              aria-current={isActive ? 'page' : undefined}
              aria-label={soon ? m.comingSoonItem({ label }) : label}
              className={cn(
                'flex h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 text-[15px] transition-colors duration-[var(--dur-fast)] lg:h-10 lg:px-3.5',
                isActive ? 'bg-white/[0.09] font-semibold text-white' : soon ? 'cursor-not-allowed text-faint' : 'text-[#aab7cc] hover:bg-white/[0.05] hover:text-white',
              )}
            >
              <Icon size={18} strokeWidth={2} className="shrink-0" aria-hidden="true" />
              <span className="max-lg:hidden">{label}</span>
            </button>
          );
          return soon ? (
            <Tooltip key={id} label={m.moreRobotsSoon}>
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Tooltip label={m.starsTip}>
          <button
            type="button"
            onClick={() => navigate(paths.worldMap())}
            aria-label={m.progress({ stars: stats.stars, max: stats.maxStars })}
            className={cn(control, 'gap-2 px-3 max-[1180px]:hidden')}
          >
            <Star size={16} className="shrink-0 fill-[#facc15] text-[#facc15]" aria-hidden="true" />
            <span className="tabular text-[14px] font-semibold text-white">
              {formatNumber(stats.stars)}
              <span className="text-muted"> / {formatNumber(stats.maxStars)}</span>
            </span>
          </button>
        </Tooltip>
        <div ref={settingsRef} className="relative">
          <Tooltip label={m.settingsTip}>
            <button type="button" className={cn(iconButton, settingsOpen && 'bg-white/[0.09] text-white')} aria-label={m.settings} aria-expanded={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}>
              <Settings size={18} aria-hidden="true" />
            </button>
          </Tooltip>
          {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        </div>
        <div className="hidden sm:block">
          <UserBadge user={profile} username={user?.username ?? ''} xp={stats.xp} onSignOut={() => void signOut()} />
        </div>
        <button
          type="button"
          className={cn(iconButton, 'sm:hidden', menuOpen && 'bg-white/[0.09] text-white')}
          aria-label={menuOpen ? m.closeMenu : m.menu}
          aria-expanded={menuOpen}
          aria-controls="phone-menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <div id="phone-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-[#0a1424] px-3 pb-6 pt-3 animate-fade-in sm:hidden">
          <nav aria-label={m.mainNav} className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ id, icon: Icon, soon }) => (
              <button
                key={id}
                type="button"
                disabled={soon}
                aria-current={id === active ? 'page' : undefined}
                onClick={() => onNav(id)}
                className={cn(
                  'flex h-12 items-center gap-3 rounded-[var(--radius-control)] px-4 text-[16px]',
                  id === active ? 'bg-white/[0.09] font-semibold text-white' : soon ? 'cursor-not-allowed text-faint' : 'text-[#c3cee0] active:bg-white/[0.08]',
                )}
              >
                <Icon size={20} aria-hidden="true" />
                {soon ? m.comingSoonItem({ label: labels[id] }) : labels[id]}
              </button>
            ))}
          </nav>
          <div className="my-3 h-px bg-white/10" />
          <button type="button" onClick={() => navigate(paths.worldMap())} aria-label={m.progress({ stars: stats.stars, max: stats.maxStars })} className="flex h-12 w-full items-center gap-3 rounded-[var(--radius-control)] px-4 text-[16px] text-[#c3cee0]">
            <Star size={20} className="fill-[#facc15] text-[#facc15]" aria-hidden="true" />
            <span className="tabular font-semibold text-white">
              {formatNumber(stats.stars)}
              <span className="text-muted"> / {formatNumber(stats.maxStars)}</span>
            </span>
          </button>
          <div className="px-4 py-3">
            <div className="truncate text-[15px] font-semibold text-white">{profile.name}</div>
            <div className="truncate font-mono text-[12.5px] text-muted">@{user?.username ?? ''}</div>
            <div className="mt-1 text-[13px] text-[#b6c3da]">{m.xpLevel({ xp: formatNumber(stats.xp), level: profile.level })}</div>
          </div>
          <button type="button" onClick={() => void signOut()} className="flex h-12 w-full items-center rounded-[var(--radius-control)] border border-white/10 px-4 text-[15px] font-semibold text-[#e2e8f0]">
            {m.signOut}
          </button>
        </div>
      )}
    </header>
  );
}
