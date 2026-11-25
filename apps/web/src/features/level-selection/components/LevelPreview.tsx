import { memo, useMemo } from 'react';
import { MapSketch, sketchFrame } from '../../../components/simulator/MapSketch';
import type { LevelDefinition } from '../../../content/levels/types';
import { cn } from '../../../utils/cn';
import { useMessages } from '../../i18n/i18n';
import { levelMapQuery } from '../level-info';
import { levelSelectionMessages } from '../level-selection.messages';

/** Miniature top-down preview of a mission's course, drawn from its map data. */
export const LevelPreview = memo(function LevelPreview({ level, size = 120, locked = false, className }: { level: LevelDefinition; size?: number; locked?: boolean; className?: string }) {
  const m = useMessages(levelSelectionMessages);
  const map = levelMapQuery(level);
  const frame = useMemo(() => sketchFrame(map, size, 8), [map, size]);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={m.coursePreviewAria({ title: level.title })}
      className={cn('shrink-0', locked && 'opacity-45 grayscale')}
    >
      <MapSketch map={map} frame={frame} showStart />
    </svg>
  );
});
