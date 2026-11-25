import { memo, useMemo } from 'react';
import { cn } from '../../../utils/cn';
import type { BlockType } from '@robolab/blocks';
import { createBlock, fragmentFromBlock } from '@robolab/blocks';
import { useLocale, useMessages } from '../../i18n/i18n';
import { localizedBlockDef } from '../blocks-vi';
import { programmingMessages } from '../programming.messages';
import { addBlockFromPalette, startBlockDrag } from '../editor/drag-controller';
import { StaticBlock } from '../editor/StaticBlock';

/** Palette blocks are drawn slightly smaller than workspace blocks. */
export const PALETTE_SCALE = 0.84;

/** A draggable (and tap-to-add) block template in the toolbox. */
export const PaletteBlock = memo(function PaletteBlock({ type, disabled, onTapAdded }: { type: BlockType; disabled?: boolean; onTapAdded?: () => void }) {
  const locale = useLocale();
  const m = useMessages(programmingMessages);
  const fragment = useMemo(() => fragmentFromBlock(createBlock(type, ['score'], `palette-${type}`)), [type]);
  const def = localizedBlockDef(type, locale);
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={m.paletteAria({ help: def.help })}
      title={disabled ? m.paletteStartDisabled : def.help}
      onPointerDown={disabled ? undefined : (e) => startBlockDrag(e, { kind: 'palette', type, scale: PALETTE_SCALE }, onTapAdded ? { onTapAdded } : undefined)}
      onKeyDown={
        disabled
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (addBlockFromPalette(type)) onTapAdded?.();
              }
            }
      }
      className={cn(
        'w-fit origin-top-left touch-pan-y select-none transition-transform duration-150',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-grab hover:-translate-y-px hover:brightness-110 active:cursor-grabbing',
      )}
      style={{ zoom: PALETTE_SCALE }}
    >
      <StaticBlock fragment={fragment} id={fragment.rootId} />
    </div>
  );
});
