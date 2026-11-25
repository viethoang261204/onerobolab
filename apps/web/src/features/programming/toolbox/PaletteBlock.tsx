import { memo, useMemo } from 'react';
import { cn } from '../../../utils/cn';
import { getBlockDef } from '@robolab/blocks';
import type { BlockType } from '@robolab/blocks';
import { createBlock, fragmentFromBlock } from '@robolab/blocks';
import { startBlockDrag } from '../editor/drag-controller';
import { StaticBlock } from '../editor/StaticBlock';

/** Palette blocks are drawn slightly smaller than workspace blocks. */
export const PALETTE_SCALE = 0.84;

/** A draggable block template in the toolbox. */
export const PaletteBlock = memo(function PaletteBlock({ type, disabled }: { type: BlockType; disabled?: boolean }) {
  const fragment = useMemo(() => fragmentFromBlock(createBlock(type, ['score'], `palette-${type}`)), [type]);
  const def = getBlockDef(type);
  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label={`${def.help} Drag into your program.`}
      title={disabled ? 'Your program already starts with this block.' : def.help}
      onPointerDown={disabled ? undefined : (e) => startBlockDrag(e, { kind: 'palette', type, scale: PALETTE_SCALE })}
      className={cn('w-fit origin-top-left transition-transform duration-150', disabled ? 'cursor-not-allowed opacity-45' : 'cursor-grab hover:-translate-y-px hover:brightness-110 active:cursor-grabbing')}
      style={{ zoom: PALETTE_SCALE }}
    >
      <StaticBlock fragment={fragment} id={fragment.rootId} />
    </div>
  );
});
