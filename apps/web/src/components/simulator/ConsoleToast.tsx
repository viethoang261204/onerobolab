import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useConsoleStore } from '../../stores/console-store';
import type { ConsoleEntry } from '../../types/ui';
import { cn } from '../../utils/cn';

/**
 * The simulator has no console panel: the latest important message (a
 * warning, an error, or success) shows here for a few seconds instead.
 */
export function ConsoleToast() {
  const entries = useConsoleStore((s) => s.entries);
  const [shown, setShown] = useState<ConsoleEntry | null>(null);
  const last = entries[entries.length - 1];
  useEffect(() => {
    if (!last || last.level === 'info') return;
    setShown(last);
    const t = setTimeout(() => setShown((s) => (s?.id === last.id ? null : s)), last.level === 'error' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [last]);
  if (!shown) return null;
  const Icon = shown.level === 'success' ? CheckCircle2 : shown.level === 'info' ? Info : AlertTriangle;
  const tone = shown.level === 'error' ? 'text-[#f87171]' : shown.level === 'warn' ? 'text-[#fbbf24]' : 'text-[#4ade80]';
  return (
    <div
      key={shown.id}
      role={shown.level === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className="flex w-auto max-w-[520px] items-center gap-2.5 rounded-[var(--radius-control)] border border-white/10 bg-[#0f1b2e]/95 py-2.5 pl-3.5 pr-4 text-[13.5px] text-[#e2e8f0] shadow-[0_12px_32px_-12px_rgb(0_0_0/0.8)] animate-pop-in"
    >
      <Icon size={17} className={cn('shrink-0', tone)} aria-hidden="true" />
      <span className="min-w-0 truncate">{shown.message.replace(/^[⚠★▶■]\s*/, '')}</span>
    </div>
  );
}
