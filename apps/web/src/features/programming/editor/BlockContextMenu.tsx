import { Ban, Copy, CopyPlus, MessageSquare, Power, Trash2, type LucideIcon } from 'lucide-react';
import type { PointerEvent } from 'react';
import { cn } from '../../../utils/cn';
import { START_ID } from '@robolab/blocks';
import type { BlockInstance } from '@robolab/blocks';
import { useProgramStore } from '../state/program-store';
import { deleteWithAnimation } from './block-actions';

interface Action {
  icon: LucideIcon;
  label: string;
  run: () => void;
  danger?: boolean;
}

/** Compact action strip above the selected block. */
export function BlockContextMenu({ block, onComment }: { block: BlockInstance; onComment: () => void }) {
  const store = useProgramStore.getState;
  const isStart = block.id === START_ID;
  const actions: Action[] = isStart
    ? [{ icon: MessageSquare, label: 'Add comment', run: onComment }]
    : [
        { icon: Copy, label: 'Copy (Ctrl+C)', run: () => store().copy(block.id) },
        { icon: CopyPlus, label: 'Duplicate (Ctrl+D)', run: () => store().duplicateBlock(block.id) },
        { icon: MessageSquare, label: block.comment !== undefined ? 'Edit comment' : 'Add comment', run: onComment },
        { icon: block.disabled ? Power : Ban, label: block.disabled ? 'Enable block' : 'Disable block (skip when running)', run: () => store().toggleDisabled(block.id) },
        { icon: Trash2, label: 'Delete (Del)', run: () => deleteWithAnimation(block.id), danger: true },
      ];

  const stop = (e: PointerEvent) => e.stopPropagation();

  return (
    <div
      role="toolbar"
      aria-label="Block actions"
      onPointerDown={stop}
      // To the right of the block: never covers the parent block's fields above.
      className="absolute left-full top-[3px] z-30 ml-3 flex animate-fade-in items-center gap-0.5 rounded-[10px] border border-white/10 bg-[#0b1526]/95 p-1 shadow-[0_8px_20px_-8px_rgb(0_0_0/0.8)] backdrop-blur"
    >
      {actions.map(({ icon: Icon, label, run, danger }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          onClick={run}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-[7px] text-[#cbd5e1] transition-colors',
            danger ? 'hover:bg-danger/20 hover:text-danger' : 'hover:bg-white/10 hover:text-white',
          )}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
