import { ChevronRight } from 'lucide-react';
import { cn } from '../../../utils/cn';
import type { BlockType, CategoryDef } from '@robolab/blocks';
import { useLocale } from '../../i18n/i18n';
import { categoryLabel } from '../blocks-vi';
import { PaletteBlock } from './PaletteBlock';
import { CATEGORY_ICONS } from './category-icons';

interface ToolboxCategoryProps {
  category: CategoryDef;
  open: boolean;
  onToggle: () => void;
  /** Override the palette (search results). */
  types?: readonly BlockType[];
  /** Called when a block is tap-added from this category. */
  onTapAdded?: () => void;
}

/** Collapsible category with its draggable / tap-to-add blocks. */
export function ToolboxCategory({ category, open, onToggle, types = category.palette, onTapAdded }: ToolboxCategoryProps) {
  const locale = useLocale();
  const Icon = CATEGORY_ICONS[category.id];
  const label = categoryLabel(category.id, locale);
  return (
    <section id={`toolbox-${category.id}`} style={{ ['--cat' as string]: category.color }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'group flex h-11 w-full items-center gap-2.5 rounded-[10px] px-2 text-left transition-colors lg:h-10',
          open ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--cat)] shadow-[0_4px_12px_-4px_var(--cat)] transition-transform">
          <Icon size={15} strokeWidth={2.4} className="text-white" />
        </span>
        <span className="truncate text-[13.5px] font-semibold uppercase tracking-[0.08em] text-[#dbe4f3]">{label}</span>
        <span className="ml-auto text-[11px] text-faint">{types.length}</span>
        <ChevronRight size={15} className={cn('shrink-0 text-muted transition-transform duration-200', open && 'rotate-90')} />
      </button>
      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="ml-[21px] flex flex-col items-start gap-2.5 border-l-2 border-[var(--cat)]/40 py-2.5 pl-3">
            {types.map((t) => (
              <PaletteBlock key={t} type={t} disabled={t === 'event.start'} {...(onTapAdded && { onTapAdded })} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
