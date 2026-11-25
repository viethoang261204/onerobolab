import { ChevronRight } from 'lucide-react';
import { cn } from '../../../utils/cn';
import type { CategoryDef } from '@robolab/blocks';
import type { BlockType } from '@robolab/blocks';
import { PaletteBlock } from './PaletteBlock';
import { CATEGORY_ICONS } from './category-icons';

interface ToolboxCategoryProps {
  category: CategoryDef;
  open: boolean;
  onToggle: () => void;
  /** Override the palette (search results). */
  types?: readonly BlockType[];
}

/** Collapsible category with its draggable blocks. */
export function ToolboxCategory({ category, open, onToggle, types = category.palette }: ToolboxCategoryProps) {
  const Icon = CATEGORY_ICONS[category.id];
  return (
    <section id={`toolbox-${category.id}`} style={{ ['--cat' as string]: category.color }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'group flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2 text-left transition-colors',
          open ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
        )}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--cat)] shadow-[0_4px_12px_-4px_var(--cat)] transition-transform">
          <Icon size={15} strokeWidth={2.4} className="text-white" />
        </span>
        <span className="text-[13.5px] font-semibold uppercase tracking-[0.08em] text-[#dbe4f3]">{category.label}</span>
        <span className="ml-auto text-[11px] text-faint">{types.length}</span>
        <ChevronRight size={15} className={cn('text-muted transition-transform duration-200', open && 'rotate-90')} />
      </button>
      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="flex flex-col items-start gap-2.5 border-l-2 border-[var(--cat)]/40 py-2.5 pl-3 ml-[21px]">
            {types.map((t) => (
              <PaletteBlock key={t} type={t} disabled={t === 'event.start'} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
