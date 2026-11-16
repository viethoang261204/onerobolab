import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { seededRandom } from './geometry';

/**
 * Small procedural textures (≤ 512 px), created once and shared for the app
 * lifetime. Clone before changing `repeat` per surface (clones share the image).
 */
function canvasTexture(size: [number, number], draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): Texture {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = size;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, canvas.width, canvas.height);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.minFilter = LinearMipmapLinearFilter;
  return tex;
}

let tiles: Texture | null = null;
/** 4×4 floor tiles with grout and slight per-tile tint. One repeat = 4 tiles. */
export function tileTexture(): Texture {
  tiles ??= canvasTexture([512, 512], (ctx, w) => {
    const rnd = seededRandom(11);
    const cell = w / 4;
    ctx.fillStyle = '#c3cad8';
    ctx.fillRect(0, 0, w, w);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const l = 93 + rnd() * 4;
        ctx.fillStyle = `hsl(220 22% ${l}%)`;
        ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
        // soft top-left highlight for a bevelled look
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, 3);
        ctx.fillRect(x * cell + 3, y * cell + 3, 3, cell - 6);
      }
    }
  });
  return tiles;
}

let hazard: Texture | null = null;
/** Yellow/black diagonal hazard stripes. */
export function hazardTexture(): Texture {
  hazard ??= canvasTexture([128, 32], (ctx, w, h) => {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f2433';
    for (let x = -h; x < w + h; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 16, h);
      ctx.lineTo(x + 16 + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.closePath();
      ctx.fill();
    }
  });
  return hazard;
}

let checker: Texture | null = null;
/** Goal-area checker (2×2 cells per repeat). */
export function checkerTexture(): Texture {
  checker ??= canvasTexture([64, 64], (ctx, w) => {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = '#1f2433';
    ctx.fillRect(0, 0, w / 2, w / 2);
    ctx.fillRect(w / 2, w / 2, w / 2, w / 2);
  });
  return checker;
}

let glow: Texture | null = null;
/** Radial white→transparent sprite for sun glow and soft halos. */
export function glowTexture(): Texture {
  glow ??= canvasTexture([128, 128], (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
  return glow;
}

let beam: Texture | null = null;
/** Vertical fade (opaque at the bottom) for light beams over checkpoints. */
export function beamTexture(): Texture {
  beam ??= canvasTexture([4, 64], (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return beam;
}
