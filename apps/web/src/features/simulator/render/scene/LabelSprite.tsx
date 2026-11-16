import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

interface LabelSpriteProps {
  text: string;
  color: string;
  /** Constant on-screen height (fraction of viewport height). Width follows the text. */
  height?: number;
  y?: number;
}

const PX_HEIGHT = 64;
const FONT = `700 30px 'Space Grotesk', 'Segoe UI', system-ui, sans-serif`;

/**
 * Billboard label drawn once into a small canvas texture. Cheaper than DOM
 * overlays (no per-frame layout) and needs no font download. Disposed on unmount.
 */
export function LabelSprite({ text, color, height = 0.034, y = 0.25 }: LabelSpriteProps) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let width = PX_HEIGHT;
    if (ctx) {
      ctx.font = FONT;
      width = Math.max(PX_HEIGHT, Math.ceil(ctx.measureText(text).width) + 36);
    }
    canvas.width = width;
    canvas.height = PX_HEIGHT;
    if (ctx) {
      const r = PX_HEIGHT / 2 - 3;
      ctx.beginPath();
      ctx.roundRect(3, 3, width - 6, PX_HEIGHT - 6, r);
      ctx.fillStyle = 'rgba(11, 16, 32, 0.88)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.font = FONT;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, PX_HEIGHT / 2 + 1);
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return { texture: tex, aspect: width / PX_HEIGHT };
  }, [text, color]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position-y={y} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} sizeAttenuation={false} />
    </sprite>
  );
}
