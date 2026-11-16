import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../../types/ui';
import { ProgressBar } from '../common/ProgressBar';

function Avatar() {
  return (
    <svg width="30" height="30" viewBox="0 0 44 44" aria-hidden="true" className="shrink-0 rounded-full ring-1 ring-white/15">
      <defs>
        <linearGradient id="rv-avatar-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <circle cx="22" cy="22" r="22" fill="url(#rv-avatar-bg)" />
      <path d="M8 44c1-9 7-13 14-13s13 4 14 13z" fill="#1d4ed8" />
      <path d="M17 30h10v4a5 5 0 0 1-10 0z" fill="#f3c7a1" />
      <circle cx="22" cy="21" r="9.5" fill="#f8d2b0" />
      <path d="M12.5 20c-.5-7 4-11 9.5-11s10.5 3 9.5 11c-1.5-3-4-4.5-7-4.5-3.5 0-6 2-12 4.5z" fill="#3b2418" />
      <circle cx="18.5" cy="22" r="1.3" fill="#1f2937" />
      <circle cx="25.5" cy="22" r="1.3" fill="#1f2937" />
      <path d="M19 26.2c1.8 1.4 4.2 1.4 6 0" fill="none" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** The signed-in student (name, player level) with an account menu (username, XP, sign out). */
export function UserBadge({ user, username, xp, onSignOut }: { user: UserProfile; username: string; xp: number; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${user.name}, level ${user.level}. Account menu`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2.5 rounded-[var(--radius-control)] border border-white/10 bg-white/[0.04] pl-1.5 pr-3.5 transition-colors duration-[var(--dur-fast)] hover:bg-white/[0.09] aria-expanded:bg-white/[0.09]"
      >
        <Avatar />
        <span className="flex min-w-[96px] flex-col gap-[5px] text-left">
          <span className="max-w-[150px] truncate text-[13.5px] font-semibold leading-none text-white">{user.name}</span>
          <span className="flex items-center gap-2">
            <span className="text-[12px] leading-none text-muted">Lv. {user.level}</span>
            <ProgressBar value={user.xpProgress} label={`Level ${user.level} progress`} className="w-[56px]" />
          </span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[48px] z-40 w-60 rounded-[var(--radius-panel)] border border-white/10 bg-[#0f1b2e] p-1.5 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.75)] animate-fade-in">
          <div className="px-3 py-2">
            <div className="truncate text-[14px] font-semibold text-white">{user.name}</div>
            <div className="truncate font-mono text-[12px] text-muted">@{username}</div>
            <div className="mt-1 text-[12.5px] text-[#b6c3da]">
              <span className="tabular font-semibold text-white">{xp}</span> XP · level {user.level}
            </div>
          </div>
          <div className="my-1 h-px bg-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-chip)] px-3 text-left text-[14px] text-[#e2e8f0] transition-colors hover:bg-danger/12 hover:text-[#fca5a5]"
          >
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
