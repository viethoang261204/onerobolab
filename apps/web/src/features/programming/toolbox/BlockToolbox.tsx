import { PanelLeftClose, PanelLeftOpen, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useUiStore } from '../../../stores/ui-store';
import { cn } from '../../../utils/cn';
import { LevelRegistry } from '../../../content/levels/registry';
import { useLevelStore } from '../../levels/level-store';
import { CATEGORIES, searchBlocks, type CategoryDef } from '../blocks/block-registry';
import type { BlockCategoryId } from '../blocks/block-types';
import { useDragStore } from '../state/drag-store';
import { BlockSearch } from './BlockSearch';
import { ToolboxCategory } from './ToolboxCategory';

/**
 * Left toolbox: search + collapsible categories of draggable blocks.
 * Dropping a workspace block back onto the toolbox deletes it.
 * Collapses to an icon rail on narrow screens (or on demand).
 */
export function BlockToolbox() {
  const collapsed = useUiStore((s) => s.toolboxCollapsed);
  const setCollapsed = useUiStore((s) => s.setToolboxCollapsed);
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
    return searchBlocks(query)
      .map((r) => ({ ...r, types: r.types.filter((t) => visible.has(t)) }))
      .filter((r) => r.types.length > 0);
  }, [query, categories]);
  const draggingExisting = useDragStore((s) => s.session?.sourceId != null);
  const overTrash = useDragStore((s) => s.overTrash);

  const toggle = (id: BlockCategoryId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const jumpTo = (id: BlockCategoryId) => {
    setCollapsed(false);
    setOpen((prev) => new Set([...prev, id]));
    requestAnimationFrame(() => document.getElementById(`toolbox-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <aside
      data-editor-area
      data-tour="toolbox"
      data-drop-delete
      aria-label="Block toolbox"
      className={cn(
        'relative flex shrink-0 flex-col border-r border-white/6 bg-panel/95 transition-[width] duration-200',
        collapsed ? 'w-[64px]' : 'w-[256px]',
      )}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 overflow-y-auto p-2.5">
          <button type="button" onClick={() => setCollapsed(false)} title="Show toolbox" aria-label="Show toolbox" className="mb-1 flex h-9 w-9 items-center justify-center rounded-[10px] text-muted hover:bg-white/8 hover:text-text">
            <PanelLeftOpen size={18} />
          </button>
          {categories.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={c.label}
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
        <>
          <div className="flex items-center gap-2 p-3 pb-2">
            <BlockSearch value={query} onChange={setQuery} />
            <button type="button" onClick={() => setCollapsed(true)} title="Hide toolbox" aria-label="Hide toolbox" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted hover:bg-white/8 hover:text-text">
              <PanelLeftClose size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 pb-4">
            {query ? (
              results.length ? (
                results.map((r) => <ToolboxCategory key={r.category.id} category={r.category} types={r.types} open onToggle={() => undefined} />)
              ) : (
                <p className="px-3 py-6 text-center text-[12.5px] text-muted">No blocks match “{query}”.</p>
              )
            ) : (
              categories.map((c) => <ToolboxCategory key={c.id} category={c} open={open.has(c.id) || categories.length <= 2} onToggle={() => toggle(c.id)} />)
            )}
          </div>
          <p className="border-t border-white/5 px-4 py-2.5 text-[11.5px] leading-snug text-faint">
            {limited && <span className="mb-1 block text-cyan/80">This level uses a limited set of blocks.</span>}
            Drag a block into your program. Drop it back here to delete it.
          </p>
        </>
      )}

      {draggingExisting && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 border-2 border-dashed transition-colors',
            overTrash ? 'border-danger/70 bg-danger/15 text-danger' : 'border-white/15 bg-bg/60 text-muted',
          )}
        >
          <Trash2 size={collapsed ? 20 : 28} />
          {!collapsed && <span className="text-[13px] font-semibold">Drop here to delete</span>}
        </div>
      )}
    </aside>
  );
}
