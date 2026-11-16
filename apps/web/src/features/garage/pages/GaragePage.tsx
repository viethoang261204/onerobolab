import { Bot, Check, Clapperboard, Focus, LayoutGrid, Paintbrush, Plus, Puzzle, Redo2, RefreshCw, RotateCcw, Sticker, Undo2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { cn } from '../../../utils/cn';
import { CustomizationPanel } from '../components/CustomizationPanel';
import { ModelGlyph } from '../components/selectors';
import { modelInfo } from '../model/catalog';
import { DEFAULT_CONFIG, sameConfig } from '../model/robot-config';
import { previewConfig, useGarageStore, type GarageCategory } from '../state/garage-store';
import { MAX_ROBOTS, useRobotStore } from '../state/robot-store';
import { useUnlockContext } from '../state/unlock-context';
import { buttonClass } from '../../../components/common/Button';

const GarageCanvas = lazy(() => import('../scene/GarageCanvas'));

const CATEGORIES: readonly { id: GarageCategory; label: string; hint: string; icon: typeof Bot }[] = [
  { id: 'robot', label: 'Robot', hint: 'Model, wheels & name', icon: Bot },
  { id: 'paint', label: 'Paint', hint: 'Colour each part', icon: Paintbrush },
  { id: 'patterns', label: 'Patterns', hint: 'Stripes, camo, carbon…', icon: LayoutGrid },
  { id: 'decals', label: 'Decals', hint: 'Stickers & symbols', icon: Sticker },
  { id: 'accessories', label: 'Accessories', hint: 'Extra parts', icon: Puzzle },
  { id: 'animations', label: 'Animations', hint: 'Idle & moves', icon: Clapperboard },
];

const HUD = 'rounded-[18px] border border-white/10 bg-[#0a1428]/82 backdrop-blur-md shadow-[0_24px_48px_-24px_rgb(0_0_0/0.9)]';

function IconButton({ label, onClick, disabled, active, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn('flex h-10 w-10 items-center justify-center rounded-[11px] text-[#cbd5e1] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent', active && 'bg-cyan/15 text-cyan')}
    >
      {children}
    </button>
  );
}

