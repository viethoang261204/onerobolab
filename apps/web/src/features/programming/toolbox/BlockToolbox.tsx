import { PanelLeftClose, PanelLeftOpen, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useUiStore } from '../../../stores/ui-store';
import { cn } from '../../../utils/cn';
import { LevelRegistry } from '../../../content/levels/registry';
import { useLocale, useMessages } from '../../i18n/i18n';
import { useLevelStore } from '../../levels/level-store';
import { CATEGORIES, type BlockCategoryId, type CategoryDef } from '@robolab/blocks';
import { categoryLabel, searchLocalizedBlocks } from '../blocks-vi';
import { programmingMessages } from '../programming.messages';
import { useDragStore } from '../state/drag-store';
import { BlockSearch } from './BlockSearch';
import { ToolboxCategory } from './ToolboxCategory';
import { CATEGORY_ICONS } from './category-icons';

export type ToolboxLayoutMode = 'desktop' | 'tablet' | 'phone';

export interface BlockToolboxProps {
  /** Responsive presentation: desktop sidebar (default), tablet collapsible rail + overlay drawer, or phone overlay drawer. */
  layoutMode?: ToolboxLayoutMode;
  /** Controlled open state for tablet/phone overlay drawer. */
  drawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
}

/**
 * Left toolbox: search + collapsible categories of draggable / tap-to-add blocks.
 * Dropping a workspace block back onto the toolbox deletes it.
 * On tablet it sits as a collapsible icon rail and expands as an overlay drawer;
 * on phone it opens as a slide-over drawer so the workspace keeps full width.
 */
