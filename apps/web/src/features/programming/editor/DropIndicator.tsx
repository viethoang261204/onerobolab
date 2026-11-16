import { createPortal } from 'react-dom';
import { useDragStore } from '../state/drag-store';

/**
 * Shows exactly where the dragged block will land: a glowing insertion line
 * between blocks / inside a slot, or an outlined socket for value blocks.
 * Screen-space overlay, re-rendered only when the target changes.
 */
export function DropIndicator() {
  const hint = useDragStore((s) => s.hint);
  if (!hint) return null;
  return createPortal(
    hint.kind === 'line' ? (
      <div className="pointer-events-none fixed z-[60]" style={{ left: hint.x - 4, top: hint.y - 3 }}>
        <div className="flex items-center">
          <span className="h-[10px] w-[10px] rounded-full border-2 border-cyan bg-[#0a1424] shadow-[0_0_10px_#22d3ee]" />
          <span className="h-[4px] rounded-full bg-cyan shadow-[0_0_12px_2px_rgb(34_211_238/0.7)]" style={{ width: hint.width }} />
        </div>
      </div>
    ) : (
      <div
        className="pointer-events-none fixed z-[60] rounded-full border-2 border-cyan shadow-[0_0_14px_2px_rgb(34_211_238/0.6)]"
        style={{ left: hint.x - 3, top: hint.y - 3, width: hint.width + 6, height: hint.height + 6 }}
      />
    ),
    document.body,
  );
}
