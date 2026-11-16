import { Maximize, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useUiStore } from '../../stores/ui-store';
import { cn } from '../../utils/cn';
import { Analytics } from '../analytics/analytics';
import { AudioManager } from '../audio/audio-manager';
import { useSettingsStore, type CodingLanguage, type Quality, type Settings } from './settings-store';

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-[13.5px] font-medium text-[#e2e8f0]">{label}</div>
        {hint && <div className="text-[11.5px] text-faint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-[var(--dur-fast)]', on ? 'bg-cyan/80' : 'bg-white/12')}
    >
      <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-[var(--dur-fast)]', on ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  );
}

const QUALITIES: readonly { value: Quality; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const LANGUAGES: readonly { value: CodingLanguage; label: string }[] = [
  { value: 'blocks', label: 'Blocks' },
  { value: 'python', label: 'Python' },
];

/** Local settings (sound, display, accessibility, quality). */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useSettingsStore();
  const showSensors = useUiStore((st) => st.showSensors);
  const toggleSensors = useUiStore((st) => st.toggleSensors);
  const update = (patch: Partial<Settings>) => {
    s.set(patch);
    Analytics.track('settings_changed', Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === null ? null : typeof v === 'object' ? JSON.stringify(v) : v])));
  };

  return (
    <section
      role="dialog"
      aria-label="Settings"
      className="glass absolute right-0 top-[calc(100%+10px)] z-[85] max-h-[calc(100vh-80px)] w-[320px] overflow-y-auto rounded-[var(--radius-dialog)] p-4 animate-pop-in"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-[17px] font-black text-white">Settings</h2>
        <button type="button" aria-label="Close settings" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-white/10 hover:text-white">
          <X size={16} />
        </button>
      </header>
      <div className="divide-y divide-white/6">
        <Row label="Coding mode" hint="Blocks or Python">
          <div className="flex rounded-[8px] border border-white/10 bg-[#0b1526] p-0.5 text-[11.5px] font-semibold">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => update({ codingLanguage: l.value })}
                className={cn(
                  'rounded-[6px] px-2.5 py-1 transition-colors duration-[var(--dur-fast)]',
                  s.codingLanguage === l.value ? 'bg-primary text-white' : 'text-muted hover:text-white',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Sound effects">
          <Toggle
            label="Sound effects"
            on={s.sound}
            onChange={(v) => {
              update({ sound: v });
              if (v) AudioManager.play('click');
            }}
          />
        </Row>
        <Row label="Volume">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            aria-label="Volume"
            onChange={(e) => update({ volume: Number(e.target.value) })}
            onPointerUp={() => AudioManager.play('click')}
            className="w-[120px] accent-cyan"
          />
        </Row>
        <Row label="Music" hint="Coming soon">
          <Toggle label="Music" on={s.music} onChange={(v) => update({ music: v })} />
        </Row>
        <Row label="Show hints" hint="“Need help?” in the mission card">
          <Toggle label="Show hints" on={s.showHints} onChange={(v) => update({ showHints: v })} />
        </Row>
        <Row label="Show sensors" hint="Distance ray, line sensors, camera view">
          <Toggle label="Show sensors" on={showSensors} onChange={toggleSensors} />
        </Row>
        <Row label="Reduced motion" hint={s.reducedMotion === null ? 'Following your system setting' : 'Set by you'}>
          <Toggle label="Reduced motion" on={s.reduceMotion} onChange={(v) => update({ reducedMotion: v })} />
        </Row>
        <Row label="Quality" hint="Lower it if the 3D view feels slow">
          <div role="radiogroup" aria-label="Quality" className="flex rounded-[var(--radius-chip)] bg-black/25 p-0.5">
            {QUALITIES.map((q) => (
              <button
                key={q.value}
                type="button"
                role="radio"
                aria-checked={s.quality === q.value}
                onClick={() => update({ quality: q.value })}
                className={cn('rounded-[6px] px-2.5 py-1 text-[12px] font-semibold', s.quality === q.value ? 'bg-cyan/20 text-cyan' : 'text-muted hover:text-white')}
              >
                {q.label}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Fullscreen" hint="3D view in the simulator · Esc to exit">
          <button
            type="button"
            onClick={() => {
              onClose();
              (document.querySelector<HTMLElement>('[aria-label="3D simulator"]') ?? document.documentElement).requestFullscreen?.().catch(() => undefined);
            }}
            className="flex h-8 items-center gap-1.5 rounded-[var(--radius-chip)] border border-white/10 px-2.5 text-[12px] font-semibold text-[#e2e8f0] hover:bg-white/8"
          >
            <Maximize size={13} /> Enter
          </button>
        </Row>
        {import.meta.env.DEV && (
          <Row label="Developer overlay" hint="FPS, draw calls, runtime (Ctrl+Shift+D)">
            <Toggle label="Developer overlay" on={s.debug} onChange={(v) => update({ debug: v })} />
          </Row>
        )}
      </div>
    </section>
  );
}