export function BlockToolbox({ layoutMode = 'desktop', drawerOpen = false, onDrawerOpenChange }: BlockToolboxProps) {
  const locale = useLocale();
  const m = useMessages(programmingMessages);
  const desktopCollapsed = useUiStore((s) => s.toolboxCollapsed);
  const setDesktopCollapsed = useUiStore((s) => s.setToolboxCollapsed);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<ReadonlySet<BlockCategoryId>>(() => new Set(['movement', 'control']));

  // Levels choose which blocks exist in the toolbox (progressive curriculum).
  const levelId = useLevelStore((s) => s.levelId);
  const categories = useMemo<CategoryDef[]>(() => {
    const allowed = LevelRegistry.get(levelId)?.allowedBlocks ?? 'all';
    if (allowed === 'all') return [...CATEGORIES];
    const set = new Set<string>(allowed);
    return CATEGORIES.map((c) => ({ ...c, palette: c.palette.filter((t) => set.has(t)) })).filter((c) => c.palette.length > 0);
  }, [levelId]);
  const limited = (LevelRegistry.get(levelId)?.allowedBlocks ?? 'all') !== 'all';
  const results = useMemo(() => {
    const visible = new Set(categories.flatMap((c) => c.palette));
    return searchLocalizedBlocks(query)
      .map((r) => ({ ...r, types: r.types.filter((t) => visible.has(t)) }))
      .filter((r) => r.types.length > 0);
  }, [query, categories]);

  const draggingExisting = useDragStore((s) => s.session?.sourceId != null);
  const draggingPalette = useDragStore((s) => s.session != null && s.session.sourceId === null);
  const overTrash = useDragStore((s) => s.overTrash);

  const isOverlay = layoutMode !== 'desktop';
  const closeOverlay = () => onDrawerOpenChange?.(false);
  const openOverlay = () => onDrawerOpenChange?.(true);

  const toggle = (id: BlockCategoryId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const jumpTo = (id: BlockCategoryId) => {
    if (isOverlay) openOverlay();
    else setDesktopCollapsed(false);
    setOpen((prev) => new Set([...prev, id]));
    requestAnimationFrame(() => document.getElementById(`toolbox-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const expandedContent = (onClose: () => void, closeAfterTap: boolean) => (
    <>
      <div className="flex items-center gap-2 p-3 pb-2">
        <BlockSearch value={query} onChange={setQuery} />
        <button
          type="button"
          onClick={onClose}
          title={m.hideToolbox}
          aria-label={m.hideToolbox}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-muted hover:bg-white/8 hover:text-text lg:h-9 lg:w-9"
        >
          {isOverlay ? <X size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 pb-4">
        {query ? (
          results.length ? (
            results.map((r) => (
              <ToolboxCategory
                key={r.category.id}
                category={r.category}
                types={r.types}
                open
                onToggle={() => undefined}
                {...(closeAfterTap && { onTapAdded: closeOverlay })}
              />
            ))
          ) : (
            <p className="px-3 py-6 text-center text-[12.5px] text-muted">{m.noBlocksMatch({ query })}</p>
          )
        ) : (
          categories.map((c) => (
            <ToolboxCategory
              key={c.id}
              category={c}
              open={open.has(c.id) || categories.length <= 2}
              onToggle={() => toggle(c.id)}
              {...(closeAfterTap && { onTapAdded: closeOverlay })}
            />
          ))
        )}
      </div>
      <p className="border-t border-white/5 px-4 py-2.5 text-[11.5px] leading-snug text-faint">
        {limited && <span className="mb-1 block text-cyan/80">{m.limitedBlocksHint}</span>}
        {isOverlay ? m.toolboxTouchHelp : m.toolboxHelp}
      </p>
    </>
  );

  const trashOverlay = (compact: boolean) =>
    draggingExisting && (
      <div
        className={cn(
          'pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 border-2 border-dashed transition-colors',
          overTrash ? 'border-danger/70 bg-danger/15 text-danger' : 'border-white/15 bg-bg/60 text-muted',
        )}
      >
        <Trash2 size={compact ? 20 : 28} />
        {!compact && <span className="text-[13px] font-semibold">{m.dropToDelete}</span>}
      </div>
    );

  // ── Tablet & Phone: optional left icon rail (tablet) + slide-over drawer ──
  if (isOverlay) {
    return (
      <>
        {layoutMode === 'tablet' && (
          <aside
            data-editor-area
            data-tour="toolbox"
            data-drop-delete
            aria-label={m.toolboxAria}
            className="relative flex w-[60px] shrink-0 flex-col items-center border-r border-white/6 bg-panel/95"
          >
            <div className="flex flex-col items-center gap-2 overflow-y-auto p-2">
              <button
                type="button"
                onClick={openOverlay}
                title={m.showToolbox}
                aria-label={m.showToolbox}
                className="mb-1 flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:bg-white/8 hover:text-text"
              >
                <PanelLeftOpen size={18} />
              </button>
              {categories.map((c) => {
                const Icon = CATEGORY_ICONS[c.id];
                const label = categoryLabel(c.id, locale);
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => jumpTo(c.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-[10px] transition-transform"
                    style={{ background: c.color }}
                  >
                    <Icon size={18} strokeWidth={2.4} className="text-white" />
                  </button>
                );
              })}
            </div>
            {trashOverlay(true)}
          </aside>
        )}

        {drawerOpen && (
          <div className={cn('fixed inset-0 z-40 flex transition-opacity duration-150', draggingPalette && 'pointer-events-none opacity-0')}>
            <div aria-hidden="true" onClick={closeOverlay} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
            <aside
              data-editor-area
              data-drop-delete
              aria-label={m.toolboxAria}
              className="relative z-10 flex h-full w-[280px] max-w-[85vw] flex-col border-r border-white/10 bg-panel shadow-[0_18px_40px_-10px_rgb(0_0_0/0.85)]"
            >
              {expandedContent(closeOverlay, layoutMode === 'phone')}
              {trashOverlay(false)}
            </aside>
          </div>
        )}
      </>
    );
  }

  // ── Desktop: classic collapsible sidebar ──
  return (
    <aside
      data-editor-area
      data-tour="toolbox"
      data-drop-delete
      aria-label={m.toolboxAria}
      className={cn(
        'relative flex shrink-0 flex-col border-r border-white/6 bg-panel/95 transition-[width] duration-200',
        desktopCollapsed ? 'w-[64px]' : 'w-[256px]',
      )}
    >
      {desktopCollapsed ? (
        <div className="flex flex-col items-center gap-2 overflow-y-auto p-2.5">
          <button
            type="button"
            onClick={() => setDesktopCollapsed(false)}
            title={m.showToolbox}
            aria-label={m.showToolbox}
            className="mb-1 flex h-9 w-9 items-center justify-center rounded-[10px] text-muted hover:bg-white/8 hover:text-text"
          >
            <PanelLeftOpen size={18} />
          </button>
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.id];
            const label = categoryLabel(c.id, locale);
            return (
              <button
                key={c.id}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => jumpTo(c.id)}
                className="flex h-10 w-10 items-center justify-center rounded-[10px] transition-transform"
                style={{ background: c.color }}
              >
                <Icon size={17} strokeWidth={2.4} className="text-white" />
              </button>
            );
          })}
        </div>
      ) : (
        expandedContent(() => setDesktopCollapsed(true), false)
      )}

      {trashOverlay(desktopCollapsed)}
    </aside>
  );
}
