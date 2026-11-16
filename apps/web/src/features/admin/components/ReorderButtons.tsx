import { ArrowDown, ArrowUp } from 'lucide-react';
import { IconButton } from '../ui/primitives';

/** ↑ ↓ buttons for one item of an ordered list. */
export function ReorderButtons({ index, count, onMove, label, disabled }: { index: number; count: number; onMove: (delta: -1 | 1) => void; label: string; disabled?: boolean }) {
  return (
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <IconButton icon={ArrowUp} label={`Move ${label} up`} disabled={disabled || index === 0} onClick={() => onMove(-1)} />
      <IconButton icon={ArrowDown} label={`Move ${label} down`} disabled={disabled || index === count - 1} onClick={() => onMove(1)} />
    </span>
  );
}
