import { memo } from 'react';
import { Instanced } from '../../environment/Instanced';
import { GEO } from '../../environment/shapes';
import type { PropBatch } from './batch';
import { envMaterial } from './materials';

/** Renders a PropBatch: one instanced mesh per geometry × material × shadow group. */
export const BatchMesh = memo(function BatchMesh({ batch, shadows = true }: { batch: PropBatch; shadows?: boolean }) {
  return (
    <>
      {batch.parts.map((part) => {
        // Tinted groups need a colour on every instance (missing ones would render black).
        const tinted = part.items.some((i) => i.color);
        const items = tinted ? part.items.map((i) => (i.color ? i : { ...i, color: '#ffffff' })) : part.items;
        return (
          <Instanced
            key={`${part.geometry}|${part.material}|${part.shadow}`}
            geometry={GEO[part.geometry]}
            material={envMaterial(part.material)}
            items={items}
            castShadow={shadows && part.shadow}
            receiveShadow
          />
        );
      })}
    </>
  );
});
