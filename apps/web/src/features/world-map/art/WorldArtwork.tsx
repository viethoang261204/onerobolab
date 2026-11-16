import { useEffect } from 'react';
import type { WorldDefinition } from '../../../content/worlds/types';
import { cn } from '../../../utils/cn';
import { WorldGlyph } from '../components/WorldGlyph';
import { artKey, useWorldArtStore } from './world-art-store';

/**
 * A world's island artwork for 2D screens: the rendered 3D diorama (see
 * `WorldArtRenderer`), with the flat glyph as a placeholder while it
 * renders. No three.js import — safe on the Home page.
 */
export function WorldArtwork({ world, locked = false, className, imgClassName }: { world: WorldDefinition; locked?: boolean; className?: string; imgClassName?: string }) {
  const url = useWorldArtStore((s) => s.images[artKey(world.id, locked)]);
  const request = useWorldArtStore((s) => s.request);
  useEffect(() => {
    request(world.id, locked);
  }, [world.id, locked, request]);
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {url ? (
        <img src={url} alt={`${world.name} island`} draggable={false} className={cn('h-full w-full object-contain animate-fade-in', imgClassName)} />
      ) : (
        <WorldGlyph theme={world.theme} locked={locked} className="h-[70%] w-[80%] opacity-60" />
      )}
    </div>
  );
}
