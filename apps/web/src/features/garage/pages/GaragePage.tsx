import { Bot, Check, Clapperboard, Focus, LayoutGrid, Paintbrush, Plus, Puzzle, Redo2, RefreshCw, RotateCcw, Sticker, Undo2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buttonClass } from '../../../components/common/Button';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { useViewportWidth } from '../../../hooks/useViewportWidth';
import { cn } from '../../../utils/cn';
import { useLocale, useMessages } from '../../i18n/i18n';
import { CustomizationPanel } from '../components/CustomizationPanel';
import { ModelGlyph } from '../components/selectors';
import { garageMessages } from '../garage.messages';
import { modelName, partLabel } from '../model/catalog.messages';
import { DEFAULT_CONFIG, sameConfig } from '../model/robot-config';
import { previewConfig, useGarageStore, type GarageCategory } from '../state/garage-store';
import { MAX_ROBOTS, useRobotStore } from '../state/robot-store';
import { useUnlockContext } from '../state/unlock-context';

const GarageCanvas = lazy(() => import('../scene/GarageCanvas'));

const CATEGORY_ICONS: readonly { id: GarageCategory; icon: typeof Bot }[] = [
  { id: 'robot', icon: Bot },
  { id: 'paint', icon: Paintbrush },
  { id: 'patterns', icon: LayoutGrid },
  { id: 'decals', icon: Sticker },
  { id: 'accessories', icon: Puzzle },
  { id: 'animations', icon: Clapperboard },
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
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-[11px] text-[#cbd5e1] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent lg:h-10 lg:w-10',
        active && 'bg-cyan/15 text-cyan',
      )}
    >
      {children}
    </button>
  );
}

