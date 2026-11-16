import { useEffect } from 'react';
import { useSimulationStore } from '../../stores/simulation-store';
import { useUiStore } from '../../stores/ui-store';
import { useLevelStore } from '../levels/level-store';
import { useOnboardingStore } from '../onboarding/onboarding-store';
import { useSettingsStore } from '../settings/settings-store';
import { shortcutFor } from './keymap';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/**
 * App-level keyboard shortcuts (see `keymap.ts`):
 *   Space Run/Stop · R reset robot · F focus robot · Esc close overlay
 * plus Ctrl/⌘+Shift+D for the developer overlay (dev builds).
 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (import.meta.env.DEV && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const s = useSettingsStore.getState();
        s.set({ debug: !s.debug });
        return;
      }
      if (useOnboardingStore.getState().step !== null) return; // the tour handles its own keys
      const workspace = document.querySelector('[data-editor-area] .touch-none');
      const action = shortcutFor({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        typing: isTyping(e.target) || (e.target instanceof HTMLElement && e.target.tagName === 'BUTTON' && e.key === ' '),
        overWorkspace: !!workspace?.matches(':hover'),
      });
      if (!action) return;
      const sim = useSimulationStore.getState();
      const level = useLevelStore.getState();
      switch (action) {
        case 'runStop':
          e.preventDefault();
          if (sim.status === 'running') sim.stop();
          else sim.run();
          break;
        case 'resetRobot':
          e.preventDefault();
          level.retry();
          break;
        case 'focusRobot':
          e.preventDefault();
          useUiStore.getState().sendCameraCommand('reset');
          break;
        case 'closeOverlay':
          if (level.result) useLevelStore.setState({ result: null });
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
