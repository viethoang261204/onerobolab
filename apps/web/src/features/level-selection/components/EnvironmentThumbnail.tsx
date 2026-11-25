import { useEffect } from 'react';
import type { LevelDefinition } from '../../../content/levels/types';
import { cn } from '../../../utils/cn';
import { useMessages } from '../../i18n/i18n';
import { environmentInfo } from '../../simulator/environments/catalog';
import { levelSelectionMessages } from '../level-selection.messages';
import { usePreviewStore } from '../previews/preview-store';

/**
 * Rendered preview of a level's own 3D environment (requested on mount,
 * rendered off-screen once per session). Shows a soft placeholder meanwhile.
 */
export function EnvironmentThumbnail({ level, locked = false, className }: { level: LevelDefinition; locked?: boolean; className?: string }) {
  const m = useMessages(levelSelectionMessages);
  const url = usePreviewStore((s) => s.images[level.id]);
  const request = usePreviewStore((s) => s.request);
  useEffect(() => {
    request(level.id);
  }, [level.id, request]);
  const env = environmentInfo(level.environmentId);
  return (
    <div className={cn('relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_80%,#1c3570_0%,#0b1733_75%)]', className)}>
      {url ? (
        <img src={url} alt={m.previewAlt({ name: env.name })} className={cn('h-full w-full object-cover animate-fade-in', locked && 'opacity-50 grayscale')} draggable={false} />
      ) : (
        <div role="img" aria-label={m.previewLoading({ name: env.name })} className="flex h-full w-full items-center justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan/20 border-t-cyan/70" />
        </div>
      )}
    </div>
  );
}