function Confirm({ title, body, action, cancelLabel, onConfirm, onCancel }: { title: string; body: string; action: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040a18]/60 p-4 backdrop-blur-[2px] animate-fade-in sm:p-6" onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="garage-confirm" onClick={(e) => e.stopPropagation()} className={cn(HUD, 'w-[min(400px,100%)] p-5 animate-pop-in')}>
        <h2 id="garage-confirm" className="font-display text-[19px] font-black text-white">
          {title}
        </h2>
        <p className="mt-1.5 text-[13.5px] text-[#b6c3da]">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-[11px] px-4 text-[13.5px] font-semibold text-[#cbd5e1] hover:bg-white/10" autoFocus>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="min-h-11 rounded-[11px] bg-[#ef4444] px-4 text-[13.5px] font-bold text-white hover:brightness-110">
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * `/robots` — the Robot Garage: the student's robot, large, on a turntable
 * in the workshop; categories on the left, controls on the right, saved robots
 * and view tools at the bottom on desktop; stacked (3D preview on top,
 * scrollable sheet below) on phone and tablet.
 */
export default function GaragePage() {
  const m = useMessages(garageMessages);
  const locale = useLocale();
  const width = useViewportWidth();
  const stacked = width < 1024;
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

  const categories = useMemo(
    () =>
      CATEGORY_ICONS.map(({ id, icon }) => {
        const text: Record<GarageCategory, { label: string; hint: string }> = {
          robot: { label: m.catRobot, hint: m.catRobotHint },
          paint: { label: m.catPaint, hint: m.catPaintHint },
          patterns: { label: m.catPatterns, hint: m.catPatternsHint },
          decals: { label: m.catDecals, hint: m.catDecalsHint },
          accessories: { label: m.catAccessories, hint: m.catAccessoriesHint },
          animations: { label: m.catAnimations, hint: m.catAnimationsHint },
        };
        return { id, icon, ...text[id] };
      }),
    [m],
  );

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
    g.open(slot, config ?? { ...DEFAULT_CONFIG, name: m.newRobotName({ n: slot + 1 }) });
  };

  const slots = robots.length < MAX_ROBOTS ? [...robots, null] : robots;

  const canvasNode = (
    <ErrorBoundary title={m.garageErrorTitle}>
      <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center" role="status" aria-label={m.loadingGarage}><span className="h-10 w-10 animate-spin rounded-full border-2 border-cyan/25 border-t-cyan" /></div>}>
        <div className="absolute inset-0 touch-none">
          <GarageCanvas config={shown} highlight={highlight} animation={g.draft.animation} autoRotate={autoRotate} resetKey={resetKey} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );

  const confirmDialog = (
    <>
      {confirm?.kind === 'reset' && (
        <Confirm
          title={m.confirmResetTitle}
          body={m.confirmResetBody}
          action={m.confirmResetAction}
          cancelLabel={m.cancel}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            g.reset();
            setConfirm(null);
          }}
        />
      )}
      {confirm?.kind === 'switch' && (
        <Confirm
          title={m.confirmSwitchTitle}
          body={m.confirmSwitchBody}
          action={m.confirmSwitchAction}
          cancelLabel={m.cancel}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            doSwitch(confirm.slot);
            setConfirm(null);
          }}
        />
      )}
    </>
  );

  // Stacked layout on phone and tablet (< 1024px): 3D preview on top, scrollable sheet below.
  if (stacked) {
    return (
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0b1222] animate-page-in" aria-label={m.garageAria}>
        {/* Top: 3D preview stage */}
        <div className="relative h-[40dvh] min-h-[210px] shrink-0 overflow-hidden sm:h-[44dvh]">
          {canvasNode}

          {/* Robot name & status */}
          <div className="pointer-events-none absolute inset-x-3 top-2.5 flex flex-col items-center gap-0.5 text-center">
            <span className="max-w-full truncate font-display text-[18px] font-black text-white [text-shadow:0_2px_12px_rgb(0_0_0/0.7)]">{g.draft.name}</span>
            <span className="text-[11.5px] font-semibold text-[#8fa0bd]">
              {modelName(g.draft.model, locale)}
              {highlight && <span className="text-cyan"> · {partLabel(g.draft.model, highlight, locale)}</span>}
              {dirty && <span className="text-[#fbbf24]"> · {m.unsavedChanges}</span>}
            </span>
          </div>

          {/* Floating compact controls over the bottom corners of the 3D stage */}
          <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-2">
            <div className="pointer-events-auto flex items-center gap-0.5 rounded-[14px] border border-white/10 bg-[#0a1428]/80 p-1 backdrop-blur-md">
              <IconButton label={m.undoAria} onClick={g.undo} disabled={!g.past.length}>
                <Undo2 size={18} />
              </IconButton>
              <IconButton label={m.redoAria} onClick={g.redo} disabled={!g.future.length}>
                <Redo2 size={18} />
              </IconButton>
            </div>
            <div className="pointer-events-auto flex items-center gap-0.5 rounded-[14px] border border-white/10 bg-[#0a1428]/80 p-1 backdrop-blur-md">
              <IconButton label={m.autoRotate} onClick={() => setAutoRotate((v) => !v)} active={autoRotate}>
                <RefreshCw size={17} />
              </IconButton>
              <IconButton label={m.resetView} onClick={() => setResetKey((k) => k + 1)}>
                <Focus size={17} />
              </IconButton>
            </div>
          </div>
        </div>

        {/* Bottom: scrollable customisation sheet */}
        <section aria-label={m.customisationAsideAria} className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[20px] border-t border-white/10 bg-[#0a1428]/95 shadow-[0_-16px_36px_-16px_rgb(0_0_0/0.9)] backdrop-blur-md">
          {/* Category tabs (horizontally scrollable, no page overflow) */}
          <nav aria-label={m.customiseNavAria} className="shrink-0 overflow-x-auto border-b border-white/8 px-3 py-2">
            <ul className="flex w-max items-center gap-1.5">
              {categories.map(({ id, label, icon: Icon }) => {
                const on = g.category === id;
                return (
                  <li key={id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => g.setCategory(id)}
                      aria-current={on ? 'true' : undefined}
                      className={cn(
                        'flex min-h-11 items-center gap-2 rounded-[11px] border px-3 py-1.5 text-[13px] font-bold whitespace-nowrap transition-colors',
                        on ? 'border-cyan/60 bg-cyan/[0.12] text-white' : 'border-transparent bg-white/[0.04] text-[#cbd5e1] hover:bg-white/[0.08]',
                      )}
                    >
                      <Icon size={16} className={on ? 'text-cyan' : 'text-[#9fb0cc]'} />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Scrollable controls + saved robots strip */}
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <CustomizationPanel ctx={ctx} category={g.category} />

            {/* Saved robots switcher */}
            <div className="border-t border-white/8 pt-4">
              <p className="mb-2 text-[12px] font-bold text-[#8fa0bd]">{m.yourRobotsAria}</p>
              <div className="flex flex-wrap items-center gap-2" role="listbox" aria-label={m.yourRobotsAria}>
                {slots.map((r, i) => {
                  const on = i === g.slot;
                  return (
                    <button
                      key={i}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => switchTo(i)}
                      title={r ? (i === active ? m.slotTitleActive({ name: r.name }) : r.name) : m.newRobot}
                      className={cn(
                        'relative flex h-14 w-16 flex-col items-center justify-center rounded-[11px] border transition-colors',
                        on ? 'border-cyan/70 bg-cyan/[0.08]' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.07]',
                      )}
                    >
                      {r ? (
                        <>
                          <ModelGlyph model={r.model} className="h-8 w-10" />
                          <span className="mt-0.5 flex gap-0.5">
                            {[r.colors.body, r.colors.accent, r.colors.led].map((c, k) => (
                              <span key={k} className="h-1.5 w-3 rounded-full" style={{ background: c }} />
                            ))}
                          </span>
                          {i === active && <span className="absolute -right-1 -top-1 rounded-full bg-[#22c55e] px-1.5 text-[9px] font-black text-white">{m.activeBadge}</span>}
                        </>
                      ) : (
                        <Plus size={18} className="text-[#8fa0bd]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticky footer actions */}
          <div className="flex shrink-0 gap-2 border-t border-white/8 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => setConfirm({ kind: 'reset' })} className="flex min-h-11 items-center gap-2 rounded-[11px] border border-white/10 px-4 text-[14px] font-semibold text-[#cbd5e1] hover:bg-white/[0.06] hover:text-white">
              <RotateCcw size={16} /> {m.reset}
            </button>
            <button type="button" onClick={save} disabled={!dirty && !savedFlash} className={buttonClass('primary', 'min-h-11 flex-1 disabled:opacity-50')}>
              {savedFlash ? (
                <>
                  <Check size={17} strokeWidth={3} /> {m.saved}
                </>
              ) : (
                m.saveRobot
              )}
            </button>
          </div>
        </section>

        {confirmDialog}
      </main>
    );
  }

  return (
    <main className="relative min-h-0 flex-1 overflow-hidden bg-[#0b1222] animate-page-in" aria-label={m.garageAria}>
      {canvasNode}

      {/* Left: categories */}
      <nav aria-label={m.customiseNavAria} className={cn(HUD, 'absolute left-4 top-4 w-[236px] p-3 max-[1180px]:w-[64px] max-[1180px]:p-2')}>
        <div className="px-1.5 pb-3 pt-1 max-[1180px]:hidden">
          <h1 className="font-display text-[22px] font-black leading-tight text-white">{m.title}</h1>
          <p className="text-[12.5px] text-[#8fa0bd]">{m.subtitle}</p>
        </div>
        <ul className="space-y-1">
          {categories.map(({ id, label, hint, icon: Icon }) => {
            const on = g.category === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => g.setCategory(id)}
                  aria-current={on ? 'true' : undefined}
                  title={label}
                  className={cn('flex min-h-11 w-full items-center gap-3 rounded-[12px] border p-2 text-left transition-colors', on ? 'border-cyan/50 bg-cyan/[0.08]' : 'border-transparent hover:bg-white/[0.05]')}
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
          {modelName(g.draft.model, locale)}
          {highlight && <span className="text-cyan"> · {partLabel(g.draft.model, highlight, locale)}</span>}
          {dirty && <span className="text-[#fbbf24]"> · {m.unsavedChanges}</span>}
        </span>
      </div>

      {/* Right: controls */}
      <aside aria-label={m.customisationAsideAria} className={cn(HUD, 'absolute bottom-4 right-4 top-4 flex w-[360px] flex-col overflow-hidden max-[1180px]:w-[320px]')}>
        <div className="flex-1 overflow-y-auto p-4">
          <CustomizationPanel ctx={ctx} category={g.category} />
        </div>
        <div className="flex gap-2 border-t border-white/8 p-3">
          <button type="button" onClick={() => setConfirm({ kind: 'reset' })} className="flex h-11 items-center gap-2 rounded-[11px] border border-white/10 px-4 text-[14px] font-semibold text-[#cbd5e1] hover:bg-white/[0.06] hover:text-white">
            <RotateCcw size={16} /> {m.reset}
          </button>
          <button type="button" onClick={save} disabled={!dirty && !savedFlash} className={buttonClass('primary', 'min-h-11 flex-1 disabled:opacity-50')}>
            {savedFlash ? (
              <>
                <Check size={17} strokeWidth={3} /> {m.saved}
              </>
            ) : (
              m.saveRobot
            )}
          </button>
        </div>
      </aside>

      {/* Bottom: saved robots, history, view */}
      <div className="absolute bottom-4 left-4 right-[392px] flex items-end justify-center gap-3 max-[1180px]:right-[352px]">
        <div className={cn(HUD, 'flex items-center gap-1 p-1.5')}>
          <IconButton label={m.undoAria} onClick={g.undo} disabled={!g.past.length}>
            <Undo2 size={18} />
          </IconButton>
          <IconButton label={m.redoAria} onClick={g.redo} disabled={!g.future.length}>
            <Redo2 size={18} />
          </IconButton>
        </div>
        <div className={cn(HUD, 'flex items-center gap-1.5 p-1.5')} role="listbox" aria-label={m.yourRobotsAria}>
          {slots.map((r, i) => {
            const on = i === g.slot;
            return (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => switchTo(i)}
                title={r ? (i === active ? m.slotTitleActive({ name: r.name }) : r.name) : m.newRobot}
                className={cn(
                  'relative flex h-14 w-16 flex-col items-center justify-center rounded-[11px] border transition-colors',
                  on ? 'border-cyan/70 bg-cyan/[0.08]' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.07]',
                )}
              >
                {r ? (
                  <>
                    <ModelGlyph model={r.model} className="h-8 w-10" />
                    <span className="mt-0.5 flex gap-0.5">
                      {[r.colors.body, r.colors.accent, r.colors.led].map((c, k) => (
                        <span key={k} className="h-1.5 w-3 rounded-full" style={{ background: c }} />
                      ))}
                    </span>
                    {i === active && <span className="absolute -right-1 -top-1 rounded-full bg-[#22c55e] px-1.5 text-[9px] font-black text-white">{m.activeBadge}</span>}
                  </>
                ) : (
                  <Plus size={18} className="text-[#8fa0bd]" />
                )}
              </button>
            );
          })}
        </div>
        <div className={cn(HUD, 'flex items-center gap-1 p-1.5')}>
          <IconButton label={m.autoRotate} onClick={() => setAutoRotate((v) => !v)} active={autoRotate}>
            <RefreshCw size={17} />
          </IconButton>
          <IconButton label={m.resetView} onClick={() => setResetKey((k) => k + 1)}>
            <Focus size={17} />
          </IconButton>
        </div>
      </div>

      {confirmDialog}
    </main>
  );
}