function Confirm({ title, body, action, onConfirm, onCancel }: { title: string; body: string; action: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040a18]/60 p-6 backdrop-blur-[2px] animate-fade-in" onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="garage-confirm" onClick={(e) => e.stopPropagation()} className={cn(HUD, 'w-[min(400px,100%)] p-5 animate-pop-in')}>
        <h2 id="garage-confirm" className="font-display text-[19px] font-black text-white">
          {title}
        </h2>
        <p className="mt-1.5 text-[13.5px] text-[#b6c3da]">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-[11px] px-4 text-[13.5px] font-semibold text-[#cbd5e1] hover:bg-white/10" autoFocus>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="h-10 rounded-[11px] bg-[#ef4444] px-4 text-[13.5px] font-bold text-white hover:brightness-110">
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * `/robots` — the Robot Garage: the student's robot, large, on a turntable
 * in the workshop; categories on the left, the controls of one category on
 * the right, saved robots, undo / redo, reset and save at the bottom. The
 * saved robot becomes the student's robot across OneRoboLab.
 */
export default function GaragePage() {
  const ctx = useUnlockContext();
  const robots = useRobotStore((s) => s.robots);
  const active = useRobotStore((s) => s.active);
  const saveRobot = useRobotStore((s) => s.saveRobot);
  const g = useGarageStore();
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [confirm, setConfirm] = useState<null | { kind: 'reset' } | { kind: 'switch'; slot: number }>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Open the student's current robot when entering the garage.
  useEffect(() => {
    const s = useRobotStore.getState();
    useGarageStore.getState().open(s.active, s.robots[s.active] ?? DEFAULT_CONFIG);
  }, []);

  const saved = robots[g.slot] ?? null;
  const dirty = !saved || !sameConfig(saved, g.draft);
  const shown = useMemo(() => previewConfig({ draft: g.draft, hoverColor: g.hoverColor, part: g.part }), [g.draft, g.hoverColor, g.part]);
  const highlight = g.category === 'paint' || g.category === 'patterns' ? g.part : null;

  // Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) for undo / redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).closest('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) useGarageStore.getState().undo();
      else if ((k === 'z' && e.shiftKey) || k === 'y') useGarageStore.getState().redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const save = () => {
    saveRobot(g.slot, g.draft);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };
  const switchTo = (slot: number) => {
    if (slot === g.slot) return;
    if (dirty && saved) return setConfirm({ kind: 'switch', slot });
    doSwitch(slot);
  };
  const doSwitch = (slot: number) => {
    const config = robots[slot];
    g.open(slot, config ?? { ...DEFAULT_CONFIG, name: `Robot ${slot + 1}` });
  };

  const slots = robots.length < MAX_ROBOTS ? [...robots, null] : robots;

  return (
    <main className="relative min-h-0 flex-1 overflow-hidden bg-[#0b1222] animate-page-in" aria-label="Robot garage">
      <ErrorBoundary title="The garage could not be shown">
        <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Loading the garage"><span className="h-10 w-10 animate-spin rounded-full border-2 border-cyan/25 border-t-cyan" /></div>}>
          <div className="absolute inset-0">
            <GarageCanvas config={shown} highlight={highlight} animation={g.draft.animation} autoRotate={autoRotate} resetKey={resetKey} />
          </div>
        </Suspense>
      </ErrorBoundary>

      {/* Left: categories */}
      <nav aria-label="Customise" className={cn(HUD, 'absolute left-4 top-4 w-[236px] p-3 max-[1180px]:w-[64px] max-[1180px]:p-2')}>
        <div className="px-1.5 pb-3 pt-1 max-[1180px]:hidden">
          <h1 className="font-display text-[22px] font-black leading-tight text-white">Robot Garage</h1>
          <p className="text-[12.5px] text-[#8fa0bd]">Make your robot yours.</p>
        </div>
        <ul className="space-y-1">
          {CATEGORIES.map(({ id, label, hint, icon: Icon }) => {
            const on = g.category === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => g.setCategory(id)}
                  aria-current={on ? 'true' : undefined}
                  title={label}
                  className={cn('flex w-full items-center gap-3 rounded-[12px] border p-2 text-left transition-colors', on ? 'border-cyan/50 bg-cyan/[0.08]' : 'border-transparent hover:bg-white/[0.05]')}
                >
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]', on ? 'bg-cyan text-[#04222b]' : 'bg-white/[0.06] text-[#cbd5e1]')}>
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 max-[1180px]:hidden">
                    <span className="block text-[14px] font-bold text-white">{label}</span>
                    <span className="block truncate text-[11.5px] text-[#8fa0bd]">{hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Viewer tools + name */}
      <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1 max-[1180px]:left-[42%]">
        <span className="font-display text-[20px] font-black text-white [text-shadow:0_2px_12px_rgb(0_0_0/0.7)]">{g.draft.name}</span>
        <span className="text-[12px] font-semibold text-[#8fa0bd]">
          {modelInfo(g.draft.model).name}
          {highlight && <span className="text-cyan"> · {modelInfo(g.draft.model).parts.find((p) => p.id === highlight)?.label}</span>}
          {dirty && <span className="text-[#fbbf24]"> · unsaved changes</span>}
        </span>
      </div>

      {/* Right: controls */}
      <aside aria-label="Customisation" className={cn(HUD, 'absolute bottom-4 right-4 top-4 flex w-[360px] flex-col overflow-hidden max-[1180px]:w-[320px]')}>
        <div className="flex-1 overflow-y-auto p-4">
          <CustomizationPanel ctx={ctx} category={g.category} />
        </div>
        <div className="flex gap-2 border-t border-white/8 p-3">
          <button type="button" onClick={() => setConfirm({ kind: 'reset' })} className="flex h-11 items-center gap-2 rounded-[11px] border border-white/10 px-4 text-[14px] font-semibold text-[#cbd5e1] hover:bg-white/[0.06] hover:text-white">
            <RotateCcw size={16} /> Reset
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty && !savedFlash}
            className={buttonClass('primary', 'min-h-11 flex-1 disabled:opacity-50')}
          >
            {savedFlash ? (
              <>
                <Check size={17} strokeWidth={3} /> Saved
              </>
            ) : (
              'Save Robot'
            )}
          </button>
        </div>
      </aside>

      {/* Bottom: saved robots, history, view */}
      <div className="absolute bottom-4 left-4 right-[392px] flex items-end justify-center gap-3 max-[1180px]:right-[352px]">
        <div className={cn(HUD, 'flex items-center gap-1 p-1.5')}>
          <IconButton label="Undo (Ctrl+Z)" onClick={g.undo} disabled={!g.past.length}>
            <Undo2 size={18} />
          </IconButton>
          <IconButton label="Redo (Ctrl+Shift+Z)" onClick={g.redo} disabled={!g.future.length}>
            <Redo2 size={18} />
          </IconButton>
        </div>
        <div className={cn(HUD, 'flex items-center gap-1.5 p-1.5')} role="listbox" aria-label="Your robots">
          {slots.map((r, i) => {
            const on = i === g.slot;
            return (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => switchTo(i)}
                title={r ? `${r.name}${i === active ? ' (your robot)' : ''}` : 'New robot'}
                className={cn('relative flex h-14 w-16 flex-col items-center justify-center rounded-[11px] border transition-colors', on ? 'border-cyan/70 bg-cyan/[0.08]' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.07]')}
              >
                {r ? (
                  <>
                    <ModelGlyph model={r.model} className="h-8 w-10" />
                    <span className="mt-0.5 flex gap-0.5">
                      {[r.colors.body, r.colors.accent, r.colors.led].map((c, k) => (
                        <span key={k} className="h-1.5 w-3 rounded-full" style={{ background: c }} />
                      ))}
                    </span>
                    {i === active && <span className="absolute -right-1 -top-1 rounded-full bg-[#22c55e] px-1.5 text-[9px] font-black text-white">YOU</span>}
                  </>
                ) : (
                  <Plus size={18} className="text-[#8fa0bd]" />
                )}
              </button>
            );
          })}
        </div>
        <div className={cn(HUD, 'flex items-center gap-1 p-1.5')}>
          <IconButton label="Auto-rotate" onClick={() => setAutoRotate((v) => !v)} active={autoRotate}>
            <RefreshCw size={17} />
          </IconButton>
          <IconButton label="Reset view (or double-click)" onClick={() => setResetKey((k) => k + 1)}>
            <Focus size={17} />
          </IconButton>
        </div>
      </div>

      {confirm?.kind === 'reset' && (
        <Confirm
          title="Reset this robot?"
          body="It goes back to the default rover. Your saved robot stays as it is until you press Save Robot — and you can undo."
          action="Reset"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            g.reset();
            setConfirm(null);
          }}
        />
      )}
      {confirm?.kind === 'switch' && (
        <Confirm
          title="Discard unsaved changes?"
          body="You changed this robot without saving. Switching robots will lose those changes."
          action="Discard"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            doSwitch(confirm.slot);
            setConfirm(null);
          }}
        />
      )}
    </main>
  );
}
