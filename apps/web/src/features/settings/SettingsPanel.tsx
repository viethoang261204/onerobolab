import { Maximize, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useUiStore } from '../../stores/ui-store';
import { cn } from '../../utils/cn';
import { LOCALES, setLocale, useLocale, useMessages } from '../i18n/i18n';
import { settingsMessages } from './settings.messages';
import { Analytics } from '../analytics/analytics';
import { AudioManager } from '../audio/audio-manager';
import { useSettingsStore, type CodingLanguage, type Quality, type Settings } from './settings-store';

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
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
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-[var(--dur-fast)] before:absolute before:-inset-3 before:content-[""]', on ? 'bg-cyan/80' : 'bg-white/12')}
    >
      <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-[var(--dur-fast)]', on ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  );
}

const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];

const LANGUAGES: readonly CodingLanguage[] = ['blocks', 'python'];

/** Local settings (sound, display, accessibility, quality). */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const m = useMessages(settingsMessages);
  const locale = useLocale();
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
      aria-label={m.title}
      className="glass fixed inset-x-3 top-[72px] z-[85] max-h-[calc(100dvh-84px)] overflow-y-auto sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:max-h-[calc(100vh-80px)] sm:w-[320px] rounded-[var(--radius-dialog)] p-4 animate-pop-in"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-[17px] font-black text-white">{m.title}</h2>
        <button type="button" aria-label={m.close} onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-white">
          <X size={16} />
        </button>
      </header>
      <div className="divide-y divide-white/6">
        <Row label={m.language} hint={m.languageHint}>
          <div role="radiogroup" aria-label={m.language} className="flex rounded-[8px] border border-white/10 bg-[#0b1526] p-0.5 text-[12px] font-semibold">
            {LOCALES.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={locale === l.id}
                onClick={() => setLocale(l.id)}
                className={cn('min-h-11 rounded-[6px] px-3 transition-colors duration-[var(--dur-fast)] sm:min-h-8', locale === l.id ? 'bg-primary text-white' : 'text-muted hover:text-white')}
              >
                {l.label}
              </button>
            ))}
          </div>
        </Row>
        <Row label={m.codingMode} hint={m.codingModeHint}>
          <div className="flex rounded-[8px] border border-white/10 bg-[#0b1526] p-0.5 text-[11.5px] font-semibold">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => update({ codingLanguage: l })}
                className={cn(
                  'min-h-11 rounded-[6px] px-3 transition-colors duration-[var(--dur-fast)] sm:min-h-8 sm:px-2.5',
                  s.codingLanguage === l ? 'bg-primary text-white' : 'text-muted hover:text-white',
                )}
              >
                {l === 'blocks' ? m.blocks : m.python}
              </button>
            ))}
          </div>
        </Row>
        <Row label={m.sound}>
          <Toggle
            label={m.sound}
            on={s.sound}
            onChange={(v) => {
              update({ sound: v });
              if (v) AudioManager.play('click');
            }}
          />
        </Row>
        <Row label={m.volume}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            aria-label={m.volume}
            onChange={(e) => update({ volume: Number(e.target.value) })}
            onPointerUp={() => AudioManager.play('click')}
            className="w-[120px] accent-cyan"
          />
        </Row>
        <Row label={m.music} hint={m.comingSoon}>
          <Toggle label={m.music} on={s.music} onChange={(v) => update({ music: v })} />
        </Row>
        <Row label={m.showHints} hint={m.showHintsHint}>
          <Toggle label={m.showHints} on={s.showHints} onChange={(v) => update({ showHints: v })} />
        </Row>
        <Row label={m.showSensors} hint={m.showSensorsHint}>
          <Toggle label={m.showSensors} on={showSensors} onChange={toggleSensors} />
        </Row>
        <Row label={m.reducedMotion} hint={s.reducedMotion === null ? m.followingSystem : m.setByYou}>
          <Toggle label={m.reducedMotion} on={s.reduceMotion} onChange={(v) => update({ reducedMotion: v })} />
        </Row>
        <Row label={m.quality} hint={m.qualityHint}>
          <div role="radiogroup" aria-label={m.quality} className="flex rounded-[var(--radius-chip)] bg-black/25 p-0.5">
            {QUALITIES.map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={s.quality === q}
                onClick={() => update({ quality: q })}
                className={cn('min-h-11 rounded-[6px] px-3 text-[12px] font-semibold sm:min-h-8 sm:px-2.5', s.quality === q ? 'bg-cyan/20 text-cyan' : 'text-muted hover:text-white')}
              >
                {m[q]}
              </button>
            ))}
          </div>
        </Row>
        <Row label={m.fullscreen} hint={m.fullscreenHint}>
          <button
            type="button"
            onClick={() => {
              onClose();
              (document.querySelector<HTMLElement>('[aria-label="3D simulator"]') ?? document.documentElement).requestFullscreen?.().catch(() => undefined);
            }}
            className="flex h-11 items-center gap-1.5 rounded-[var(--radius-chip)] border border-white/10 px-3 sm:h-8 sm:px-2.5 text-[12px] font-semibold text-[#e2e8f0] hover:bg-white/8"
          >
            <Maximize size={13} /> {m.enter}
          </button>
        </Row>
        {import.meta.env.DEV && (
          <Row label={m.devOverlay} hint={m.devOverlayHint}>
            <Toggle label={m.devOverlay} on={s.debug} onChange={(v) => update({ debug: v })} />
          </Row>
        )}
      </div>
    </section>
  );
}
