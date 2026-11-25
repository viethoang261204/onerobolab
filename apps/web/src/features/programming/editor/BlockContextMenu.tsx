import { Ban, Copy, CopyPlus, MessageSquare, Power, Trash2, type LucideIcon } from 'lucide-react';
import type { PointerEvent } from 'react';
import { cn } from '../../../utils/cn';
import { START_ID } from '@robolab/blocks';
import type { BlockInstance } from '@robolab/blocks';
import { useMessages } from '../../i18n/i18n';
import { programmingMessages } from '../programming.messages';
import { useProgramStore } from '../state/program-store';
import { deleteWithAnimation } from './block-actions';

interface Action {
  icon: LucideIcon;
  label: string;
  run: () => void;
  danger?: boolean;
}

/** Compact action strip on the selected block (above on touch/narrow screens, to the right on desktop). */
export function BlockContextMenu({ block, onComment }: { block: BlockInstance; onComment: () => void }) {
  const m = useMessages(programmingMessages);
  const store = useProgramStore.getState;
  const isStart = block.id === START_ID;
  const actions: Action[] = isStart
    ? [{ icon: MessageSquare, label: m.addComment, run: onComment }]
    : [
        { icon: Copy, label: m.copyAction, run: () => store().copy(block.id) },
        { icon: CopyPlus, label: m.duplicateAction, run: () => store().duplicateBlock(block.id) },
        { icon: MessageSquare, label: block.comment !== undefined ? m.editComment : m.addComment, run: onComment },
        { icon: block.disabled ? Power : Ban, label: block.disabled ? m.enableBlock : m.disableBlock, run: () => store().toggleDisabled(block.id) },
        { icon: Trash2, label: m.deleteAction, run: () => deleteWithAnimation(block.id), danger: true },
      ];

  const stop = (e: PointerEvent) => e.stopPropagation();

  return (
    <div
      role="toolbar"
      aria-label={m.blockActionsAria}
      onPointerDown={stop}
      onContextMenu={(e) => e.preventDefault()}
      // Above the block on tablet/phone so it stays reachable and inside the viewport;
      // to the right on desktop so it never covers the parent block's fields above.
      className="absolute bottom-full left-0 z-30 mb-2 flex animate-fade-in items-center gap-0.5 rounded-[12px] border border-white/10 bg-[#0b1526]/95 p-1 shadow-[0_8px_20px_-8px_rgb(0_0_0/0.8)] backdrop-blur lg:bottom-auto lg:left-full lg:top-[3px] lg:mb-0 lg:ml-3 lg:rounded-[10px]"
    >
      {actions.map(({ icon: Icon, label, run, danger }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          onClick={run}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-[8px] text-[#cbd5e1] transition-colors lg:h-7 lg:w-7 lg:rounded-[7px]',
            danger ? 'hover:bg-danger/20 hover:text-danger active:bg-danger/25 active:text-danger' : 'hover:bg-white/10 hover:text-white active:bg-white/15 active:text-white',
          )}
        >
          <Icon size={17} className="lg:h-[15px] lg:w-[15px]" />
        </button>
      ))}
    </div>
  );
}
